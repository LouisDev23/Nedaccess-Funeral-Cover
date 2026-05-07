function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "className") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, String(v));
  }
  for (const child of children) {
    if (child) node.appendChild(child);
  }
  return node;
}

function optionNodes(options, placeholder) {
  const nodes = [];
  if (placeholder) nodes.push(el("option", { value: "", text: placeholder }));
  for (const opt of options) nodes.push(el("option", { value: opt.value, text: opt.label }));
  return nodes;
}

function getOptions(schema, field, state, context) {
  if (!field.optionsCategory) return [];
  const cat = schema.optionsCategories?.[field.optionsCategory];
  if (!cat) return [];

  if (typeof cat === "object" && !Array.isArray(cat)) {
    const dependsOn = field.dependsOn;
    const dependsKey = dependsOn?.includes(".")
      ? dependsOn
      : context?.basePath
      ? `${context.basePath}.${dependsOn}`
      : dependsOn;
    const parentVal = dependsKey ? FormEngine.getByPath(state, dependsKey) : null;
    return (cat[parentVal] || cat.other || []).slice();
  }

  return Array.isArray(cat) ? cat.slice() : [];
}

function renderInfoField(field) {
  return el("div", { className: "infoBox" }, [
    el("div", { className: "infoTitle", text: field.label || "Info" }),
    el("div", { className: "infoBody", text: field.content || "" }),
  ]);
}

function renderFieldControl({ schema, section, field, state, itemIndex, onChange }) {
  const sectionKey = section.key;
  const fullKey = FormEngine.getFieldFullKey(sectionKey, field.key, itemIndex);

  const context =
    sectionKey === "dependants" && Number.isInteger(itemIndex)
      ? { basePath: `dependants.items.${itemIndex}` }
      : undefined;

  if (!FormEngine.isFieldVisible(field, state, context)) return null;

  if (field.type === "info") {
    return renderInfoField(field);
  }

  const current = FormEngine.getByPath(state, fullKey);
  const required = FormEngine.isFieldRequired(field, state, context);
  const readonly = !!field.readonly;
  const helperText = field.helperText;

  const labelRow = el("div", { className: "fieldLabelRow" }, [
    el("label", { className: "fieldLabel", for: fullKey, text: field.label || field.key }),
    required ? el("span", { className: "requiredPill", text: "Required" }) : null,
  ]);

  let control = null;

  if (field.type === "text") {
    control = el("input", {
      id: fullKey,
      name: fullKey,
      type: "text",
      value: current ?? field.defaultValue ?? "",
      placeholder: field.placeholder || "",
      disabled: readonly ? "true" : null,
      oninput: (e) => onChange(fullKey, e.target.value),
    });
  } else if (field.type === "date") {
    control = el("input", {
      id: fullKey,
      name: fullKey,
      type: "date",
      value: current ?? "",
      disabled: readonly ? "true" : null,
      oninput: (e) => onChange(fullKey, e.target.value),
    });
  } else if (field.type === "numeric") {
    const raw = current ?? "";
    control = el("input", {
      id: fullKey,
      name: fullKey,
      inputmode: "numeric",
      type: "text",
      value: raw === 0 ? "0" : raw,
      placeholder: field.placeholder || "",
      disabled: readonly ? "true" : null,
      oninput: (e) => {
        onChange(fullKey, e.target.value);
      },
      onblur: (e) => {
        if (field.format === "currency") {
          const num = FormEngine.parseNumber(e.target.value);
          if (num != null) {
            const formatted = FormEngine.formatCurrencyNAD(num);
            onChange(fullKey, formatted);
          }
        }
      },
    });
  } else if (field.type === "boolean") {
    control = el("label", { className: "toggleRow" }, [
      el("input", {
        id: fullKey,
        name: fullKey,
        type: "checkbox",
        checked: current === true ? "true" : null,
        disabled: readonly ? "true" : null,
        onchange: (e) => onChange(fullKey, e.target.checked),
      }),
      el("span", { className: "toggleText", text: field.label || "" }),
    ]);
    return el("div", { className: "field" }, [
      control,
      helperText ? el("div", { className: "helperText", text: helperText }) : null,
      el("div", { className: "errorText", "data-error-for": fullKey }),
    ]);
  } else if (field.type === "dropdown") {
    const opts = getOptions(schema, field, state, context);
    control = el(
      "select",
      {
        id: fullKey,
        name: fullKey,
        disabled: readonly ? "true" : null,
        onchange: (e) => onChange(fullKey, e.target.value),
      },
      optionNodes(opts, "Select...")
    );
    if (current != null && current !== "") control.value = current;
  } else if (field.type === "radio") {
    const opts = getOptions(schema, field, state, context);
    const group = el("div", { className: "radioGroup" });
    for (const opt of opts) {
      const radioId = `${fullKey}__${opt.value}`;
      const input = el("input", {
        id: radioId,
        type: "radio",
        name: fullKey,
        value: opt.value,
        checked: current === opt.value ? "true" : null,
        disabled: readonly ? "true" : null,
        onchange: () => onChange(fullKey, opt.value),
      });
      const lab = el("label", { className: "radioOption", for: radioId }, [
        input,
        el("span", { className: "radioLabel", text: opt.label }),
      ]);
      group.appendChild(lab);
    }
    control = group;
  } else {
    control = el("div", { className: "helperText", text: `Unsupported field type: ${field.type}` });
  }

  return el("div", { className: "field" }, [
    labelRow,
    control,
    helperText ? el("div", { className: "helperText", text: helperText }) : null,
    el("div", { className: "errorText", "data-error-for": fullKey }),
  ]);
}

function renderRepeater({ schema, section, state, onChange, onAddItem, onRemoveItem }) {
  const sectionKey = section.key;
  const basePath = `${sectionKey}.items`;

  const items = FormEngine.getByPath(state, basePath) || [];
  const max = section.maxItems ?? 50;

  const header = el("div", { className: "repeaterHeader" }, [
    el("div", { className: "repeaterTitle", text: section.title }),
    el("div", { className: "repeaterActions" }, [
      el(
        "button",
        {
          type: "button",
          className: "btnSecondary",
          disabled: items.length >= max ? "true" : null,
          onclick: () => onAddItem(),
        },
        [el("span", { text: `+ Add ${section.itemLabel || "Item"}` })]
      ),
    ]),
  ]);

  const desc = section.description
    ? el("div", { className: "sectionDesc", text: section.description })
    : null;

  const list = el("div", { className: "repeaterList" });

  items.forEach((item, idx) => {
    const card = el("div", { className: "repeaterCard" });
    const cardHead = el("div", { className: "repeaterCardHead" }, [
      el("div", {
        className: "repeaterCardTitle",
        text: `${section.itemLabel || "Item"} ${idx + 1}`,
      }),
      el(
        "button",
        {
          type: "button",
          className: "btnDanger",
          onclick: () => onRemoveItem(idx),
        },
        [el("span", { text: "Remove" })]
      ),
    ]);
    card.appendChild(cardHead);

    const body = el("div", { className: "sectionBody" });
    for (const field of section.fields || []) {
      const node = renderFieldControl({ schema, section, field, state, itemIndex: idx, onChange });
      if (node) body.appendChild(node);
    }
    card.appendChild(body);
    list.appendChild(card);
  });

  if (items.length === 0) {
    list.appendChild(
      el("div", { className: "emptyState" }, [
        el("div", { className: "emptyTitle", text: "No dependants added yet." }),
        el("div", {
          className: "emptyBody",
          text: "Add a dependant to capture their details for cover.",
        }),
      ])
    );
  }

  return el("div", { className: "sectionCard" }, [header, desc, list]);
}

function renderSection({ schema, section, state, onChange, repeaterHandlers }) {
  if (section.type === "repeater") {
    return renderRepeater({ schema, section, state, onChange, ...repeaterHandlers });
  }

  const desc = section.description
    ? el("div", { className: "sectionDesc", text: section.description })
    : null;

  const body = el("div", { className: "sectionBody" });

  for (const field of section.fields || []) {
    const node = renderFieldControl({
      schema,
      section,
      field,
      state,
      itemIndex: undefined,
      onChange,
    });
    if (node) body.appendChild(node);
  }

  const header = el("div", { className: "sectionHeader" }, [
    el("div", { className: "sectionTitle", text: section.title }),
  ]);

  return el("div", { className: "sectionCard" }, [header, desc, body]);
}

function renderDocuments({ schema, state, onChange }) {
  const card = el("div", { className: "sectionCard" }, [
    el("div", { className: "sectionHeader" }, [
      el("div", { className: "sectionTitle", text: "Documents" }),
    ]),
    el("div", {
      className: "sectionDesc",
      text: "Attach required supporting documents (demo stores metadata only).",
    }),
  ]);

  const list = el("div", { className: "sectionBody" });
  const docs = schema.documents || [];

  docs.forEach((doc) => {
    const fullKey = `documents.${doc.key}`;
    const visible = FormEngine.evaluateCondition(doc.visibleWhen || doc.requiredWhen, state);
    const required = doc.requiredWhen
      ? FormEngine.evaluateCondition(doc.requiredWhen, state)
      : !!doc.required;

    if (!visible && !required) return;

    const current = FormEngine.getByPath(state, fullKey) || null;
    const row = el("div", { className: "docRow" }, [
      el("div", { className: "docMeta" }, [
        el("div", { className: "docLabel", text: doc.label }),
        doc.helperText ? el("div", { className: "helperText", text: doc.helperText }) : null,
        required ? el("span", { className: "requiredPill", text: "Required" }) : null,
        current ? el("div", { className: "docSelected", text: `Selected: ${current.fileName}` }) : null,
        el("div", { className: "errorText", "data-error-for": fullKey }),
      ]),
      el("div", { className: "docActions" }, [
        el("input", {
          type: "file",
          onchange: (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            onChange(fullKey, {
              fileName: f.name,
              size: f.size,
              type: f.type,
              selectedAt: new Date().toISOString(),
            });
          },
        }),
      ]),
    ]);
    list.appendChild(row);
  });

  card.appendChild(list);
  return card;
}

function renderTerms({ schema, state, onChange }) {
  const tc = schema.termsAndConditions;
  if (!tc) return null;

  const card = el("div", { className: "sectionCard" }, [
    el("div", { className: "sectionHeader" }, [
      el("div", { className: "sectionTitle", text: tc.title || "Terms and Conditions" }),
    ]),
    el("div", { className: "tcBody", text: tc.content || "" }),
  ]);

  const agreeKey = `terms.${tc.key}`;
  const checked = FormEngine.getByPath(state, agreeKey) === true;

  const agree = el("label", { className: "toggleRow" }, [
    el("input", {
      id: agreeKey,
      type: "checkbox",
      checked: checked ? "true" : null,
      onchange: (e) => onChange(agreeKey, e.target.checked),
    }),
    el("span", { className: "toggleText", text: tc.agreementText || "I agree" }),
  ]);

  card.appendChild(
    el("div", { className: "sectionBody" }, [
      agree,
      el("div", { className: "errorText", "data-error-for": agreeKey }),
    ])
  );
  return card;
}

/* -------------------------------------------------------------------- */
/* Helpers for filtering / labels                                       */
/* -------------------------------------------------------------------- */

function isUserSection(section) {
  if (section.type === "repeater") return true;
  const fields = section.fields || [];
  if (fields.length === 0) return false;
  return fields.some((f) => f.userside !== false);
}

function isSectionVisibleNow(section, state) {
  if (!section.visibleWhen) return true;
  return FormEngine.evaluateCondition(section.visibleWhen, state);
}

function getVisibleTabSections(schema, state) {
  return (schema.sections || []).filter((s) => isUserSection(s) && isSectionVisibleNow(s, state));
}

function lookupOptionLabel(schema, optionsCategory, value) {
  if (!optionsCategory || value == null || value === "") return "";
  const cat = schema.optionsCategories?.[optionsCategory];
  if (!Array.isArray(cat)) return value;
  const opt = cat.find((o) => String(o.value) === String(value));
  return opt ? opt.label : value;
}

/* -------------------------------------------------------------------- */
/* Stepper / tabs                                                       */
/* -------------------------------------------------------------------- */

function renderStepper(container, step) {
  container.innerHTML = "";

  const steps = [
    { n: 1, label: "Fill Application Form" },
    { n: 2, label: "Review & Submit" },
  ];

  const row = el("div", { className: "stepperRow" });
  steps.forEach((s, i) => {
    const isActive = step === s.n;
    const isDone = step > s.n;
    const dotClass =
      "stepDot" +
      (isActive ? " stepDot--active" : "") +
      (isDone ? " stepDot--done" : "");
    const labelClass = "stepLabel" + (isActive || isDone ? " stepLabel--active" : "");

    const item = el("div", { className: "stepItem" }, [
      el("div", { className: dotClass, text: isDone ? "\u2713" : String(s.n) }),
      el("div", { className: labelClass, text: s.label }),
    ]);
    row.appendChild(item);

    if (i < steps.length - 1) {
      const line = el("div", {
        className: "stepLine" + (isDone ? " stepLine--done" : ""),
      });
      row.appendChild(line);
    }
  });
  container.appendChild(row);
}

function renderTabs(container, sections, activeIdx, onSelect) {
  container.innerHTML = "";
  sections.forEach((section, i) => {
    const tab = el(
      "button",
      {
        type: "button",
        className: "tab" + (i === activeIdx ? " tab--active" : ""),
        onclick: () => onSelect(i),
      },
      [el("span", { text: section.title })]
    );
    container.appendChild(tab);
  });
}

/* -------------------------------------------------------------------- */
/* Step 2 summary                                                       */
/* -------------------------------------------------------------------- */

function buildSummaryRows(schema, state) {
  const rows = [];
  const coverPlanValue = FormEngine.getByPath(state, "setup_plan.cover_plan");
  const coverPlanLabel = lookupOptionLabel(schema, "cover_plan_options", coverPlanValue) || "—";
  rows.push({ label: "Cover plan", value: coverPlanLabel });

  const selfCover = FormEngine.getByPath(state, "setup_plan.self_cover_amount");
  if (selfCover != null && selfCover !== "") {
    const num = FormEngine.parseNumber(selfCover);
    rows.push({
      label: "Your cover",
      value: num != null ? FormEngine.formatCurrencyNAD(num) : String(selfCover),
    });
  }

  const dependants = FormEngine.getByPath(state, "dependants.items") || [];
  if (coverPlanValue === "myself_and_dependants" || coverPlanValue === "dependants_only") {
    rows.push({ label: "Dependants covered", value: String(dependants.length) });
  }

  const benefits = [];
  if (FormEngine.getByPath(state, "optional_benefits.main_family_supporter")) {
    const amount = lookupOptionLabel(
      schema,
      "family_supporter_amounts",
      FormEngine.getByPath(state, "optional_benefits.main_family_supporter_amount")
    );
    const period = lookupOptionLabel(
      schema,
      "family_supporter_period_options",
      FormEngine.getByPath(state, "optional_benefits.main_family_supporter_period")
    );
    benefits.push(`Family supporter${amount ? " (" + amount + (period ? ", " + period : "") + ")" : ""}`);
  }
  if (FormEngine.getByPath(state, "optional_benefits.main_premium_waiver")) {
    const period = lookupOptionLabel(
      schema,
      "waiver_period_options",
      FormEngine.getByPath(state, "optional_benefits.main_premium_waiver_period")
    );
    benefits.push(`Waiver of Premium${period ? " (" + period + ")" : ""}`);
  }
  if (FormEngine.getByPath(state, "optional_benefits.main_cashback")) {
    benefits.push("Cashback benefit");
  }
  rows.push({ label: "Optional benefits", value: benefits.length ? benefits.join(", ") : "None" });

  rows.push({
    label: "Digital discount",
    value: FormEngine.getByPath(state, "review_quote.digital_discount") || "5%",
  });
  rows.push({
    label: "Nedbank client discount",
    value: FormEngine.getByPath(state, "review_quote.client_discount") || "5%",
  });

  const premium = FormEngine.getByPath(state, "review_quote.total_premium");
  const premiumNum = FormEngine.parseNumber(premium);
  rows.push({
    label: "Total premium",
    value: premiumNum != null ? FormEngine.formatCurrencyNAD(premiumNum) : "—",
    accent: true,
  });

  return rows;
}

function renderStep2(schema, state, onChange) {
  const wrap = el("div", { className: "sectionCard" });

  wrap.appendChild(
    el("div", { className: "sectionHeader" }, [
      el("div", { className: "sectionTitle", text: "Review your application" }),
    ])
  );
  wrap.appendChild(
    el("div", {
      className: "sectionDesc",
      text: "Confirm policy details below, attach required documents and accept terms and conditions before submitting.",
    })
  );

  const grid = el("div", { className: "summaryGrid" });
  buildSummaryRows(schema, state).forEach((row) => {
    grid.appendChild(
      el("div", { className: "summaryRow" }, [
        el("div", { className: "summaryLabel", text: row.label }),
        el("div", {
          className: "summaryValue" + (row.accent ? " summaryValue--accent" : ""),
          text: row.value,
        }),
      ])
    );
  });
  wrap.appendChild(grid);

  const acceptKey = "review_quote.accept_tcs";
  const accepted = FormEngine.getByPath(state, acceptKey) === true;
  const acceptField = (schema.sections || [])
    .find((s) => s.key === "review_quote")
    ?.fields?.find((f) => f.key === "accept_tcs");
  if (acceptField) {
    const label = el(
      "label",
      { className: "toggleRow" },
      [
        el("input", {
          id: acceptKey,
          type: "checkbox",
          checked: accepted ? "true" : null,
          onchange: (e) => onChange(acceptKey, e.target.checked),
        }),
        el("span", { className: "toggleText", text: acceptField.label }),
      ]
    );
    wrap.appendChild(
      el("div", { className: "summarySubsection" }, [
        label,
        el("div", { className: "errorText", "data-error-for": acceptKey }),
      ])
    );
  }

  return wrap;
}

/* -------------------------------------------------------------------- */
/* Validation                                                           */
/* -------------------------------------------------------------------- */

function clearErrors(root) {
  root.querySelectorAll("[data-error-for]").forEach((n) => (n.textContent = ""));
}

function setError(root, fullKey, message) {
  const node = root.querySelector(`[data-error-for="${CSS.escape(fullKey)}"]`);
  if (node) node.textContent = message || "";
}

function validateAll(schema, state, root) {
  clearErrors(root);
  let ok = true;

  const visibleSections = getVisibleTabSections(schema, state);
  const sectionInvalid = new Map();

  for (const section of schema.sections || []) {
    if (!isSectionVisibleNow(section, state)) continue;

    if (section.type === "repeater") {
      const items = FormEngine.getByPath(state, "dependants.items") || [];
      for (let idx = 0; idx < items.length; idx++) {
        const context = { basePath: `dependants.items.${idx}` };
        for (const field of section.fields || []) {
          const fullKey = FormEngine.getFieldFullKey(section.key, field.key, idx);
          const val = FormEngine.getByPath(state, fullKey);
          const err = FormEngine.validateField(field, val, state, context);
          if (err) {
            ok = false;
            sectionInvalid.set(section.key, true);
            setError(root, fullKey, err);
          }
        }
      }
    } else {
      for (const field of section.fields || []) {
        const fullKey = FormEngine.getFieldFullKey(section.key, field.key);
        const val = FormEngine.getByPath(state, fullKey);
        const err = FormEngine.validateField(field, val, state);
        if (err) {
          ok = false;
          sectionInvalid.set(section.key, true);
          setError(root, fullKey, err);
        }
      }
    }
  }

  (schema.documents || []).forEach((doc) => {
    const required = doc.requiredWhen
      ? FormEngine.evaluateCondition(doc.requiredWhen, state)
      : !!doc.required;
    const visible = FormEngine.evaluateCondition(doc.visibleWhen || doc.requiredWhen, state);
    if (!required && !visible) return;

    const fullKey = `documents.${doc.key}`;
    const val = FormEngine.getByPath(state, fullKey);
    if (required && !val) {
      ok = false;
      setError(root, fullKey, "This document is required.");
    }
  });

  if (schema.termsAndConditions?.key) {
    const agreeKey = `terms.${schema.termsAndConditions.key}`;
    const agreed = FormEngine.getByPath(state, agreeKey) === true;
    if (!agreed) {
      ok = false;
      setError(root, agreeKey, "Please accept the terms and conditions.");
    }
  }

  let firstInvalidSectionIdx = -1;
  for (let i = 0; i < visibleSections.length; i++) {
    if (sectionInvalid.has(visibleSections[i].key)) {
      firstInvalidSectionIdx = i;
      break;
    }
  }

  return { ok, firstInvalidSectionIdx };
}

/* -------------------------------------------------------------------- */
/* Top-level render                                                     */
/* -------------------------------------------------------------------- */

const uiState = { step: 1, activeTabIdx: 0 };

function getStep() {
  return uiState.step;
}

let lastRenderArgs = null;

function rerenderInternal() {
  if (!lastRenderArgs) return;
  renderApplicationForm(lastRenderArgs);
}

function goToStep(n) {
  uiState.step = n;
  rerenderInternal();
}

function setActiveTab(i) {
  uiState.activeTabIdx = i;
  rerenderInternal();
}

function renderApplicationForm(args) {
  lastRenderArgs = args;
  const { schema, state, mounts, onChange, repeaterHandlers } = args;

  const stepperEl = mounts.stepper;
  const tabsEl = mounts.tabs;
  const panelEl = mounts.tabPanel;

  const visibleSections = getVisibleTabSections(schema, state);

  if (uiState.activeTabIdx >= visibleSections.length) {
    uiState.activeTabIdx = Math.max(0, visibleSections.length - 1);
  }

  renderStepper(stepperEl, uiState.step);

  if (uiState.step === 1) {
    tabsEl.hidden = false;
    renderTabs(tabsEl, visibleSections, uiState.activeTabIdx, (i) => setActiveTab(i));

    panelEl.innerHTML = "";
    const activeSection = visibleSections[uiState.activeTabIdx];
    if (activeSection) {
      const node = renderSection({
        schema,
        section: activeSection,
        state,
        onChange,
        repeaterHandlers,
      });
      if (node) panelEl.appendChild(node);
    }
  } else {
    tabsEl.hidden = true;
    tabsEl.innerHTML = "";

    panelEl.innerHTML = "";
    panelEl.appendChild(renderStep2(schema, state, onChange));

    const docs = renderDocuments({ schema, state, onChange });
    if (docs) {
      docs.classList.add("summarySubsection");
      panelEl.appendChild(docs);
    }

    const tc = renderTerms({ schema, state, onChange });
    if (tc) {
      tc.classList.add("summarySubsection");
      panelEl.appendChild(tc);
    }
  }

  return {
    validate: () => validateAll(schema, state, panelEl),
    getStep,
    goToStep,
    setActiveTab,
    getVisibleSectionCount: () => visibleSections.length,
  };
}

window.RenderForm = {
  renderApplicationForm,
  getStep,
  goToStep,
  setActiveTab,
};

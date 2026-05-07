function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "className") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, String(v));
  }
  for (const child of children) node.appendChild(child);
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

  // dependent branches: cat can be an object keyed by parent value
  if (typeof cat === "object" && !Array.isArray(cat)) {
    const dependsOn = field.dependsOn;
    const dependsKey = dependsOn?.includes(".") ? dependsOn : context?.basePath ? `${context.basePath}.${dependsOn}` : dependsOn;
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

  const context = sectionKey === "dependants" && Number.isInteger(itemIndex)
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
    required ? el("span", { className: "requiredPill", text: "Required" }) : el("span"),
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
        // store raw text; engine parses for validation/derived
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
    // label already included in toggle row; skip duplicate
    return el("div", { className: "field" }, [
      control,
      helperText ? el("div", { className: "helperText", text: helperText }) : el("span"),
      el("div", { className: "errorText", "data-error-for": fullKey }),
    ]);
  } else if (field.type === "dropdown") {
    const opts = getOptions(schema, field, state, context);
    control = el("select", { id: fullKey, name: fullKey, disabled: readonly ? "true" : null, onchange: (e) => onChange(fullKey, e.target.value) }, optionNodes(opts, "Select..."));
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
    helperText ? el("div", { className: "helperText", text: helperText }) : el("span"),
    el("div", { className: "errorText", "data-error-for": fullKey }),
  ]);
}

function renderRepeater({ schema, section, state, onChange, onAddItem, onRemoveItem }) {
  const sectionKey = section.key;
  const basePath = `${sectionKey}.items`;

  const visible = FormEngine.evaluateCondition(section.visibleWhen, state);
  if (!visible) return null;

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
        [el("span", { text: `Add ${section.itemLabel || "Item"}` })]
      ),
    ]),
  ]);

  const desc = section.description ? el("div", { className: "sectionDesc", text: section.description }) : el("span");

  const list = el("div", { className: "repeaterList" });

  items.forEach((item, idx) => {
    const card = el("div", { className: "repeaterCard" });
    const cardHead = el("div", { className: "repeaterCardHead" }, [
      el("div", { className: "repeaterCardTitle", text: `${section.itemLabel || "Item"} ${idx + 1}` }),
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

    for (const field of section.fields || []) {
      const node = renderFieldControl({ schema, section, field, state, itemIndex: idx, onChange });
      if (node) card.appendChild(node);
    }
    list.appendChild(card);
  });

  if (items.length === 0) {
    list.appendChild(
      el("div", { className: "emptyState" }, [
        el("div", { className: "emptyTitle", text: "No dependants added yet." }),
        el("div", { className: "emptyBody", text: "Add a dependant to capture their details for cover." }),
      ])
    );
  }

  return el("div", { className: "sectionCard" }, [header, desc, list]);
}

function renderSection({ schema, section, state, onChange, repeaterHandlers }) {
  if (section.type === "repeater") {
    return renderRepeater({ schema, section, state, onChange, ...repeaterHandlers });
  }

  const header = el("div", { className: "sectionHeader" }, [
    el("div", { className: "sectionTitle", text: section.title }),
  ]);
  const desc = section.description ? el("div", { className: "sectionDesc", text: section.description }) : el("span");

  const body = el("div", { className: "sectionBody" });

  for (const field of section.fields || []) {
    const node = renderFieldControl({ schema, section, field, state, itemIndex: undefined, onChange });
    if (node) body.appendChild(node);
  }

  return el("div", { className: "sectionCard" }, [header, desc, body]);
}

function renderDocuments({ schema, state, onChange }) {
  const card = el("div", { className: "sectionCard" }, [
    el("div", { className: "sectionHeader" }, [el("div", { className: "sectionTitle", text: "Documents" })]),
    el("div", { className: "sectionDesc", text: "Attach required supporting documents (demo stores metadata only)." }),
  ]);

  const list = el("div", { className: "sectionBody" });
  const docs = schema.documents || [];

  docs.forEach((doc) => {
    const fullKey = `documents.${doc.key}`;
    const visible = FormEngine.evaluateCondition(doc.visibleWhen || doc.requiredWhen, state);
    const required = doc.requiredWhen ? FormEngine.evaluateCondition(doc.requiredWhen, state) : !!doc.required;

    if (!visible && !required) return;

    const current = FormEngine.getByPath(state, fullKey) || null;
    const row = el("div", { className: "docRow" }, [
      el("div", { className: "docMeta" }, [
        el("div", { className: "docLabel", text: doc.label }),
        doc.helperText ? el("div", { className: "helperText", text: doc.helperText }) : el("span"),
        required ? el("span", { className: "requiredPill", text: "Required" }) : el("span"),
      ]),
      el("div", { className: "docActions" }, [
        el("input", {
          type: "file",
          onchange: (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            onChange(fullKey, { fileName: f.name, size: f.size, type: f.type, selectedAt: new Date().toISOString() });
          },
        }),
        current ? el("div", { className: "docSelected", text: `Selected: ${current.fileName}` }) : el("span"),
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
    el("div", { className: "sectionHeader" }, [el("div", { className: "sectionTitle", text: tc.title || "Terms and Conditions" })]),
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

  card.appendChild(el("div", { className: "sectionBody" }, [agree, el("div", { className: "errorText", "data-error-for": agreeKey })]));
  return card;
}

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

  for (const section of schema.sections || []) {
    if (section.type === "repeater") {
      const visible = FormEngine.evaluateCondition(section.visibleWhen, state);
      if (!visible) continue;

      const items = FormEngine.getByPath(state, "dependants.items") || [];
      for (let idx = 0; idx < items.length; idx++) {
        const context = { basePath: `dependants.items.${idx}` };
        for (const field of section.fields || []) {
          const fullKey = FormEngine.getFieldFullKey(section.key, field.key, idx);
          const val = FormEngine.getByPath(state, fullKey);
          const err = FormEngine.validateField(field, val, state, context);
          if (err) {
            ok = false;
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
          setError(root, fullKey, err);
        }
      }
    }
  }

  // documents: required checks
  (schema.documents || []).forEach((doc) => {
    const required = doc.requiredWhen ? FormEngine.evaluateCondition(doc.requiredWhen, state) : !!doc.required;
    const visible = FormEngine.evaluateCondition(doc.visibleWhen || doc.requiredWhen, state);
    if (!required && !visible) return;

    const fullKey = `documents.${doc.key}`;
    const val = FormEngine.getByPath(state, fullKey);
    if (required && !val) {
      ok = false;
      setError(root, fullKey, "This document is required.");
    }
  });

  // terms
  if (schema.termsAndConditions?.key) {
    const agreeKey = `terms.${schema.termsAndConditions.key}`;
    const agreed = FormEngine.getByPath(state, agreeKey) === true;
    if (!agreed) {
      ok = false;
      setError(root, agreeKey, "Please accept the terms and conditions.");
    }
  }

  return ok;
}

function renderApplicationForm({ schema, state, mount, onChange, repeaterHandlers }) {
  mount.innerHTML = "";

  const header = el("div", { className: "appHeader" }, [
    el("div", { className: "appTitle", text: schema.title || "Application" }),
    el("div", { className: "appSubtitle", text: schema.description || "" }),
  ]);

  const sectionsWrap = el("div", { className: "sectionsWrap" });
  for (const section of schema.sections || []) {
    const node = renderSection({ schema, section, state, onChange, repeaterHandlers });
    if (node) sectionsWrap.appendChild(node);
  }

  const docs = renderDocuments({ schema, state, onChange });
  if (docs) sectionsWrap.appendChild(docs);

  const tc = renderTerms({ schema, state, onChange });
  if (tc) sectionsWrap.appendChild(tc);

  mount.appendChild(header);
  mount.appendChild(sectionsWrap);

  return {
    validate: () => validateAll(schema, state, mount),
  };
}

window.RenderForm = {
  renderApplicationForm,
};


function normalizePath(path) {
  if (!path) return "";
  return String(path).replace(/\[(\d+)\]/g, ".$1");
}

function getByPath(obj, path) {
  const p = normalizePath(path);
  if (!p) return obj;
  const parts = p.split(".").filter(Boolean);
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function setByPath(obj, path, value) {
  const p = normalizePath(path);
  const parts = p.split(".").filter(Boolean);
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const nextKey = parts[i + 1];
    const isNextIndex = /^[0-9]+$/.test(nextKey);
    if (cur[key] == null) cur[key] = isNextIndex ? [] : {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
}

function truthyEq(a, b) {
  return a === b;
}

function evaluatePredicate(predicate, state, context) {
  const { fieldKey, operator, value } = predicate || {};
  if (!fieldKey || !operator) return true;

  // fieldKey can be absolute (section.field) or relative inside repeater item
  const lookupKey = fieldKey.includes(".") ? fieldKey : context?.basePath ? `${context.basePath}.${fieldKey}` : fieldKey;
  const actual = getByPath(state, lookupKey);

  switch (operator) {
    case "eq":
      return truthyEq(actual, value);
    case "neq":
      return !truthyEq(actual, value);
    case "in":
      return Array.isArray(value) ? value.includes(actual) : false;
    default:
      return false;
  }
}

function evaluateCondition(condition, state, context) {
  if (!condition) return true;
  if (condition.all) return condition.all.every((p) => evaluatePredicate(p, state, context));
  if (condition.any) return condition.any.some((p) => evaluatePredicate(p, state, context));
  return true;
}

function formatCurrencyNAD(value) {
  if (value === "" || value == null) return "";
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  if (Number.isNaN(num)) return "";
  return `N$ ${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function parseNumber(value) {
  if (value === "" || value == null) return null;
  const num = Number(String(value).replace(/[^\d.-]/g, ""));
  if (Number.isNaN(num)) return null;
  return num;
}

function computeDerivedFields(schema, state) {
  // review_quote: simple demo derivations
  const coverPlan = getByPath(state, "setup_plan.cover_plan");
  const dependants = getByPath(state, "dependants.items") || [];

  setByPath(state, "review_quote.plan_label", coverPlan || "");
  setByPath(state, "review_quote.dependants_count_view", String(dependants.length));

  // total_premium: demo-only placeholder (not actuarial)
  const selfCover = parseNumber(getByPath(state, "setup_plan.self_cover_amount")) || 0;
  const depCover = dependants.reduce((sum, d) => sum + (parseNumber(d.cover_amount) || 0), 0);
  const base = selfCover + depCover;
  const premium = Math.round(base * 0.004); // 0.4% demo rate
  setByPath(state, "review_quote.total_premium", premium || 0);
}

function getFieldFullKey(sectionKey, fieldKey, itemIndex) {
  if (sectionKey === "dependants" && Number.isInteger(itemIndex)) {
    return `dependants.items.${itemIndex}.${fieldKey}`;
  }
  return `${sectionKey}.${fieldKey}`;
}

function isFieldVisible(field, state, context) {
  return evaluateCondition(field.visibleWhen, state, context);
}

function isFieldRequired(field, state, context) {
  if (field.requiredWhen) return evaluateCondition(field.requiredWhen, state, context);
  return !!field.required;
}

function validateField(field, value, state, context) {
  if (!isFieldVisible(field, state, context)) return null;

  const required = isFieldRequired(field, state, context);

  if (required) {
    if (field.type === "boolean") {
      if (value !== true) return "This field is required.";
    } else if (value == null || value === "") {
      return "This field is required.";
    }
  }

  if (field.type === "numeric") {
    const num = parseNumber(value);
    if (num == null) return required ? "Enter a number." : null;
    if (field.min != null && num < field.min) return `Minimum is ${formatCurrencyNAD(field.min)}.`;
    if (field.max != null && num > field.max) return `Maximum is ${formatCurrencyNAD(field.max)}.`;
  }

  if (field.validation?.pattern && value) {
    const re = new RegExp(field.validation.pattern);
    if (!re.test(String(value))) return field.validation.message || "Invalid format.";
  }

  return null;
}

window.FormEngine = {
  getByPath,
  setByPath,
  evaluateCondition,
  isFieldVisible,
  isFieldRequired,
  validateField,
  formatCurrencyNAD,
  parseNumber,
  computeDerivedFields,
  getFieldFullKey,
};


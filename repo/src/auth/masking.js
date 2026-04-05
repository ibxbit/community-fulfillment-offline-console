export function maskAddress(address) {
  if (typeof address !== "string" || address.trim().length === 0) {
    return "";
  }

  const trimmed = address.trim();
  if (trimmed.length <= 8) {
    return "****";
  }

  const visiblePrefix = trimmed.slice(0, 6);
  const visibleSuffix = trimmed.slice(-4);
  return `${visiblePrefix}...${visibleSuffix}`;
}

export function maskSensitiveValue(value, visibleStart = 2, visibleEnd = 2) {
  const raw = String(value ?? "");
  if (raw.length <= visibleStart + visibleEnd) {
    return "*".repeat(raw.length);
  }

  const start = raw.slice(0, visibleStart);
  const end = raw.slice(raw.length - visibleEnd);
  const middle = "*".repeat(raw.length - (visibleStart + visibleEnd));
  return `${start}${middle}${end}`;
}

const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /credential/i,
  /api[_-]?key/i,
];

function isSensitiveFieldName(fieldName) {
  return SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(fieldName));
}

export function maskSensitiveFields(value) {
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveFields(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const masked = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (isSensitiveFieldName(key)) {
      masked[key] = maskSensitiveValue(fieldValue ?? "", 1, 1);
      continue;
    }

    masked[key] = maskSensitiveFields(fieldValue);
  }

  return masked;
}

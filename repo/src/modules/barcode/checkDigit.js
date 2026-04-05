function toDigits(code) {
  return String(code ?? "")
    .replace(/\s+/g, "")
    .split("")
    .map((char) => Number(char));
}

function hasOnlyDigits(code) {
  return /^\d+$/.test(code);
}

function validateLuhn(code) {
  if (!hasOnlyDigits(code) || code.length < 2) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let i = code.length - 1; i >= 0; i -= 1) {
    let digit = Number(code[i]);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

function validateMod11(code) {
  if (!hasOnlyDigits(code) || code.length < 2) {
    return false;
  }

  const digits = toDigits(code);
  const checkDigit = digits.pop();
  let weight = 2;
  let sum = 0;

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    sum += digits[i] * weight;
    weight = weight === 7 ? 2 : weight + 1;
  }

  const remainder = sum % 11;
  const expected = remainder === 0 ? 0 : 11 - remainder;
  return expected < 10 && expected === checkDigit;
}

export function validateBarcode(code, config) {
  const normalized = String(code ?? "").trim();
  if (!normalized) {
    return { ok: false, reason: "Barcode is empty" };
  }

  const algorithm = config?.algorithm ?? "none";
  const expectedLength = Number(config?.expectedLength ?? 0);

  if (expectedLength > 0 && normalized.length !== expectedLength) {
    return { ok: false, reason: `Expected length ${expectedLength}` };
  }

  if (algorithm === "none") {
    return { ok: true, reason: null };
  }

  const validator = algorithm === "luhn" ? validateLuhn : validateMod11;
  const valid = validator(normalized);

  return {
    ok: valid,
    reason: valid
      ? null
      : `Failed ${algorithm.toUpperCase()} check-digit validation`,
  };
}

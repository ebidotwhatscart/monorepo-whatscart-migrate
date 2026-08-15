const INDIAN_MOBILE_NUMBER_PATTERN = /^[6-9]\d{9}$/;

export function normalizeIndianWhatsappPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const localNumber =
    digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;

  if (!INDIAN_MOBILE_NUMBER_PATTERN.test(localNumber)) {
    return null;
  }

  return `91${localNumber}`;
}

export function isValidIndianWhatsappPhone(value: string) {
  return normalizeIndianWhatsappPhone(value) !== null;
}

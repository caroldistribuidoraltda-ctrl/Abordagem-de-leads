/**
 * Cleans phone number and formats it for WhatsApp wa.me links
 */
export function sanitizePhoneForWhatsApp(raw: string): string {
  if (!raw) return '';
  // Remove all non-digits
  const digits = raw.replace(/\D/g, '');

  if (!digits) return '';

  // If already starts with 55 and has 12 or 13 digits (Brazil)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  // Common Brazilian numbers without DDI (10 or 11 digits: e.g. 11999998888)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  // If 8 or 9 digits without DDD, we can't reliably guess the DDD, but preserve digits with 55
  if (digits.length === 8 || digits.length === 9) {
    return `55${digits}`;
  }

  // If international or longer
  return digits;
}

/**
 * Pretty formats phone number for UI display
 */
export function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;

  // If starts with 55 and has 12 or 13 digits
  let national = digits;
  if (digits.startsWith('55') && digits.length >= 12) {
    national = digits.substring(2);
  }

  if (national.length === 11) {
    // (DD) 9XXXX-XXXX
    return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  } else if (national.length === 10) {
    // (DD) XXXX-XXXX
    return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  }

  return raw;
}

/**
 * Builds the WhatsApp direct chat link
 */
export function buildWhatsAppLink(phone: string, message?: string): string {
  const clean = sanitizePhoneForWhatsApp(phone);
  if (!clean) return '#';
  if (!message || message.trim() === '') {
    return `https://wa.me/${clean}`;
  }
  return `https://wa.me/${clean}?text=${encodeURIComponent(message.trim())}`;
}

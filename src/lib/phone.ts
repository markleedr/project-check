/** Numbers without a country code are treated as Australian. A + or 00 prefix is never reinterpreted. */
export const DEFAULT_COUNTRY_CODE = '61';

const E164 = /^\+[1-9]\d{6,14}$/;

function candidatesIn(cell: string): string[] {
  return cell
    .split(/[;|\n\r]+|\s+or\s+/i)
    .map((c) => c.trim())
    .filter(Boolean);
}

function toE164(candidate: string): string | null {
  const cleaned = candidate
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u00A0\u2000-\u200B\u202F\u2060]/g, ' ')
    .replace(/\([^)]*[a-z][^)]*\)/gi, ' ')
    .replace(/(\d)\s*(?:ext|extn|x)\.?\s*\d+\s*$/i, '$1');

  const token = cleaned.match(/\+?[\d\s\-().]*\d/)?.[0];
  if (!token) return null;

  const hasPlus = token.trimStart().startsWith('+');
  let digits = token.replace(/\D/g, '');
  if (!digits) return null;

  const cc = DEFAULT_COUNTRY_CODE;
  let e164: string;

  if (hasPlus) {
    if (digits.startsWith(cc + '0')) digits = cc + digits.slice(cc.length + 1);
    e164 = `+${digits}`;
  } else if (digits.startsWith('00')) {
    e164 = `+${digits.slice(2)}`;
  } else if (digits.startsWith('0')) {
    e164 = `+${cc}${digits.slice(1)}`;
  } else if (digits.startsWith(cc) && digits.length >= cc.length + 6) {
    e164 = `+${digits}`;
  } else if (digits.length <= 10) {
    e164 = `+${cc}${digits}`;
  } else {
    e164 = `+${digits}`;
  }

  return E164.test(e164) ? e164 : null;
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  for (const candidate of candidatesIn(phone)) {
    const e164 = toE164(candidate);
    if (e164) return e164;
  }
  return null;
}

/** Last nine digits of the national number. Used as the join key before hashing. */
export function phoneJoinDigits(phone: string | null | undefined): string | null {
  const e164 = normalizePhone(phone);
  if (!e164) return null;
  const digits = e164.replace(/\D/g, '');
  if (digits.length < 9) return null;
  return digits.slice(-9);
}

import { hashEmail, hashPhoneDigits } from './hash';
import { phoneJoinDigits } from './phone';
import type { WashedEnquiry, WashedSale } from './wash';

function looksLikeEmail(value: string): boolean {
  return /@/.test(value);
}

function hits(token: string, rows: Array<{ token: string; emailToken: string | null }>): boolean {
  return rows.some((r) => r.token === token || r.emailToken === token);
}

/** Spot-check a phone or email against washed marketing and sales rows. */
export async function spotCheckMessage(
  raw: string,
  enquiries: WashedEnquiry[],
  sales: WashedSale[],
): Promise<string> {
  const value = raw.trim();
  if (!value) return 'Enter a phone number or email from your original file.';

  let token: string;
  let noun: string;
  if (looksLikeEmail(value)) {
    token = await hashEmail(value);
    noun = 'email';
  } else {
    const digits = phoneJoinDigits(value);
    if (!digits) return 'That does not look like a phone number or email.';
    token = await hashPhoneDigits(digits);
    noun = 'number';
  }

  const marketingHit = hits(token, enquiries);
  const salesHit = hits(token, sales);
  if (marketingHit && salesHit) {
    return `This ${noun} matches a marketing row and a sales row. They will join.`;
  }
  if (marketingHit) return `This ${noun} matches a marketing enquiry only.`;
  if (salesHit) return `This ${noun} matches a sales row only (offline or unmatched).`;
  return `No match in the washed files.`;
}

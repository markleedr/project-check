/** Funnel stages stored as a CRM/Asana pipeline label instead of dated columns. */

export interface FunnelFlags {
  visit: boolean;
  eoi: boolean;
  contract: boolean;
}

export function funnelFromStatus(status: string | null): FunnelFlags {
  if (!status) return { visit: false, eoi: false, contract: false };
  const s = status.toLowerCase().trim();
  const lost = /crash|cancelled|canceled|lost|dead lead|unqualified/.test(s);
  const visit = !lost && /site tour|site visit|\btour\b|inspection/.test(s);
  const eoi = !lost && !/cancel/.test(s) && /\beoi\b|expression of interest|reservation/.test(s);
  const contract =
    !lost && /settled|unconditional|contract signed|contract issued|\bsold\b/.test(s);
  return { visit, eoi, contract };
}

export function isWonContract(status: string | null, contractDate: string | null): boolean {
  if (funnelFromStatus(status).contract) return true;
  if (status && /crash|cancelled|canceled|lost/.test(status.toLowerCase())) return false;
  return Boolean(contractDate);
}

export function firstFilledDate(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    if (v && String(v).trim()) return String(v).trim();
  }
  return null;
}

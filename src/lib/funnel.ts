/** Funnel stages stored as a CRM/Asana pipeline label instead of dated columns. */

export interface FunnelFlags {
  visit: boolean;
  eoi: boolean;
  contract: boolean;
  /** Settled is its own stage. A settled buyer has also contracted. */
  settlement: boolean;
}

export function funnelFromStatus(status: string | null): FunnelFlags {
  if (!status) return { visit: false, eoi: false, contract: false, settlement: false };
  const s = status.toLowerCase().trim();
  const lost = /crash|cancelled|canceled|lost|dead lead|unqualified/.test(s);
  const visit = !lost && /site tour|site visit|\btour\b|inspection/.test(s);
  const eoi = !lost && !/cancel/.test(s) && /\beoi\b|expression of interest|reservation/.test(s);
  const settlement = !lost && /\bsettled\b|settlement/.test(s);
  const contract =
    settlement ||
    (!lost && /unconditional|contract signed|contract issued|\bsold\b/.test(s));
  return { visit, eoi, contract, settlement };
}

export function isWonContract(
  status: string | null,
  contractDate: string | null,
  settlementDate: string | null = null,
): boolean {
  const flags = funnelFromStatus(status);
  if (flags.contract || flags.settlement) return true;
  if (status && /crash|cancelled|canceled|lost/.test(status.toLowerCase())) return false;
  return Boolean(contractDate || settlementDate);
}

/** A settlement date or a settled status. Does not treat a contract as settled. */
export function isSettled(status: string | null, settlementDate: string | null): boolean {
  if (funnelFromStatus(status).settlement) return true;
  if (status && /crash|cancelled|canceled|lost/.test(status.toLowerCase())) return false;
  return Boolean(settlementDate);
}

export function firstFilledDate(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    if (v && String(v).trim()) return String(v).trim();
  }
  return null;
}

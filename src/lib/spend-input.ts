import type { ColumnRole } from './columns';
import { AD_PLATFORMS, type AdPlatformId } from './platforms';
import type { WashedSpend } from './wash';

export function parseMoneyInput(raw: string): number {
  const n = Number(raw.replace(/[^0-9.-]/g, ''));
  return raw.trim() && Number.isFinite(n) && n > 0 ? n : 0;
}

export function spendOverlapMessages(input: {
  unified: string;
  amounts: Partial<Record<AdPlatformId, string>>;
  hasFile: Partial<Record<AdPlatformId, boolean>>;
}): string[] {
  const messages: string[] = [];
  const unified = parseMoneyInput(input.unified);
  const typedPlatforms = AD_PLATFORMS.filter((p) => parseMoneyInput(input.amounts[p.id] ?? '') > 0);
  const filePlatforms = AD_PLATFORMS.filter((p) => input.hasFile[p.id]);

  if (unified > 0 && (typedPlatforms.length > 0 || filePlatforms.length > 0)) {
    messages.push(
      'You entered one total and also added platform spend. Those amounts will be added together and will overstate cost. Use the total or the platforms, not both.',
    );
  }

  for (const p of AD_PLATFORMS) {
    if (parseMoneyInput(input.amounts[p.id] ?? '') > 0 && input.hasFile[p.id]) {
      messages.push(`${p.label}: you typed a total and uploaded a file. Use one or the other for this platform.`);
    }
  }

  return messages;
}

export function collectSpendRows(input: {
  unified: string;
  amounts: Partial<Record<AdPlatformId, string>>;
  fromFiles: Partial<Record<AdPlatformId, WashedSpend[]>>;
}): WashedSpend[] {
  const rows: WashedSpend[] = [];
  const unified = parseMoneyInput(input.unified);
  if (unified > 0) {
    rows.push({ campaign: null, source: 'all platforms', amount: unified, date: null });
  }
  for (const p of AD_PLATFORMS) {
    const typed = parseMoneyInput(input.amounts[p.id] ?? '');
    if (typed > 0) {
      rows.push({ campaign: null, source: p.id, amount: typed, date: null });
    }
    rows.push(...(input.fromFiles[p.id] ?? []));
  }
  return rows;
}

export function mappedSpendTotal(
  records: Record<string, string>[],
  mapping: Record<string, ColumnRole>,
): number {
  const header = Object.keys(mapping).find((h) => mapping[h] === 'spend');
  if (!header) return 0;
  return records.reduce((sum, row) => sum + parseMoneyInput(row[header] ?? ''), 0);
}

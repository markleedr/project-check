import type { ColumnRole } from './columns';
import { AD_PLATFORMS, type AdPlatformId } from './platforms';
import type { WashedSpend } from './wash';

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

export interface MonthlySpendEntry {
  month: string;
  amounts: Partial<Record<AdPlatformId, string>>;
}

/** Bucket a spend or enquiry date into YYYY-MM. Returns null when the value is not a month. */
export function monthKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?(?:[T\s].*)?$/);
  if (iso) return packMonth(iso[1], Number(iso[2]));

  const ymdSlash = s.match(/^(\d{4})\/(\d{1,2})(?:\/\d{1,2})?$/);
  if (ymdSlash) return packMonth(ymdSlash[1], Number(ymdSlash[2]));

  const monthYear = s.match(/^(\d{1,2})[/\-.](\d{4})$/);
  if (monthYear) return packMonth(monthYear[2], Number(monthYear[1]));

  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    const first = Number(dmy[1]);
    const second = Number(dmy[2]);
    const month = first > 12 ? second : second > 12 ? first : second;
    return packMonth(dmy[3], month);
  }

  const named = s.match(/^([A-Za-z]+)[\s\-/]+(\d{4})$/);
  if (named) {
    const month = monthFromName(named[1]);
    if (month) return packMonth(named[2], month);
  }

  const yearNamed = s.match(/^(\d{4})[\s\-/]+([A-Za-z]+)$/);
  if (yearNamed) {
    const month = monthFromName(yearNamed[2]);
    if (month) return packMonth(yearNamed[1], month);
  }

  const dayNamed = s.match(/^\d{1,2}\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dayNamed) {
    const month = monthFromName(dayNamed[1]);
    if (month) return packMonth(dayNamed[2], month);
  }

  return null;
}

function packMonth(year: string, month: number): string | null {
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function monthFromName(name: string): number | null {
  const n = name.toLowerCase().replace(/[^a-z]/g, '');
  if (n.length < 3) return null;
  const idx = MONTH_NAMES.findIndex((m) => m === n || m.startsWith(n));
  return idx >= 0 ? idx + 1 : null;
}

export function monthlyEntriesToSpend(entries: MonthlySpendEntry[]): WashedSpend[] {
  const rows: WashedSpend[] = [];
  for (const entry of entries) {
    const month = monthKey(entry.month);
    if (!month) continue;
    for (const p of AD_PLATFORMS) {
      const amount = parseMoneyInput(entry.amounts[p.id] ?? '');
      if (amount > 0) {
        rows.push({ campaign: null, source: p.id, amount, date: `${month}-01` });
      }
    }
  }
  return rows;
}

export function parseMoneyInput(raw: string): number {
  const n = Number(raw.replace(/[^0-9.-]/g, ''));
  return raw.trim() && Number.isFinite(n) && n > 0 ? n : 0;
}

export function spendOverlapMessages(input: {
  unified: string;
  amounts: Partial<Record<AdPlatformId, string>>;
  hasFile: Partial<Record<AdPlatformId, boolean>>;
  monthly?: MonthlySpendEntry[];
}): string[] {
  const messages: string[] = [];
  const unified = parseMoneyInput(input.unified);
  const typedPlatforms = AD_PLATFORMS.filter((p) => parseMoneyInput(input.amounts[p.id] ?? '') > 0);
  const filePlatforms = AD_PLATFORMS.filter((p) => input.hasFile[p.id]);
  const monthlyTotal = monthlyEntriesToSpend(input.monthly ?? []).reduce((sum, row) => sum + row.amount, 0);

  if (unified > 0 && (typedPlatforms.length > 0 || filePlatforms.length > 0)) {
    messages.push(
      'You entered one total and also added platform spend. Those amounts will be added together and will overstate cost. Use the total or the platforms, not both.',
    );
  }

  if (monthlyTotal > 0 && (unified > 0 || typedPlatforms.length > 0 || filePlatforms.length > 0)) {
    messages.push(
      'You entered monthly spend and also added a total or a file. Those amounts will be added together and will overstate cost. Use the monthly grid or the other spend, not both.',
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
  monthly?: MonthlySpendEntry[];
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
  rows.push(...monthlyEntriesToSpend(input.monthly ?? []));
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

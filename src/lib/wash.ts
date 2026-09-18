import { ColumnRole, FileKind, PII_ROLES } from './columns';
import { hashEmail, hashPhoneDigits } from './hash';
import { phoneJoinDigits } from './phone';

export interface WashedEnquiry {
  token: string;
  crmId: string | null;
  postcode: string | null;
  suburb: string | null;
  enquiryDate: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  source: string | null;
}

export interface WashedSale {
  token: string;
  crmId: string | null;
  postcode: string | null;
  suburb: string | null;
  enquiryDate: string | null;
  visitDate: string | null;
  eoiDate: string | null;
  contractDate: string | null;
  salesSourceTag: string | null;
  isContract: boolean;
}

export interface WashedSpend {
  campaign: string | null;
  source: string | null;
  amount: number;
  date: string | null;
}

export interface WashedAd {
  platform: string | null;
  campaign: string | null;
  adset: string | null;
  adName: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  date: string | null;
}

export interface WashResult {
  kind: FileKind;
  droppedColumns: string[];
  keptColumns: string[];
  rowCount: number;
  skippedNoJoinKey: number;
  sample: Record<string, string | number | boolean | null>[];
  enquiries?: WashedEnquiry[];
  sales?: WashedSale[];
  spend?: WashedSpend[];
  ads?: WashedAd[];
}

function cell(record: Record<string, string>, mapping: Record<string, ColumnRole>, role: ColumnRole): string | null {
  const header = Object.keys(mapping).find((h) => mapping[h] === role);
  if (!header) return null;
  const v = (record[header] ?? '').trim();
  return v || null;
}

function parseMoney(raw: string | null): number {
  if (!raw) return 0;
  const n = Number(raw.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function parseCount(raw: string | null): number {
  if (!raw) return 0;
  const n = Number(raw.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function isContractStatus(status: string | null, contractDate: string | null): boolean {
  if (contractDate) return true;
  if (!status) return false;
  return /sold|contract|purchased|unconditional|settled/i.test(status);
}

function firstTouchSource(utmSource: string | null, utmMedium: string | null, utmCampaign: string | null, fallback: string | null): string | null {
  const utm = [utmSource, utmMedium, utmCampaign].filter(Boolean).join(' / ');
  if (utmSource) return utmSource;
  if (utm) return utm;
  return fallback;
}

async function tokenFor(record: Record<string, string>, mapping: Record<string, ColumnRole>): Promise<string | null> {
  const phone = cell(record, mapping, 'phone');
  const digits = phoneJoinDigits(phone);
  if (digits) return hashPhoneDigits(digits);
  const email = cell(record, mapping, 'email');
  if (email) return hashEmail(email);
  return null;
}

export function columnsDropped(headers: string[], mapping: Record<string, ColumnRole>): string[] {
  return headers.filter((h) => PII_ROLES.includes(mapping[h]) || mapping[h] === 'ignore');
}

export function columnsKept(headers: string[], mapping: Record<string, ColumnRole>): string[] {
  return headers.filter((h) => mapping[h] && mapping[h] !== 'ignore' && !PII_ROLES.includes(mapping[h]));
}

export async function washRecords(
  kind: FileKind,
  records: Record<string, string>[],
  mapping: Record<string, ColumnRole>,
  headers: string[],
): Promise<WashResult> {
  const droppedColumns = columnsDropped(headers, mapping);
  const keptColumns = columnsKept(headers, mapping);
  let skippedNoJoinKey = 0;

  if (kind === 'marketing') {
    const enquiries: WashedEnquiry[] = [];
    for (const rec of records) {
      const token = await tokenFor(rec, mapping);
      if (!token) {
        skippedNoJoinKey += 1;
        continue;
      }
      const utmSource = cell(rec, mapping, 'utmSource');
      enquiries.push({
        token,
        crmId: cell(rec, mapping, 'crmId'),
        postcode: cell(rec, mapping, 'postcode'),
        suburb: cell(rec, mapping, 'suburb'),
        enquiryDate: cell(rec, mapping, 'enquiryDate'),
        utmSource,
        utmMedium: cell(rec, mapping, 'utmMedium'),
        utmCampaign: cell(rec, mapping, 'utmCampaign'),
        utmContent: cell(rec, mapping, 'utmContent'),
        source: firstTouchSource(utmSource, cell(rec, mapping, 'utmMedium'), cell(rec, mapping, 'utmCampaign'), cell(rec, mapping, 'source')),
      });
    }
    return {
      kind,
      droppedColumns,
      keptColumns,
      rowCount: enquiries.length,
      skippedNoJoinKey,
      sample: enquiries.slice(0, 8) as unknown as Record<string, string | number | boolean | null>[],
      enquiries,
    };
  }

  if (kind === 'sales') {
    const sales: WashedSale[] = [];
    for (const rec of records) {
      const token = await tokenFor(rec, mapping);
      if (!token) {
        skippedNoJoinKey += 1;
        continue;
      }
      const contractDate = cell(rec, mapping, 'contractDate');
      sales.push({
        token,
        crmId: cell(rec, mapping, 'crmId'),
        postcode: cell(rec, mapping, 'postcode'),
        suburb: cell(rec, mapping, 'suburb'),
        enquiryDate: cell(rec, mapping, 'enquiryDate'),
        visitDate: cell(rec, mapping, 'visitDate'),
        eoiDate: cell(rec, mapping, 'eoiDate'),
        contractDate,
        salesSourceTag: cell(rec, mapping, 'source'),
        isContract: isContractStatus(cell(rec, mapping, 'status'), contractDate),
      });
    }
    return {
      kind,
      droppedColumns,
      keptColumns,
      rowCount: sales.length,
      skippedNoJoinKey,
      sample: sales.slice(0, 8) as unknown as Record<string, string | number | boolean | null>[],
      sales,
    };
  }

  if (kind === 'spend') {
    const spend: WashedSpend[] = records.map((rec) => ({
      campaign: cell(rec, mapping, 'campaign') ?? cell(rec, mapping, 'utmCampaign'),
      source: cell(rec, mapping, 'utmSource') ?? cell(rec, mapping, 'platform'),
      amount: parseMoney(cell(rec, mapping, 'spend')),
      date: cell(rec, mapping, 'date'),
    }));
    return {
      kind,
      droppedColumns,
      keptColumns,
      rowCount: spend.length,
      skippedNoJoinKey: 0,
      sample: spend.slice(0, 8) as unknown as Record<string, string | number | boolean | null>[],
      spend,
    };
  }

  const ads: WashedAd[] = records.map((rec) => ({
    platform: cell(rec, mapping, 'platform'),
    campaign: cell(rec, mapping, 'campaign'),
    adset: cell(rec, mapping, 'adset'),
    adName: cell(rec, mapping, 'adName'),
    spend: parseMoney(cell(rec, mapping, 'spend')),
    impressions: parseCount(cell(rec, mapping, 'impressions')),
    clicks: parseCount(cell(rec, mapping, 'clicks')),
    results: parseCount(cell(rec, mapping, 'results')),
    date: cell(rec, mapping, 'date'),
  }));
  return {
    kind,
    droppedColumns,
    keptColumns,
    rowCount: ads.length,
    skippedNoJoinKey: 0,
    sample: ads.slice(0, 8) as unknown as Record<string, string | number | boolean | null>[],
    ads,
  };
}

export function washedToCsv(result: WashResult): string {
  const rows =
    result.enquiries ??
    result.sales ??
    result.spend ??
    result.ads ??
    [];
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0] as object);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape((r as Record<string, unknown>)[h])).join(','))].join('\n');
}

export function assertNoPii(result: WashResult): string[] {
  const blob = JSON.stringify(result.enquiries ?? result.sales ?? result.sample);
  const hits: string[] = [];
  if (/@/.test(blob) && /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(blob)) hits.push('email');
  if (/\+61\d{8,}/.test(blob) || /\b04\d{8}\b/.test(blob)) hits.push('phone');
  return hits;
}

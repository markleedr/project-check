import { joinSalesToEnquiries, type JoinedBuyer } from './join';
import { monthKey } from './spend-input';
import { advertisingPlatform, spendPlatformKey } from './spend-platform';
import type { WashedAd, WashedEnquiry, WashedSale, WashedSpend } from './wash';

export const FUNNEL_STAGES = [
  {
    id: 'enquiry',
    label: 'Enquiry',
    dataNeeded: 'Enquiry rows with a phone or email',
  },
  {
    id: 'inspection',
    label: 'Inspection',
    dataNeeded: 'Inspection date, or a site visit / inspection pipeline stage',
  },
  {
    id: 'eoi',
    label: 'EOI',
    dataNeeded: 'EOI date, or an EOI pipeline stage',
  },
  {
    id: 'contract',
    label: 'Contract',
    dataNeeded: 'Contract date, or a contract pipeline stage',
  },
  {
    id: 'settlement',
    label: 'Settlement',
    dataNeeded: 'Settlement date, or a settled status',
  },
] as const;

export type FunnelStageId = (typeof FUNNEL_STAGES)[number]['id'];

export interface FunnelStageRow {
  id: FunnelStageId;
  label: string;
  count: number;
  /** True when the stage was not in the file. Count is not estimated. */
  gap: boolean;
  dataNeeded: string | null;
  /** False for enquiry, which has no previous stage. */
  priorStage: boolean;
  conversionFromPrevious: number | null;
  conversionFromEnquiry: number | null;
  medianDays: number | null;
  averageDays: number | null;
  /** Rows with a non-negative gap between this stage and the previous one. */
  n: number;
  /** Total spend divided by the stage count. Null when spend or the count is missing. */
  costPerStage: number | null;
}

export interface MonthlySpendRow {
  month: string;
  platform: string;
  amount: number;
  enquiries: number;
  costPerEnquiry: number | null;
}

export interface ChannelRow {
  source: string;
  enquiries: number;
  contracts: number;
  spend: number;
  costPerContract: number | null;
  salesTagsOverridden: number;
}

export interface TimingStats {
  sampleSize: number;
  medianDaysEnquiryToContract: number | null;
  medianDaysEnquiryToVisit: number | null;
  medianDaysEnquiryToEoi: number | null;
  medianDaysEoiToContract: number | null;
  averageDaysEoiToContract: number | null;
  eoiToContractSampleSize: number;
  missingVisit: number;
  missingEoi: number;
}

export interface PostcodeRow {
  postcode: string;
  enquiries: number;
  contracts: number;
}

export interface AdRow {
  platform: string | null;
  campaign: string | null;
  adset: string | null;
  adName: string | null;
  spend: number;
  results: number;
  costPerResult: number | null;
  impressions: number;
  clicks: number;
}

export interface ReportFigures {
  enquiryCount: number;
  uniqueEnquirerCount: number;
  salesContactedCount: number;
  contractCount: number;
  settlementCount: number;
  siteVisitCount: number;
  eoiCount: number;
  unmatchedSales: number;
  salesTagsOverridden: number;
  skippedNoJoinKey: { marketing: number; sales: number };
  channels: ChannelRow[];
  timing: TimingStats;
  funnelStages: FunnelStageRow[];
  monthlySpend: MonthlySpendRow[];
  postcodes: PostcodeRow[];
  ads: AdRow[];
  spendTotal: number;
  guesses: string[];
  shown: string[];
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

function normaliseSource(s: string): string {
  return s.trim() || 'unknown';
}

function spendByPlatform(spend: WashedSpend[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of spend) {
    const platform = spendPlatformKey(row);
    if (!platform) continue;
    map.set(platform, (map.get(platform) ?? 0) + row.amount);
  }
  return map;
}

function spendForSource(
  source: string,
  enquiriesForSource: number,
  enquiryBySource: Map<string, number>,
  platformSpend: Map<string, number>,
): number {
  const n = source.toLowerCase();
  if (n === 'offline' || n === 'walk-in' || n === 'walk in' || n === 'unknown') return 0;
  const platform = advertisingPlatform(source);
  if (!platform) return 0;
  const pool = platformSpend.get(platform) ?? 0;
  if (pool <= 0) return 0;
  let siblingEnquiries = 0;
  for (const [other, count] of enquiryBySource) {
    if (advertisingPlatform(other) === platform) siblingEnquiries += count;
  }
  if (siblingEnquiries <= 0) return 0;
  return (pool * enquiriesForSource) / siblingEnquiries;
}

export function buildFigures(input: {
  enquiries: WashedEnquiry[];
  sales: WashedSale[];
  spend: WashedSpend[];
  ads: WashedAd[];
  skippedNoJoinKey?: { marketing: number; sales: number };
}): ReportFigures {
  const joined = joinSalesToEnquiries(input.enquiries, input.sales);
  const contracts = joined.filter((j) => j.sale.isContract);
  const eoiCount = joined.filter((j) => Boolean(j.sale.eoiDate)).length;
  const siteVisitCount = input.sales.filter((s) => Boolean(s.visitDate)).length;
  const settlementCount = input.sales.filter((s) => s.isSettled).length;
  const uniqueEnquirerCount = new Set(input.enquiries.map((e) => e.token).filter(Boolean)).size;

  const enquiryBySource = new Map<string, number>();
  for (const e of input.enquiries) {
    const s = normaliseSource(e.source || e.utmSource || 'unknown');
    enquiryBySource.set(s, (enquiryBySource.get(s) ?? 0) + 1);
  }

  const contractBySource = new Map<string, { n: number; overridden: number }>();
  for (const c of contracts) {
    const s = normaliseSource(c.firstTouchSource);
    const prev = contractBySource.get(s) ?? { n: 0, overridden: 0 };
    prev.n += 1;
    if (c.salesTagOverridden) prev.overridden += 1;
    contractBySource.set(s, prev);
  }

  const sources = new Set([...enquiryBySource.keys(), ...contractBySource.keys()]);
  const spendTotal = input.spend.reduce((s, r) => s + r.amount, 0);
  const platformSpend = spendByPlatform(input.spend);

  const channels: ChannelRow[] = [...sources]
    .map((source) => {
      const contractsN = contractBySource.get(source)?.n ?? 0;
      const enquiries = enquiryBySource.get(source) ?? 0;
      const spend = spendForSource(source, enquiries, enquiryBySource, platformSpend);
      return {
        source,
        enquiries,
        contracts: contractsN,
        spend,
        costPerContract: contractsN > 0 && spend > 0 ? spend / contractsN : null,
        salesTagsOverridden: contractBySource.get(source)?.overridden ?? 0,
      };
    })
    .sort((a, b) => b.contracts - a.contracts || b.enquiries - a.enquiries);

  const timing = timingFrom(contracts, joined);
  const funnelStages = buildFunnelStages({
    joined,
    uniqueEnquirerCount,
    siteVisitCount,
    eoiCount,
    contractCount: contracts.length,
    settlementCount,
    spendTotal,
  });
  const monthlySpend = buildMonthlySpend(input.spend, input.enquiries);
  const postcodes = postcodeMix(input.enquiries, contracts);

  const ads: AdRow[] = input.ads.map((a) => ({
    platform: a.platform,
    campaign: a.campaign,
    adset: a.adset,
    adName: a.adName,
    spend: a.spend,
    results: a.results,
    costPerResult: a.results > 0 ? a.spend / a.results : null,
    impressions: a.impressions,
    clicks: a.clicks,
  }));

  const guesses: string[] = [];
  const shown: string[] = [
    'A sale is a contract signed. Settled buyers are also counted as contracts, and settlement is its own stage.',
    'Digital source is first-touch UTM on the marketing enquiry. A later walk-in tag on the sales file does not override it.',
    'Offline is anyone on the sales file who does not match a marketing enquiry.',
    'Unique enquirers are distinct match tokens on the marketing file.',
    'Cost per stage is total spend divided by the count at that stage. It is not calculable when spend or the count is missing.',
    'Days between stages use sales rows that have both dates. Negative or missing gaps are left out.',
  ];

  if (input.spend.length === 0) {
    guesses.push('Spend was not uploaded, so cost per contract is not shown.');
  }
  if (input.ads.length === 0) {
    guesses.push('An ads export was not uploaded, so creative performance is not shown.');
  }
  if (timing.missingVisit > 0 || timing.medianDaysEnquiryToVisit == null) {
    guesses.push('Site visit dates are missing on many sales rows, so visit timing is incomplete.');
  }
  if (timing.missingEoi > 0 || timing.medianDaysEnquiryToEoi == null) {
    guesses.push('EOI dates are missing on many sales rows, so EOI timing is incomplete.');
  }
  if (postcodes.every((p) => !p.postcode || p.postcode === 'unknown')) {
    guesses.push('Postcode is missing, so we cannot describe where buyers live.');
  }
  for (const stage of funnelStages) {
    if (stage.gap && stage.id !== 'enquiry') {
      guesses.push(`${stage.label} is data needed (${stage.dataNeeded}). Conversion, days and cost for that stage are not calculable.`);
    }
  }
  if (spendTotal > 0 && monthlySpend.length === 0) {
    guesses.push('Spend has no month, so spend by month is not calculable.');
  }
  guesses.push('Buyer personas beyond channel, postcode and time to contract are not in a basic CRM export.');

  return {
    enquiryCount: input.enquiries.length,
    uniqueEnquirerCount,
    salesContactedCount: input.sales.length,
    contractCount: contracts.length,
    settlementCount,
    siteVisitCount,
    eoiCount,
    unmatchedSales: joined.filter((j) => j.attributionKind !== 'digital_first_touch').length,
    salesTagsOverridden: contracts.filter((c) => c.salesTagOverridden).length,
    skippedNoJoinKey: input.skippedNoJoinKey ?? { marketing: 0, sales: 0 },
    channels,
    timing,
    funnelStages,
    monthlySpend,
    postcodes,
    ads,
    spendTotal,
    guesses,
    shown,
  };
}

function timingFrom(contracts: JoinedBuyer[], joined: JoinedBuyer[]): TimingStats {
  const toContract: number[] = [];
  const toVisit: number[] = [];
  const toEoi: number[] = [];
  let missingVisit = 0;
  let missingEoi = 0;
  for (const c of contracts) {
    const start = parseDate(c.enquiry?.enquiryDate ?? c.sale.enquiryDate);
    const contract = parseDate(c.sale.contractDate);
    const visit = parseDate(c.sale.visitDate);
    const eoi = parseDate(c.sale.eoiDate);
    const d = daysBetween(start, contract);
    if (d != null && d >= 0) toContract.push(d);
    if (!visit) missingVisit += 1;
    else {
      const dv = daysBetween(start, visit);
      if (dv != null && dv >= 0) toVisit.push(dv);
    }
    if (!eoi) missingEoi += 1;
    else {
      const de = daysBetween(start, eoi);
      if (de != null && de >= 0) toEoi.push(de);
    }
  }
  const eoiToContract = stageGapDays(joined, 'eoi', 'contract');
  return {
    sampleSize: contracts.length,
    medianDaysEnquiryToContract: median(toContract),
    medianDaysEnquiryToVisit: median(toVisit),
    medianDaysEnquiryToEoi: median(toEoi),
    medianDaysEoiToContract: median(eoiToContract),
    averageDaysEoiToContract: average(eoiToContract),
    eoiToContractSampleSize: eoiToContract.length,
    missingVisit,
    missingEoi,
  };
}

function enquiryDateOf(row: JoinedBuyer): string | null {
  return row.sale.enquiryDate ?? row.enquiry?.enquiryDate ?? null;
}

function stageDate(row: JoinedBuyer, id: FunnelStageId): string | null {
  if (id === 'enquiry') return enquiryDateOf(row);
  if (id === 'inspection') return row.sale.visitDate;
  if (id === 'eoi') return row.sale.eoiDate;
  if (id === 'contract') return row.sale.contractDate;
  return row.sale.settlementDate;
}

function reachedStage(row: JoinedBuyer, id: FunnelStageId): boolean {
  if (id === 'enquiry') return Boolean(enquiryDateOf(row));
  if (id === 'inspection') return Boolean(row.sale.visitDate);
  if (id === 'eoi') return Boolean(row.sale.eoiDate);
  if (id === 'contract') return row.sale.isContract;
  return row.sale.isSettled;
}

/** Non-negative day gaps between two stages. Missing or negative dates are dropped. */
function stageGapDays(joined: JoinedBuyer[], from: FunnelStageId, to: FunnelStageId): number[] {
  const values: number[] = [];
  for (const row of joined) {
    if (!reachedStage(row, to)) continue;
    const gap = daysBetween(parseDate(stageDate(row, from)), parseDate(stageDate(row, to)));
    if (gap != null && gap >= 0) values.push(gap);
  }
  return values;
}

export function buildFunnelStages(input: {
  joined: JoinedBuyer[];
  uniqueEnquirerCount: number;
  siteVisitCount: number;
  eoiCount: number;
  contractCount: number;
  settlementCount: number;
  spendTotal: number;
}): FunnelStageRow[] {
  const counts: Record<FunnelStageId, number> = {
    enquiry: input.uniqueEnquirerCount,
    inspection: input.siteVisitCount,
    eoi: input.eoiCount,
    contract: input.contractCount,
    settlement: input.settlementCount,
  };

  return FUNNEL_STAGES.map((stage, index) => {
    const gap = counts[stage.id] === 0;
    const previous = index === 0 ? null : FUNNEL_STAGES[index - 1];
    const previousGap = previous ? counts[previous.id] === 0 : false;
    const days =
      previous && !gap && !previousGap ? stageGapDays(input.joined, previous.id, stage.id) : [];
    const enquiryGap = counts.enquiry === 0;
    return {
      id: stage.id,
      label: stage.label,
      count: gap ? 0 : counts[stage.id],
      gap,
      dataNeeded: gap ? stage.dataNeeded : null,
      priorStage: index > 0,
      conversionFromPrevious:
        !previous || gap || previousGap || counts[previous.id] <= 0
          ? null
          : counts[stage.id] / counts[previous.id],
      conversionFromEnquiry:
        stage.id === 'enquiry' || gap || enquiryGap ? null : counts[stage.id] / counts.enquiry,
      medianDays: days.length ? median(days) : null,
      averageDays: average(days),
      n: days.length,
      costPerStage: gap || input.spendTotal <= 0 || counts[stage.id] <= 0 ? null : input.spendTotal / counts[stage.id],
    };
  });
}

function buildMonthlySpend(spend: WashedSpend[], enquiries: WashedEnquiry[]): MonthlySpendRow[] {
  const amounts = new Map<string, number>();
  for (const row of spend) {
    const month = monthKey(row.date);
    if (!month) continue;
    const platform = spendPlatformKey(row) ?? (row.source?.trim() || 'unspecified');
    const key = `${month}|${platform}`;
    amounts.set(key, (amounts.get(key) ?? 0) + row.amount);
  }

  const byMonthPlatform = new Map<string, Set<string>>();
  const byMonthAll = new Map<string, Set<string>>();
  for (const enquiry of enquiries) {
    const month = monthKey(enquiry.enquiryDate);
    if (!month || !enquiry.token) continue;
    const all = byMonthAll.get(month) ?? new Set<string>();
    all.add(enquiry.token);
    byMonthAll.set(month, all);
    const platform = advertisingPlatform(enquiry.source || enquiry.utmSource);
    if (!platform) continue;
    const key = `${month}|${platform}`;
    const set = byMonthPlatform.get(key) ?? new Set<string>();
    set.add(enquiry.token);
    byMonthPlatform.set(key, set);
  }

  return [...amounts.entries()]
    .map(([key, amount]) => {
      const [month, platform] = key.split('|');
      const channelSpecific = platform === 'meta' || platform === 'google' || platform === 'linkedin';
      const enquiriesInBucket = channelSpecific
        ? (byMonthPlatform.get(key)?.size ?? 0)
        : (byMonthAll.get(month)?.size ?? 0);
      return {
        month,
        platform,
        amount,
        enquiries: enquiriesInBucket,
        costPerEnquiry: enquiriesInBucket > 0 ? amount / enquiriesInBucket : null,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month) || a.platform.localeCompare(b.platform));
}

export function formatStageCount(row: FunnelStageRow): string {
  if (row.gap) return 'Data needed';
  return row.count.toLocaleString('en-AU');
}

export function formatStageConversion(row: FunnelStageRow): string {
  if (!row.priorStage) return '—';
  if (row.conversionFromPrevious == null) return 'not calculable';
  return `${Math.round(row.conversionFromPrevious * 100)}%`;
}

export function formatStageDays(value: number | null, applicable: boolean): string {
  if (!applicable) return '—';
  if (value == null) return 'not calculable';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatStageCost(value: number | null): string {
  if (value == null) return 'not calculable';
  return `$${Math.round(value).toLocaleString('en-AU')}`;
}

export function funnelTableRows(figures: ReportFigures): string[][] {
  return (figures.funnelStages ?? []).map((row) => [
    row.label,
    formatStageCount(row),
    formatStageConversion(row),
    formatStageDays(row.medianDays, row.priorStage),
    formatStageDays(row.averageDays, row.priorStage),
    formatStageCost(row.costPerStage),
  ]);
}

const PLATFORM_LABELS: Record<string, string> = {
  meta: 'Meta',
  google: 'Google',
  linkedin: 'LinkedIn',
  other: 'Other',
  unspecified: 'Unspecified',
  'all platforms': 'All platforms',
};

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

export function monthlyTableRows(figures: ReportFigures): string[][] {
  return (figures.monthlySpend ?? []).map((row) => [
    row.month,
    platformLabel(row.platform),
    `$${Math.round(row.amount).toLocaleString('en-AU')}`,
    row.enquiries.toLocaleString('en-AU'),
    formatStageCost(row.costPerEnquiry),
  ]);
}

/** Template narrative for the milestone funnel. Missing inputs stay "not calculable". */
export function funnelFindings(figures: ReportFigures): string {
  const stages = figures.funnelStages ?? [];
  if (stages.length === 0) return 'The milestone funnel is not calculable from this check.';
  return stages
    .map((stage) => {
      if (stage.gap) {
        return `${stage.label}: data needed. Conversion, days and cost are not calculable.`;
      }
      const parts = [`${stage.label}: ${stage.count.toLocaleString('en-AU')}.`];
      if (stage.priorStage) {
        parts.push(
          stage.conversionFromPrevious == null
            ? 'Conversion from the previous stage is not calculable.'
            : `${Math.round(stage.conversionFromPrevious * 100)}% converted from the previous stage.`,
        );
        parts.push(
          stage.medianDays == null
            ? 'Median and average days are not calculable.'
            : `Median ${formatStageDays(stage.medianDays, true)} days, average ${formatStageDays(stage.averageDays, true)} days (n=${stage.n}).`,
        );
      }
      if (stage.id !== 'enquiry') {
        parts.push(
          stage.conversionFromEnquiry == null
            ? 'Conversion from enquiry is not calculable.'
            : `${Math.round(stage.conversionFromEnquiry * 100)}% of enquiries reached this stage.`,
        );
      }
      parts.push(stage.costPerStage == null ? 'Cost is not calculable.' : `Cost per stage ${formatStageCost(stage.costPerStage)}.`);
      return parts.join(' ');
    })
    .join(' ');
}

export function monthlySpendFindings(figures: ReportFigures): string {
  if ((figures.spendTotal ?? 0) <= 0) {
    return 'No spend was uploaded, so spend by month and cost per stage are not calculable.';
  }
  const rows = figures.monthlySpend ?? [];
  if (rows.length === 0) {
    return 'Spend has no month, so spend by month is not calculable. Add a month column to the spend file, or enter monthly amounts on the spend step.';
  }
  const months = [...new Set(rows.map((row) => row.month))].sort();
  const monthLabel = months.length === 1 ? '1 month' : `${months.length} months`;
  return `Spend is dated across ${monthLabel} (${months.join(', ')}). Cost per enquiry is this channel's spend in the month divided by enquiries from that channel. It is not calculable when that month has no matching enquiries.`;
}

export function timingFindings(figures: ReportFigures): string {
  const medianDays = figures.timing.medianDaysEoiToContract;
  const gaps = (figures.funnelStages ?? []).filter((stage) => stage.gap).map((stage) => stage.label);
  const gapNote =
    gaps.length > 0
      ? ` ${gaps.join(', ')} ${gaps.length === 1 ? 'is' : 'are'} data needed, so conversion, days and cost there are not calculable.`
      : '';
  if (medianDays == null) {
    return `Median days from EOI to contract are not calculable.${gapNote}`;
  }
  const averageDays = figures.timing.averageDaysEoiToContract;
  const averageText =
    averageDays == null ? '' : ` Average ${formatStageDays(averageDays, true)} days.`;
  return `Median days from EOI to contract is ${formatStageDays(medianDays, true)} (n=${figures.timing.eoiToContractSampleSize}).${averageText}${gapNote}`;
}

function looksLikePostcode(value: string | null): boolean {
  return Boolean(value && /^\d{3,4}$/.test(value.trim()));
}

function postcodeMix(enquiries: WashedEnquiry[], contracts: JoinedBuyer[]): PostcodeRow[] {
  const map = new Map<string, PostcodeRow>();
  const bump = (postcode: string | null, field: 'enquiries' | 'contracts') => {
    if (!looksLikePostcode(postcode)) return;
    const key = postcode!.trim();
    const row = map.get(key) ?? { postcode: key, enquiries: 0, contracts: 0 };
    row[field] += 1;
    map.set(key, row);
  };
  for (const e of enquiries) bump(e.postcode, 'enquiries');
  for (const c of contracts) bump(c.sale.postcode || c.enquiry?.postcode || null, 'contracts');
  return [...map.values()].sort((a, b) => b.contracts - a.contracts || b.enquiries - a.enquiries);
}

/** Spend advice only. The channel table is results, not this list. */
export function spendDirectionActions(figures: ReportFigures): string[] {
  const actions: string[] = [];
  const withContracts = figures.channels.filter((c) => c.contracts > 0);
  const best = withContracts[0];
  if (best) {
    actions.push(
      `Keep or increase activity on ${best.source}: it accounts for ${best.contracts} of ${figures.contractCount} contracts.`,
    );
  }
  const expensive = figures.channels
    .filter((c) => c.costPerContract != null && c.contracts > 0)
    .sort((a, b) => (b.costPerContract ?? 0) - (a.costPerContract ?? 0))[0];
  if (expensive && best && expensive.source !== best.source) {
    actions.push(
      `Investigate ${expensive.source}: highest cost per contract in this upload ($${Math.round(expensive.costPerContract ?? 0)}).`,
    );
  }
  const unfunded = figures.channels
    .filter((c) => c.spend > 0 && c.contracts === 0)
    .sort((a, b) => b.spend - a.spend)[0];
  if (unfunded) {
    actions.push(
      `Do not fund ${unfunded.source} from this file: $${Math.round(unfunded.spend).toLocaleString()} spent with no contracts.`,
    );
  }
  if (actions.length === 0) {
    actions.push('No contracts matched a source, so we cannot say where the next dollar should go.');
  }
  return actions;
}

export function suggestedActions(figures: ReportFigures): string[] {
  const actions: string[] = [...spendDirectionActions(figures)];
  if (figures.salesTagsOverridden > 0) {
    actions.push(
      `Do not brief from sales walk-in tags alone. ${figures.salesTagsOverridden} contracts were tagged walk-in or similar after a digital enquiry.`,
    );
  }
  if (figures.timing.medianDaysEnquiryToContract != null) {
    actions.push(
      `Plan nurture for about ${Math.round(figures.timing.medianDaysEnquiryToContract)} days from enquiry to contract, based on this file.`,
    );
  }
  const topGeo = figures.postcodes.find((p) => p.contracts > 0);
  if (topGeo) {
    actions.push(`Prioritise ${topGeo.postcode}: it has the most contracts in this upload.`);
  }
  if (actions.length === 1 && actions[0].startsWith('No contracts matched')) {
    return ['Upload marketing enquiries, sales (with contracts) and spend so the five questions have numbers behind them.'];
  }
  return actions.slice(0, 5);
}

/** One line a marketing manager can read before the five questions. */
export function funnelMeaning(figures: ReportFigures): string {
  const { enquiryCount, siteVisitCount, contractCount } = figures;
  if (enquiryCount === 0) {
    return 'No enquiries in the marketing file, so the funnel cannot be read.';
  }
  if (siteVisitCount === 0 && contractCount === 0) {
    return 'People are enquiring, but there are no site visits or contracts in the sales file. Check visit/contract dates or pipeline stages were mapped, or that sales follow-up is happening.';
  }
  if (siteVisitCount > 0 && contractCount === 0) {
    return 'Site visits are happening; contracts are not in this file. Either contract dates were not mapped, or visits are not converting.';
  }
  if (siteVisitCount === 0 && contractCount > 0) {
    return 'Contracts are in the file but site visit dates are missing, so we cannot see the middle of the funnel.';
  }
  const visitRate = siteVisitCount / enquiryCount;
  const closeRate = contractCount / Math.max(siteVisitCount, 1);
  if (visitRate < 0.05) {
    return 'Few enquiries are making it to site. Getting people to the display suite needs work.';
  }
  if (closeRate < 0.1) {
    return 'Visits look healthier than contracts. Sales conversion after the visit is the squeeze.';
  }
  return 'Enquiries, visits and contracts are all present. Use time-to-buy to plan follow-up.';
}

/** Imperative spend direction, not a restatement of the results table. */
export function nextDollarDirection(figures: ReportFigures): string {
  return spendDirectionActions(figures).join(' ');
}

/** @deprecated Use nextDollarDirection. Kept so older imports still type-check. */
export function nextDollarMeaning(figures: ReportFigures): string {
  return nextDollarDirection(figures);
}

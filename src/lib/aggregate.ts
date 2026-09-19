import { joinSalesToEnquiries, type JoinedBuyer } from './join';
import { advertisingPlatform, spendPlatformKey } from './spend-platform';
import type { WashedAd, WashedEnquiry, WashedSale, WashedSpend } from './wash';

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
  salesContactedCount: number;
  contractCount: number;
  siteVisitCount: number;
  eoiCount: number;
  unmatchedSales: number;
  salesTagsOverridden: number;
  skippedNoJoinKey: { marketing: number; sales: number };
  channels: ChannelRow[];
  timing: TimingStats;
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

  const timing = timingFrom(contracts);
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
    'A sale is a contract signed.',
    'Digital source is first-touch UTM on the marketing enquiry. A later walk-in tag on the sales file does not override it.',
    'Offline is anyone on the sales file who does not match a marketing enquiry.',
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
  guesses.push('Buyer personas beyond channel, postcode and time to contract are not in a basic CRM export.');

  return {
    enquiryCount: input.enquiries.length,
    salesContactedCount: input.sales.length,
    contractCount: contracts.length,
    siteVisitCount,
    eoiCount,
    unmatchedSales: joined.filter((j) => j.attributionKind !== 'digital_first_touch').length,
    salesTagsOverridden: contracts.filter((c) => c.salesTagOverridden).length,
    skippedNoJoinKey: input.skippedNoJoinKey ?? { marketing: 0, sales: 0 },
    channels,
    timing,
    postcodes,
    ads,
    spendTotal,
    guesses,
    shown,
  };
}

function timingFrom(contracts: JoinedBuyer[]): TimingStats {
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
  return {
    sampleSize: contracts.length,
    medianDaysEnquiryToContract: median(toContract),
    medianDaysEnquiryToVisit: median(toVisit),
    medianDaysEnquiryToEoi: median(toEoi),
    missingVisit,
    missingEoi,
  };
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

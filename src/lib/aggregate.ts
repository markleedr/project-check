import { joinSalesToEnquiries, type JoinedBuyer } from './join';
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

function spendForSource(spend: WashedSpend[], source: string): number {
  const n = source.toLowerCase();
  return spend
    .filter((row) => {
      const blob = `${row.source ?? ''} ${row.campaign ?? ''}`.toLowerCase();
      if (n === 'offline' || n === 'walk-in' || n === 'walk in') return false;
      return blob.includes(n) || n.includes((row.source ?? '').toLowerCase());
    })
    .reduce((sum, row) => sum + row.amount, 0);
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

  const channels: ChannelRow[] = [...sources]
    .map((source) => {
      const contractsN = contractBySource.get(source)?.n ?? 0;
      const spend = spendForSource(input.spend, source);
      return {
        source,
        enquiries: enquiryBySource.get(source) ?? 0,
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

function postcodeMix(enquiries: WashedEnquiry[], contracts: JoinedBuyer[]): PostcodeRow[] {
  const map = new Map<string, PostcodeRow>();
  const bump = (postcode: string | null, field: 'enquiries' | 'contracts') => {
    const key = (postcode || 'unknown').trim() || 'unknown';
    const row = map.get(key) ?? { postcode: key, enquiries: 0, contracts: 0 };
    row[field] += 1;
    map.set(key, row);
  };
  for (const e of enquiries) bump(e.postcode, 'enquiries');
  for (const c of contracts) bump(c.sale.postcode || c.enquiry?.postcode || null, 'contracts');
  return [...map.values()].sort((a, b) => b.contracts - a.contracts || b.enquiries - a.enquiries);
}

export function suggestedActions(figures: ReportFigures): string[] {
  const actions: string[] = [];
  const withContracts = figures.channels.filter((c) => c.contracts > 0);
  const best = withContracts[0];
  if (best) {
    actions.push(`Keep or increase activity on ${best.source}: it accounts for ${best.contracts} of ${figures.contractCount} contracts.`);
  }
  const expensive = figures.channels
    .filter((c) => c.costPerContract != null && c.contracts > 0)
    .sort((a, b) => (b.costPerContract ?? 0) - (a.costPerContract ?? 0))[0];
  if (expensive && best && expensive.source !== best.source) {
    actions.push(`Investigate ${expensive.source}: highest cost per contract in this upload ($${Math.round(expensive.costPerContract ?? 0)}).`);
  }
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
  const topGeo = figures.postcodes.find((p) => p.postcode !== 'unknown');
  if (topGeo) {
    actions.push(`Prioritise ${topGeo.postcode}: it has the most contracts in this upload.`);
  }
  if (actions.length === 0) {
    actions.push('Upload marketing enquiries, sales (with contracts) and spend so the five questions have numbers behind them.');
  }
  return actions.slice(0, 5);
}

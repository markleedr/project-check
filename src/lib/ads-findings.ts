import type { AdRow, ReportFigures } from './aggregate';

export interface RankedAd {
  key: string;
  name: string;
  detail: string | null;
  platform: string | null;
  spend: number;
  results: number;
  costPerResult: number | null;
  read: 'Continue' | 'Investigate' | '';
}

function adName(ad: AdRow): string {
  return (ad.adName || ad.adset || ad.campaign || 'Untitled').trim() || 'Untitled';
}

function adKey(ad: AdRow): string {
  return [ad.platform, ad.campaign, ad.adset, ad.adName, ad.spend, ad.results].join('|');
}

function dedupeAds(ads: AdRow[]): AdRow[] {
  const seen = new Set<string>();
  const out: AdRow[] = [];
  for (const ad of ads) {
    const k = adKey(ad);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(ad);
  }
  return out;
}

export function rankedAds(figures: ReportFigures, max = 8): RankedAd[] {
  const ads = dedupeAds(figures.ads)
    .slice()
    .sort((a, b) => {
      const ac = a.costPerResult;
      const bc = b.costPerResult;
      if (ac != null && bc != null && ac !== bc) return ac - bc;
      if (ac != null && bc == null) return -1;
      if (ac == null && bc != null) return 1;
      return b.spend - a.spend;
    })
    .slice(0, max);

  const withCpr = ads.filter((a) => a.costPerResult != null && a.results > 0);
  const cheapest = withCpr[0];
  const expensive = withCpr.length ? withCpr[withCpr.length - 1] : undefined;
  const names = ads.map(adName);
  const collisions = new Set(names.filter((n, i) => names.indexOf(n) !== i));

  return ads.map((ad) => {
    const name = adName(ad);
    const parts = [ad.campaign, ad.adset].filter((p) => p && p !== name);
    const detail = collisions.has(name) && parts.length ? parts.join(' · ') : null;
    let read: RankedAd['read'] = '';
    if (cheapest && ad === cheapest) read = 'Continue';
    else if (expensive && cheapest && ad === expensive && expensive !== cheapest) read = 'Investigate';
    return {
      key: adKey(ad),
      name,
      detail,
      platform: ad.platform,
      spend: ad.spend,
      results: ad.results,
      costPerResult: ad.costPerResult,
      read,
    };
  });
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

/** Short read of the ads table. Never a run-on list of every row. */
export function whyFindings(figures: ReportFigures): string {
  if (figures.ads.length === 0) {
    return 'No ads export was in this run, so campaign and creative performance is not shown.';
  }
  const rows = rankedAds(figures, 8);
  const withCpr = rows.filter((r) => r.costPerResult != null && r.results > 0);
  if (withCpr.length === 0) {
    return 'Ads were uploaded but none have a result count, so cost per result cannot be compared.';
  }
  const cheapest = withCpr[0];
  const expensive = withCpr[withCpr.length - 1];
  const volume = rows.slice().sort((a, b) => b.results - a.results)[0];
  const bits: string[] = [
    `${cheapest.name} is the cheapest result in this export (${money(cheapest.costPerResult ?? 0)} each, ${cheapest.results.toLocaleString()} results).`,
  ];
  if (volume && volume.name !== cheapest.name) {
    bits.push(
      `${volume.name} delivered the most results (${volume.results.toLocaleString()})${
        volume.costPerResult != null ? ` at ${money(volume.costPerResult)} each` : ''
      }.`,
    );
  }
  if (expensive && expensive.name !== cheapest.name) {
    bits.push(
      `${expensive.name} is the most expensive (${money(expensive.costPerResult ?? 0)} per result). Investigate before putting more budget on it.`,
    );
  }
  return bits.join(' ');
}

import type { ChannelRow, ReportFigures } from './aggregate';

export function topSalesChannels(figures: ReportFigures, n = 3): ChannelRow[] {
  return figures.channels
    .filter((c) => c.contracts > 0 || c.enquiries > 0)
    .sort((a, b) => b.contracts - a.contracts || b.enquiries - a.enquiries)
    .slice(0, n);
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function channelSentence(row: ChannelRow, rank: string, contractCount: number): string {
  const cost =
    row.costPerContract != null
      ? ` Cost per contract ${money(row.costPerContract)}.`
      : row.spend > 0
        ? ` Spend in this check ${money(row.spend)}.`
        : '';
  return `${rank}: ${row.source} is first-touch on ${row.contracts} of ${contractCount} contracts, from ${row.enquiries} enquiries.${cost}`;
}

/** Restates the top three sources. Used on screen even when stored commentary only named one. */
export function salesFindings(figures: ReportFigures): string {
  if (figures.contractCount === 0) {
    return 'No contracts were in the sales file, so channel mix for sales cannot be shown.';
  }
  const top = topSalesChannels(figures, 3).filter((c) => c.contracts > 0);
  if (top.length === 0) {
    return 'No contracts matched a source, so channel mix for sales cannot be shown.';
  }
  const ranks = ['First', 'Second', 'Third'];
  const body = top.map((row, i) => channelSentence(row, ranks[i], figures.contractCount)).join(' ');
  const walkin =
    figures.salesTagsOverridden > 0
      ? ` ${figures.salesTagsOverridden} contracts had a later sales tag (often walk-in) that was ignored.`
      : '';
  return body + walkin;
}

export function locationFindings(figures: ReportFigures): string {
  const rows = figures.postcodes.slice(0, 10);
  if (rows.length === 0) {
    return 'No postcodes were in the wash.';
  }
  const named = rows
    .slice(0, 3)
    .map((r) => `${r.postcode} (${r.contracts} contracts, ${r.enquiries} enquiries)`)
    .join('; ');
  return `Highest contract counts: ${named}. The table and map show the top ${rows.length} postcodes.`;
}

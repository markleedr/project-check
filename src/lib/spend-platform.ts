/** Map enquiry sources and spend rows onto Meta / Google / LinkedIn so spend is not trapped on the word "meta". */

export function advertisingPlatform(text: string | null | undefined): string | null {
  if (!text) return null;
  const n = text.toLowerCase();
  if (/offline|walk-?in|referral|organic|direct|unknown/.test(n) && !/facebook|meta|google|linkedin|social/.test(n)) {
    return null;
  }
  if (/meta|facebook|\bfb\b|instagram|\big\b|social|ctlp/.test(n)) return 'meta';
  if (/google|youtube|gads|pmax|adwords|paid search|\bsearch\b/.test(n)) return 'google';
  if (/linkedin/.test(n)) return 'linkedin';
  return null;
}

export function spendPlatformKey(row: { source: string | null; campaign: string | null }): string | null {
  return advertisingPlatform(row.source) ?? advertisingPlatform(row.campaign);
}

import type { WashedEnquiry, WashedSale } from './wash';

export type AttributionKind = 'digital_first_touch' | 'offline' | 'unmatched_sale';

export interface JoinedBuyer {
  token: string;
  enquiry: WashedEnquiry | null;
  sale: WashedSale;
  firstTouchSource: string;
  attributionKind: AttributionKind;
  salesTagOverridden: boolean;
}

export function joinSalesToEnquiries(enquiries: WashedEnquiry[], sales: WashedSale[]): JoinedBuyer[] {
  const byToken = new Map<string, WashedEnquiry>();
  for (const e of enquiries) {
    if (!byToken.has(e.token)) byToken.set(e.token, e);
  }

  return sales.map((sale) => {
    const enquiry = byToken.get(sale.token) ?? null;
    if (enquiry) {
      const source = enquiry.source || enquiry.utmSource || 'digital_unknown';
      const tag = (sale.salesSourceTag || '').toLowerCase();
      const looksOffline = /walk.?in|phone|referral|agent|display/.test(tag);
      return {
        token: sale.token,
        enquiry,
        sale,
        firstTouchSource: source,
        attributionKind: 'digital_first_touch' as const,
        salesTagOverridden: looksOffline,
      };
    }

    const tag = sale.salesSourceTag?.trim();
    return {
      token: sale.token,
      enquiry: null,
      sale,
      firstTouchSource: tag && tag.length > 0 ? tag : 'offline',
      attributionKind: tag ? 'offline' : 'unmatched_sale',
      salesTagOverridden: false,
    };
  });
}

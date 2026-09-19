import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { rankedAds, whyFindings } from './ads-findings';
import { buildFigures, funnelMeaning, nextDollarDirection, spendDirectionActions, suggestedActions } from './aggregate';
import { fallbackCommentary } from './commentary-fallback';
import { locationTableRows, mapDots, postcodeCentroid, projectLatLng } from './geo/project';
import { locationFindings, salesFindings, topSalesChannels } from './sales-findings';
import { hashPhoneDigits } from './hash';
import { joinSalesToEnquiries } from './join';
import { phoneJoinDigits } from './phone';
import { assertNoPii, washRecords } from './wash';
import { headersToReview, mappingWarnings, suggestMapping } from './columns';
import { mappedSpendTotal, spendOverlapMessages } from './spend-input';
import { excelBufferToCsv } from './spreadsheet';
import { sameDevelopmentName } from './upload-guide';
import { funnelFromStatus, isWonContract } from './funnel';
import { advertisingPlatform } from './spend-platform';

describe('phone join digits', () => {
  it('treats common AU formats as the same last nine', () => {
    expect(phoneJoinDigits('0412 345 678')).toBe('412345678');
    expect(phoneJoinDigits('+61 412 345 678')).toBe('412345678');
    expect(phoneJoinDigits('61412345678')).toBe('412345678');
  });
});

describe('wash', () => {
  it('drops names emails phones and still joins on a token', async () => {
    const headers = ['First name', 'Email', 'Phone', 'Postcode', 'UTM Source', 'Enquiry date'];
    const mapping = suggestMapping(headers, 'marketing');
    expect(mapping.Phone).toBe('phone');
    expect(mapping.Email).toBe('email');
    const washed = await washRecords(
      'marketing',
      [
        {
          'First name': 'Jane',
          Email: 'jane@example.com',
          Phone: '0412 345 678',
          Postcode: '4000',
          'UTM Source': 'facebook',
          'Enquiry date': '2026-01-10',
        },
      ],
      mapping,
      headers,
    );
    expect(assertNoPii(washed)).toEqual([]);
    expect(washed.enquiries?.[0].postcode).toBe('4000');
    expect(washed.enquiries?.[0].utmSource).toBe('facebook');
    expect(washed.enquiries?.[0].token).toBe(await hashPhoneDigits('412345678'));
    expect(JSON.stringify(washed.enquiries)).not.toContain('Jane');
    expect(JSON.stringify(washed.enquiries)).not.toContain('jane@example.com');
  });
});

describe('first touch vs walk-in', () => {
  it('keeps UTM when sales later tags walk-in', async () => {
    const token = await hashPhoneDigits('412345678');
    const joined = joinSalesToEnquiries(
      [
        {
          token,
          emailToken: null,
          crmId: null,
          postcode: '4000',
          suburb: null,
          enquiryDate: '2026-01-10',
          utmSource: 'facebook',
          utmMedium: 'paid',
          utmCampaign: 'solaw-reg',
          utmContent: null,
          source: 'facebook',
        },
      ],
      [
        {
          token,
          emailToken: null,
          crmId: null,
          postcode: '4000',
          suburb: null,
          enquiryDate: '2026-01-10',
          visitDate: '2026-01-20',
          eoiDate: '2026-02-01',
          contractDate: '2026-03-01',
          salesSourceTag: 'Walk in',
          isContract: true,
        },
      ],
    );
    expect(joined[0].firstTouchSource).toBe('facebook');
    expect(joined[0].salesTagOverridden).toBe(true);
    expect(joined[0].attributionKind).toBe('digital_first_touch');
  });

  it('lumps unmatched sales as offline', async () => {
    const token = await hashPhoneDigits('499999999');
    const joined = joinSalesToEnquiries(
      [],
      [
        {
          token,
          emailToken: null,
          crmId: null,
          postcode: '4217',
          suburb: null,
          enquiryDate: null,
          visitDate: null,
          eoiDate: null,
          contractDate: '2026-03-02',
          salesSourceTag: 'Walk in',
          isContract: true,
        },
      ],
    );
    expect(joined[0].attributionKind).toBe('offline');
    expect(joined[0].firstTouchSource).toBe('Walk in');
  });
});

describe('figures', () => {
  it('counts contract as the north star and lists actions', async () => {
    const fb = await hashPhoneDigits('411111111');
    const figures = buildFigures({
      enquiries: [
        {
          token: fb,
          emailToken: null,
          crmId: null,
          postcode: '4000',
          suburb: null,
          enquiryDate: '2026-01-01',
          utmSource: 'facebook',
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          source: 'facebook',
        },
      ],
      sales: [
        {
          token: fb,
          emailToken: null,
          crmId: null,
          postcode: '4000',
          suburb: null,
          enquiryDate: '2026-01-01',
          visitDate: null,
          eoiDate: null,
          contractDate: '2026-02-01',
          salesSourceTag: 'Walk in',
          isContract: true,
        },
      ],
      spend: [{ campaign: 'facebook-prospecting', source: 'facebook', amount: 4000, date: null }],
      ads: [
        {
          platform: 'meta',
          campaign: 'facebook-prospecting',
          adset: 'lookalike',
          adName: 'testimonial',
          spend: 4000,
          impressions: 10000,
          clicks: 200,
          results: 20,
          date: null,
        },
      ],
    });
    expect(figures.contractCount).toBe(1);
    expect(figures.salesTagsOverridden).toBe(1);
    expect(figures.channels[0].source).toBe('facebook');
    expect(figures.timing.medianDaysEnquiryToContract).toBe(31);
    const actions = suggestedActions(figures);
    expect(actions.some((a) => /facebook/i.test(a))).toBe(true);
    expect(figures.siteVisitCount).toBe(0);
  });
});

describe('busy-manager mapping', () => {
  it('hides unused columns and warns when phone and email are missing', () => {
    const headers = ['First name', 'Notes', 'Postcode', 'Enquiry date', 'UTM Source'];
    const mapping = suggestMapping(headers, 'marketing');
    expect(headersToReview(headers, mapping, 'marketing', false)).not.toContain('Notes');
    expect(headersToReview(headers, mapping, 'marketing', false)).toContain('Postcode');
    expect(mappingWarnings(mapping, 'marketing').some((w) => /phone or email/i.test(w))).toBe(true);
  });
});

describe('spend overlap', () => {
  it('blocks a unified total plus platform spend', () => {
    const msgs = spendOverlapMessages({
      unified: '25000',
      amounts: { meta: '4000' },
      hasFile: {},
    });
    expect(msgs.length).toBeGreaterThan(0);
  });

  it('blocks a typed total plus a file on the same platform', () => {
    const msgs = spendOverlapMessages({
      unified: '',
      amounts: { meta: '4000' },
      hasFile: { meta: true },
    });
    expect(msgs.some((m) => /Meta/i.test(m))).toBe(true);
  });

  it('sums mapped spend from a file before wash', () => {
    expect(
      mappedSpendTotal(
        [
          { 'Amount spent': '$1,200' },
          { 'Amount spent': '800' },
        ],
        { 'Amount spent': 'spend' },
      ),
    ).toBe(2000);
  });
});

describe('report lead-ins', () => {
  it('says visits are not converting when visits exist and contracts do not', () => {
    const figures = buildFigures({
      enquiries: [
        {
          token: 'a',
          emailToken: null,
          crmId: null,
          postcode: '4000',
          suburb: null,
          enquiryDate: '2026-01-01',
          utmSource: 'facebook',
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          source: 'facebook',
        },
      ],
      sales: [
        {
          token: 'a',
          emailToken: null,
          crmId: null,
          postcode: '4000',
          suburb: null,
          enquiryDate: '2026-01-01',
          visitDate: '2026-01-10',
          eoiDate: null,
          contractDate: null,
          salesSourceTag: null,
          isContract: false,
        },
      ],
      spend: [],
      ads: [],
    });
    expect(funnelMeaning(figures)).toMatch(/not converting|not in this file/i);
    expect(nextDollarDirection(figures)).toMatch(/next dollar/i);
  });
});

describe('sales findings name three sources', () => {
  it('comments on first, second and third by contracts then enquiries', () => {
    const figures = buildFigures({
      enquiries: [
        enquiry('a', 'facebook', '4000'),
        enquiry('b', 'google', '4000'),
        enquiry('c', 'google', '4217'),
        enquiry('d', 'linkedin', '4217'),
        enquiry('e', 'offline', '4670'),
      ],
      sales: [
        sale('a', true, '4000'),
        sale('b', true, '4000'),
        sale('c', true, '4217'),
        sale('d', true, '4217'),
      ],
      spend: [
        { campaign: 'm', source: 'facebook', amount: 2000, date: null },
        { campaign: 'g', source: 'google', amount: 6000, date: null },
        { campaign: 'l', source: 'linkedin', amount: 1000, date: null },
      ],
      ads: [],
    });
    const top = topSalesChannels(figures, 3);
    expect(top.map((c) => c.source)).toEqual(['google', 'facebook', 'linkedin']);
    const text = salesFindings(figures);
    expect(text).toMatch(/^First: google/);
    expect(text).toMatch(/Second: facebook/);
    expect(text).toMatch(/Third: linkedin/);
    expect(text).toMatch(/Cost per contract/);
    expect(fallbackCommentary('RVLV', figures).questions.find((q) => q.id === 'sales')?.findings).toBe(text);
  });
});

describe('next dollar vs results table', () => {
  it('directs spend and calls out a high-spend source with no contracts', () => {
    const figures = buildFigures({
      enquiries: [enquiry('a', 'facebook', '4000'), enquiry('b', 'google', '4000')],
      sales: [sale('a', true, '4000')],
      spend: [
        { campaign: 'm', source: 'facebook', amount: 1000, date: null },
        { campaign: 'g', source: 'google', amount: 9000, date: null },
      ],
      ads: [],
    });
    const direction = spendDirectionActions(figures).join(' ');
    expect(direction).toMatch(/Keep or increase activity on facebook/i);
    expect(direction).toMatch(/Do not fund google/i);
    expect(direction).not.toMatch(/^facebook is first-touch/i);
    expect(nextDollarDirection(figures)).toBe(direction);
  });
});

describe('buyer locations table and map', () => {
  it('shows up to ten postcodes and plots real AU centroids', () => {
    const enquiries = Array.from({ length: 12 }, (_, i) =>
      enquiry(String(i), 'facebook', String(4000 + i)),
    );
    const sales = [0, 1, 2, 3, 4].map((i) => sale(String(i), true, String(4000 + i)));
    const figures = buildFigures({ enquiries, sales, spend: [], ads: [] });
    const rows = locationTableRows(figures.postcodes, 10);
    expect(rows.length).toBe(10);
    expect(rows[0].postcode).toBe('4000');
    expect(locationFindings(figures)).toMatch(/4000/);
    expect(locationFindings(figures)).not.toMatch(/Highest contract count is postcode 4000 \(/);

    const bris = postcodeCentroid('4000');
    const perth = postcodeCentroid('6000');
    const hobart = postcodeCentroid('7000');
    expect(bris).not.toBeNull();
    expect(perth).not.toBeNull();
    expect(hobart).not.toBeNull();
    const b = projectLatLng(bris!.lat, bris!.lng);
    const p = projectLatLng(perth!.lat, perth!.lng);
    const h = projectLatLng(hobart!.lat, hobart!.lng);
    expect(p.x).toBeLessThan(b.x);
    expect(h.y).toBeGreaterThan(b.y);

    const dots = mapDots(figures.postcodes, 10);
    expect(dots.length).toBeGreaterThan(0);
    expect(dots.every((d) => d.postcode !== '9999')).toBe(true);
    const unknown = mapDots([{ postcode: '0001', enquiries: 4, contracts: 2 }], 10);
    expect(unknown).toEqual([]);
  });
});

describe('why ads are a ranked table not a run-on list', () => {
  it('names cheapest, volume and expensive once and tags continue vs investigate', () => {
    const figures = buildFigures({
      enquiries: [enquiry('a', 'facebook', '4000')],
      sales: [sale('a', true, '4000')],
      spend: [],
      ads: [
        { platform: 'meta', campaign: 'LEAD', adset: 'a', adName: 'BROCHURE - homes', spend: 29210, results: 1845, impressions: 0, clicks: 0, date: null },
        { platform: 'meta', campaign: 'LEAD', adset: 'a', adName: 'LEAD_AD1', spend: 8779, results: 366, impressions: 0, clicks: 0, date: null },
        { platform: 'meta', campaign: 'LEAD', adset: 'a', adName: 'AD3', spend: 7602, results: 95, impressions: 0, clicks: 0, date: null },
        { platform: 'meta', campaign: 'RET', adset: 'a', adName: 'RETARGETING_AD1', spend: 7005, results: 509, impressions: 0, clicks: 0, date: null },
        { platform: 'meta', campaign: 'LEAD', adset: 'b', adName: 'AD3', spend: 6875, results: 208, impressions: 0, clicks: 0, date: null },
        { platform: 'meta', campaign: 'LEAD', adset: 'a', adName: 'BROCHURE - homes', spend: 29210, results: 1845, impressions: 0, clicks: 0, date: null },
      ],
    });
    const text = whyFindings(figures);
    expect(text).toMatch(/RETARGETING_AD1 is the cheapest/);
    expect(text).toMatch(/BROCHURE - homes delivered the most results/);
    expect(text).toMatch(/AD3 is the most expensive/);
    expect(text).not.toMatch(/spend \$29210/);
    expect((text.match(/BROCHURE/g) || []).length).toBe(1);

    const rows = rankedAds(figures, 8);
    expect(rows[0].name).toBe('RETARGETING_AD1');
    expect(rows[0].read).toBe('Continue');
    expect(rows.some((r) => r.read === 'Investigate' && r.name === 'AD3')).toBe(true);
    expect(rows.filter((r) => r.name === 'BROCHURE - homes').length).toBe(1);
    expect(rows.filter((r) => r.name === 'AD3').length).toBe(2);
    expect(rows.find((r) => r.name === 'AD3' && r.detail)?.detail).toBeTruthy();
    expect(fallbackCommentary('RVLV', figures).questions.find((q) => q.id === 'why')?.adsCommentary).toBeNull();
  });
});

function enquiry(token: string, source: string, postcode: string) {
  return {
    token,
    emailToken: null,
    crmId: null,
    postcode,
    suburb: null,
    enquiryDate: '2026-01-01',
    utmSource: source,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    source,
  };
}

function sale(token: string, isContract: boolean, postcode: string) {
  return {
    token,
    emailToken: null,
    crmId: null,
    postcode,
    suburb: null,
    enquiryDate: '2026-01-01',
    visitDate: '2026-01-10',
    eoiDate: null,
    contractDate: isContract ? '2026-02-01' : null,
    salesSourceTag: null,
    isContract,
  };
}

describe('excel and names', () => {
  it('reads the first sheet of an xlsx workbook', async () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Phone', 'Postcode'],
      ['0412345678', '4000'],
    ]);
    XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
    const csv = await excelBufferToCsv(buf);
    expect(csv).toMatch(/Postcode/);
    expect(csv).toMatch(/4000/);
  });

  it('treats the same development name as one project', () => {
    expect(sameDevelopmentName('Solana Agnes Water', 'solana agnes water')).toBe(true);
    expect(sameDevelopmentName('Solana', 'Bankside')).toBe(false);
  });
});

describe('RVLV-style mapping', () => {
  it('maps DATE, medium, campaign, Source alt, buyer email and pipeline actions', () => {
    const leads = suggestMapping(
      ['DATE', 'FNAME', 'LNAME', 'EMAIL', 'PHONE', 'POSTCODE', 'Source alt', 'source', 'medium', 'campaign'],
      'marketing',
    );
    expect(leads.DATE).toBe('enquiryDate');
    expect(leads.FNAME).toBe('firstName');
    expect(leads.source).toBe('utmSource');
    expect(leads.medium).toBe('utmMedium');
    expect(leads.campaign).toBe('utmCampaign');
    expect(leads['Source alt']).toBe('source');

    const sales = suggestMapping(
      ['Created At', 'Assignee Email', 'Pipeline actions', 'Phone', 'Email', 'Postcode', 'Mailchimp Status', 'Last contacted'],
      'sales',
    );
    expect(sales['Pipeline actions']).toBe('status');
    expect(sales['Mailchimp Status']).toBe('ignore');
    expect(sales.Email).toBe('email');
    expect(sales['Assignee Email']).toBe('ignore');
    expect(sales['Last contacted']).toBe('lastContacted');
  });

  it('reads Asana pipeline stages as visit, EOI and contract', async () => {
    const headers = ['Phone', 'Pipeline actions', 'Created At', 'Last contacted'];
    const mapping = suggestMapping(headers, 'sales');
    const washed = await washRecords(
      'sales',
      [
        { Phone: '0412 000 001', 'Pipeline actions': 'site tour', 'Created At': '2026-01-01', 'Last contacted': '2026-01-20' },
        { Phone: '0412 000 002', 'Pipeline actions': 'sign eoi', 'Created At': '2026-01-01', 'Last contacted': '2026-02-01' },
        { Phone: '0412 000 003', 'Pipeline actions': 'Settled', 'Created At': '2026-01-01', 'Last contacted': '2026-03-01' },
        { Phone: '0412 000 004', 'Pipeline actions': 'contract crashed', 'Created At': '2026-01-01', 'Last contacted': '2026-03-01' },
      ],
      mapping,
      headers,
    );
    const sales = washed.sales ?? [];
    expect(sales.find((r) => r.visitDate)?.visitDate).toBe('2026-01-20');
    expect(sales.filter((r) => r.eoiDate).length).toBe(1);
    expect(sales.filter((r) => r.isContract).length).toBe(1);
    expect(sales.find((r) => r.salesSourceTag === 'contract crashed')?.isContract).toBe(false);
  });

  it('drops the Meta totals row so spend is not doubled', async () => {
    const headers = ['Campaign name', 'Amount spent (AUD)'];
    const mapping = suggestMapping(headers, 'spend');
    const washed = await washRecords(
      'spend',
      [
        { 'Campaign name': '', 'Amount spent (AUD)': '87037.23' },
        { 'Campaign name': 'LEAD AD', 'Amount spent (AUD)': '37345.87' },
        { 'Campaign name': 'RETARGETING', 'Amount spent (AUD)': '49691.36' },
      ],
      mapping,
      headers,
      { defaultPlatform: 'meta' },
    );
    const total = (washed.spend ?? []).reduce((s, r) => s + r.amount, 0);
    expect(total).toBeCloseTo(87037.23, 2);
  });

  it('puts Meta spend on Facebook/social sources, not only the word meta', () => {
    expect(advertisingPlatform('Facebook cpc')).toBe('meta');
    expect(advertisingPlatform('social ctlp')).toBe('meta');
    expect(advertisingPlatform('google_search online')).toBe('google');
    const figures = buildFigures({
      enquiries: [
        {
          token: 'a',
          emailToken: null,
          crmId: null,
          postcode: '4000',
          suburb: null,
          enquiryDate: '2026-01-01',
          utmSource: 'Facebook cpc',
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          source: 'Facebook cpc',
        },
        {
          token: 'b',
          emailToken: null,
          crmId: null,
          postcode: '4000',
          suburb: null,
          enquiryDate: '2026-01-01',
          utmSource: 'social ctlp',
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          source: 'social ctlp',
        },
      ],
      sales: [],
      spend: [{ campaign: 'LEAD AD', source: 'meta', amount: 100, date: null }],
      ads: [],
    });
    const fb = figures.channels.find((c) => c.source === 'Facebook cpc');
    const social = figures.channels.find((c) => c.source === 'social ctlp');
    expect(fb?.spend).toBe(50);
    expect(social?.spend).toBe(50);
    expect(figures.spendTotal).toBe(100);
  });

  it('does not treat google_search as a postcode', () => {
    const figures = buildFigures({
      enquiries: [
        {
          token: 'a',
          emailToken: null,
          crmId: null,
          postcode: 'google_search',
          suburb: null,
          enquiryDate: '2026-01-01',
          utmSource: 'google_search',
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          source: 'google_search',
        },
        {
          token: 'b',
          emailToken: null,
          crmId: null,
          postcode: '4670',
          suburb: null,
          enquiryDate: '2026-01-01',
          utmSource: 'google_search',
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          source: 'google_search',
        },
      ],
      sales: [],
      spend: [],
      ads: [],
    });
    expect(figures.postcodes.map((p) => p.postcode)).toEqual(['4670']);
    expect(suggestedActions(figures).join(' ')).not.toMatch(/google_search/);
  });

  it('does not count a crashed contract as a sale', () => {
    expect(funnelFromStatus('contract crashed').contract).toBe(false);
    expect(isWonContract('contract crashed', '2026-03-01')).toBe(false);
    expect(funnelFromStatus('Settled').contract).toBe(true);
  });
});

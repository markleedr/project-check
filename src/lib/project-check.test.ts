import { describe, expect, it } from 'vitest';
import { buildFigures, suggestedActions } from './aggregate';
import { hashPhoneDigits } from './hash';
import { joinSalesToEnquiries } from './join';
import { phoneJoinDigits } from './phone';
import { assertNoPii, washRecords } from './wash';
import { suggestMapping } from './columns';

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
  });
});

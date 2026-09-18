export type FileKind = 'marketing' | 'sales' | 'spend' | 'ads';

export type ColumnRole =
  | 'phone'
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'name'
  | 'address'
  | 'postcode'
  | 'suburb'
  | 'enquiryDate'
  | 'visitDate'
  | 'eoiDate'
  | 'contractDate'
  | 'utmSource'
  | 'utmMedium'
  | 'utmCampaign'
  | 'utmContent'
  | 'source'
  | 'status'
  | 'crmId'
  | 'spend'
  | 'campaign'
  | 'adset'
  | 'adName'
  | 'impressions'
  | 'clicks'
  | 'results'
  | 'platform'
  | 'date'
  | 'ignore';

export const PII_ROLES: ColumnRole[] = ['phone', 'email', 'firstName', 'lastName', 'name', 'address'];

export const ROLE_LABELS: Record<ColumnRole, string> = {
  phone: 'Phone (hashed, then dropped)',
  email: 'Email (hashed, then dropped)',
  firstName: 'First name (dropped)',
  lastName: 'Last name (dropped)',
  name: 'Name (dropped)',
  address: 'Street address (dropped)',
  postcode: 'Postcode',
  suburb: 'Suburb',
  enquiryDate: 'Enquiry date',
  visitDate: 'Site visit date',
  eoiDate: 'EOI date',
  contractDate: 'Contract date',
  utmSource: 'UTM source',
  utmMedium: 'UTM medium',
  utmCampaign: 'UTM campaign',
  utmContent: 'UTM content',
  source: 'Source / enquiry type',
  status: 'Status',
  crmId: 'CRM / record ID',
  spend: 'Spend',
  campaign: 'Campaign name',
  adset: 'Ad set',
  adName: 'Ad name',
  impressions: 'Impressions',
  clicks: 'Clicks',
  results: 'Results / leads',
  platform: 'Platform',
  date: 'Date',
  ignore: 'Do not use',
};

interface Spec {
  exact: string[];
  contains: string[];
  exclude: string[];
}

const SPECS: Partial<Record<ColumnRole, Spec>> = {
  phone: {
    exact: ['phone', 'mobile', 'mobilenumber', 'phonenumber', 'cell'],
    contains: ['phone', 'mobile', 'cell', 'telephone'],
    exclude: ['type', 'status', 'verified', 'optout', 'fax'],
  },
  email: {
    exact: ['email', 'emailaddress', 'e-mail'],
    contains: ['email'],
    exclude: ['type', 'optout'],
  },
  firstName: {
    exact: ['firstname', 'first', 'givenname'],
    contains: ['firstname', 'givenname'],
    exclude: [],
  },
  lastName: {
    exact: ['lastname', 'surname', 'lastname'],
    contains: ['lastname', 'surname', 'familyname'],
    exclude: [],
  },
  name: {
    exact: ['name', 'fullname', 'contactname'],
    contains: ['fullname', 'contactname'],
    exclude: ['campaign', 'ad', 'file', 'company', 'project'],
  },
  address: {
    exact: ['address', 'street', 'streetaddress'],
    contains: ['street', 'address1', 'addressline'],
    exclude: ['email', 'ip', 'web'],
  },
  postcode: {
    exact: ['postcode', 'postalcode', 'zip', 'zipcode', 'pcode'],
    contains: ['postcode', 'postal', 'zip'],
    exclude: [],
  },
  suburb: {
    exact: ['suburb', 'city', 'town', 'locality'],
    contains: ['suburb', 'locality'],
    exclude: [],
  },
  enquiryDate: {
    exact: ['enquirydate', 'inquirydate', 'leaddate', 'createdat', 'datecreated'],
    contains: ['enquir', 'inquir', 'created', 'lead date'],
    exclude: ['contract', 'eoi', 'visit', 'modified'],
  },
  visitDate: {
    exact: ['visitdate', 'inspectiondate', 'sitedate'],
    contains: ['visit', 'inspection', 'onsite'],
    exclude: [],
  },
  eoiDate: {
    exact: ['eoidate', 'reservationdate'],
    contains: ['eoi', 'expression', 'reservation'],
    exclude: [],
  },
  contractDate: {
    exact: ['contractdate', 'saledate', 'unconditionaldate', 'purchasedate'],
    contains: ['contract', 'sold', 'sale date', 'unconditional'],
    exclude: ['status'],
  },
  utmSource: {
    exact: ['utmsource', 'source'],
    contains: ['utm_source', 'utmsource'],
    exclude: [],
  },
  utmMedium: {
    exact: ['utmmedium'],
    contains: ['utm_medium', 'utmmedium'],
    exclude: [],
  },
  utmCampaign: {
    exact: ['utmcampaign'],
    contains: ['utm_campaign', 'utmcampaign'],
    exclude: [],
  },
  utmContent: {
    exact: ['utmcontent'],
    contains: ['utm_content', 'utmcontent'],
    exclude: [],
  },
  source: {
    exact: ['source', 'enquirysource', 'leadsource', 'howdidyouhear', 'channel'],
    contains: ['leadsource', 'enquirysource', 'hear', 'walkin', 'walk-in'],
    exclude: ['utm'],
  },
  status: {
    exact: ['status', 'stage', 'pipeline'],
    contains: ['status', 'stage'],
    exclude: ['utm'],
  },
  crmId: {
    exact: ['id', 'crmid', 'recordid', 'contactid', 'leadid'],
    contains: ['recordid', 'contactid', 'leadid', 'crm'],
    exclude: ['email', 'phone', 'campaign'],
  },
  spend: {
    exact: ['spend', 'amountspent', 'cost', 'amount'],
    contains: ['spend', 'amount spent', 'amountspent'],
    exclude: ['cpc', 'cpm', 'cpa'],
  },
  campaign: {
    exact: ['campaign', 'campaignname', 'campaign name'],
    contains: ['campaign name', 'campaignname'],
    exclude: ['id', 'status'],
  },
  adset: {
    exact: ['adset', 'ad set', 'adsetname', 'ad set name'],
    contains: ['ad set', 'adset'],
    exclude: ['id'],
  },
  adName: {
    exact: ['ad', 'adname', 'ad name', 'creative'],
    contains: ['ad name', 'adname', 'creative'],
    exclude: ['set', 'id', 'status'],
  },
  impressions: {
    exact: ['impressions', 'impr'],
    contains: ['impression'],
    exclude: [],
  },
  clicks: {
    exact: ['clicks', 'linkclicks'],
    contains: ['click'],
    exclude: ['ctr', 'cpc'],
  },
  results: {
    exact: ['results', 'leads', 'conversions', 'purchases'],
    contains: ['result', 'lead', 'conversion'],
    exclude: ['lead form', 'quality'],
  },
  platform: {
    exact: ['platform', 'publisher', 'channel'],
    contains: ['platform', 'publisher'],
    exclude: [],
  },
  date: {
    exact: ['date', 'day', 'reportingstarts'],
    contains: ['reporting start', 'day'],
    exclude: ['created', 'contract', 'birth'],
  },
};

export function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function score(header: string, spec: Spec): number {
  const n = normaliseHeader(header);
  const raw = header.toLowerCase();
  if (spec.exclude.some((x) => n.includes(x.replace(/[^a-z0-9]/g, '')) && !spec.exact.includes(n))) {
    if (spec.exclude.some((x) => raw.includes(x))) return -1;
  }
  if (spec.exact.includes(n) || spec.exact.includes(raw.trim())) return 10;
  if (spec.contains.some((c) => raw.includes(c) || n.includes(c.replace(/[^a-z0-9]/g, '')))) return 5;
  return 0;
}

export function suggestRole(header: string, kind: FileKind): ColumnRole {
  let best: ColumnRole = 'ignore';
  let bestScore = 0;
  const allowed = allowedRoles(kind);
  for (const role of allowed) {
    const spec = SPECS[role];
    if (!spec) continue;
    const s = score(header, spec);
    if (s > bestScore) {
      bestScore = s;
      best = role;
    }
  }
  return best;
}

export function allowedRoles(kind: FileKind): ColumnRole[] {
  const people: ColumnRole[] = [
    'phone', 'email', 'firstName', 'lastName', 'name', 'address', 'postcode', 'suburb',
    'enquiryDate', 'visitDate', 'eoiDate', 'contractDate', 'utmSource', 'utmMedium',
    'utmCampaign', 'utmContent', 'source', 'status', 'crmId', 'ignore',
  ];
  if (kind === 'marketing' || kind === 'sales') return people;
  return ['spend', 'campaign', 'adset', 'adName', 'impressions', 'clicks', 'results', 'platform', 'date', 'utmCampaign', 'utmSource', 'ignore'];
}

export function suggestMapping(headers: string[], kind: FileKind): Record<string, ColumnRole> {
  const used = new Set<ColumnRole>();
  const map: Record<string, ColumnRole> = {};
  for (const h of headers) {
    let role = suggestRole(h, kind);
    if (role !== 'ignore' && used.has(role)) role = 'ignore';
    if (role !== 'ignore') used.add(role);
    map[h] = role;
  }
  return map;
}

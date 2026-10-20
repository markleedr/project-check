import type { FileKind } from './columns';

export const FILE_ACCEPT = '.csv,.tsv,.txt,.xlsx,.xls';

export const FILE_FORMAT_HINT = 'Excel is fine. If you only have a weird export, use File → Save As → CSV.';

export interface UploadGuide {
  title: string;
  youGet: string;
  howTo: string;
  skip: string | null;
  required: boolean;
}

export const MARKETING_GUIDE: UploadGuide = {
  title: 'Marketing enquiries',
  youGet: 'How many people enquired, where they came from, and a match into the sales file.',
  howTo:
    'In your CRM, export contacts or leads for this development. Keep phone or email, the enquiry date, postcode, and the web source / UTM columns if they are there.',
  skip: null,
  required: true,
};

export const SALES_GUIDE: UploadGuide = {
  title: 'Sales file',
  youGet: 'Inspections, EOIs, contracts, settlements, and how long each step takes.',
  howTo:
    'Export everyone sales has spoken to for this development, including people who never enquired online. Keep phone or email (same as marketing), plus inspection, EOI, contract and settlement dates. A settled status is enough if you do not have a settlement date. Contract value is optional.',
  skip: null,
  required: true,
};

export const SPEND_GUIDE: UploadGuide = {
  title: 'What you paid',
  youGet: 'Cost per enquiry, inspection, EOI, contract and settlement, including spend by month.',
  howTo:
    'Type one number for the whole period, enter a monthly grid, or upload a spend file with a month column. Do not enter the same dollars twice.',
  skip: 'We can still say what sold. We cannot say what it cost.',
  required: false,
};

export const ADS_GUIDE: UploadGuide = {
  title: 'Ad-level exports',
  youGet: 'Which ads and creatives to keep, change or switch off.',
  howTo:
    'One file per platform, at ad level (not campaign totals). Meta: Ads Manager → Ads → Export. Google: Ads → download the ad table. LinkedIn: Campaign Manager → ads export.',
  skip: 'The report still answers where sales came from. “Why the marketing is working” stays thin.',
  required: false,
};

export const PLATFORM_EXPORT_HINT: Record<string, string> = {
  meta: 'Ads Manager → Ads (not Campaigns) → Export. Date range = this campaign period.',
  google: 'Google Ads → Campaigns → Ads → download the table for this period.',
  linkedin: 'Campaign Manager → Export. If the file has junk rows at the top, that is normal.',
  other: 'Export the ad table from whichever platform you ran.',
};

export function guideForKind(kind: FileKind): UploadGuide {
  if (kind === 'marketing') return MARKETING_GUIDE;
  if (kind === 'sales') return SALES_GUIDE;
  if (kind === 'spend') return SPEND_GUIDE;
  return ADS_GUIDE;
}

export function sameDevelopmentName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

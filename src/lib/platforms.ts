export const AD_PLATFORMS = [
  { id: 'meta', label: 'Meta (Facebook / Instagram)' },
  { id: 'google', label: 'Google Ads' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'other', label: 'Other' },
] as const;

export type AdPlatformId = (typeof AD_PLATFORMS)[number]['id'];

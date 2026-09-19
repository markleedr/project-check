import { suggestedActions, type ReportFigures } from './aggregate';
import type { ReportCommentary } from './report-spec';

export function fallbackCommentary(projectName: string, figures: ReportFigures): ReportCommentary {
  const actions = suggestedActions(figures);
  const top = figures.channels[0];
  const why =
    figures.ads.length === 0
      ? 'No ads export was in this run, so campaign and creative performance is not shown.'
      : figures.ads
          .slice()
          .sort((a, b) => b.spend - a.spend)
          .slice(0, 5)
          .map((a) => {
            const name = a.adName || a.adset || a.campaign || 'Untitled';
            const cpr = a.costPerResult != null ? `$${Math.round(a.costPerResult)} per result` : 'no result count';
            return `${name}: spend $${Math.round(a.spend)}, ${a.results} results, ${cpr}.`;
          })
          .join(' ');

  return {
    intro: `${projectName}: ${figures.contractCount} contracts from ${figures.enquiryCount} marketing enquiries. Spend in this upload is $${Math.round(figures.spendTotal)}.`,
    questions: [
      {
        id: 'sales',
        title: 'What is delivering sales?',
        findings: top
          ? `${top.source} is first-touch on ${top.contracts} of ${figures.contractCount} contracts, from ${top.enquiries} enquiries. ${figures.salesTagsOverridden} contracts had a later sales tag (often walk-in) that was ignored.`
          : 'No contracts were in the sales file, so channel mix for sales cannot be shown.',
        adsCommentary: null,
      },
      {
        id: 'timing',
        title: 'When do people buy?',
        findings:
          figures.timing.medianDaysEnquiryToContract == null
            ? 'Enquiry date or contract date is missing, so time to buy cannot be shown.'
            : `Median time from enquiry to contract is ${figures.timing.medianDaysEnquiryToContract} days (${figures.timing.sampleSize} contracts). ${figures.siteVisitCount} sales rows have a site visit date${
                figures.timing.medianDaysEnquiryToVisit != null
                  ? `, median ${figures.timing.medianDaysEnquiryToVisit} days from enquiry to visit`
                  : ''
              }.`,
        adsCommentary: null,
      },
      {
        id: 'why',
        title: 'Why is the marketing working?',
        findings: why,
        adsCommentary: figures.ads.length ? why : null,
      },
      {
        id: 'who',
        title: 'Who is buying?',
        findings:
          'The CRM export is basic. Buyer mix in this run is channel, postcode and time to contract only. Do not treat this as a persona.',
        adsCommentary: null,
      },
      {
        id: 'where',
        title: 'Where do buyers live?',
        findings: figures.postcodes[0]
          ? `Highest contract count is postcode ${figures.postcodes[0].postcode} (${figures.postcodes[0].contracts} contracts).`
          : 'No postcodes were in the wash.',
        adsCommentary: null,
      },
    ],
    actions,
    needsTesting: figures.guesses,
  };
}

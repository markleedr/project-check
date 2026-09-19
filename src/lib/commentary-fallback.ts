import { whyFindings } from './ads-findings';
import { suggestedActions, type ReportFigures } from './aggregate';
import type { ReportCommentary } from './report-spec';
import { locationFindings, salesFindings } from './sales-findings';

export function fallbackCommentary(projectName: string, figures: ReportFigures): ReportCommentary {
  const actions = suggestedActions(figures);

  return {
    intro: `${projectName}: ${figures.contractCount} contracts from ${figures.enquiryCount} marketing enquiries. Spend in this upload is $${Math.round(figures.spendTotal)}.`,
    questions: [
      {
        id: 'sales',
        title: 'What is delivering sales?',
        findings: salesFindings(figures),
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
        findings: whyFindings(figures),
        adsCommentary: null,
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
        findings: locationFindings(figures),
        adsCommentary: null,
      },
    ],
    actions,
    needsTesting: figures.guesses,
  };
}

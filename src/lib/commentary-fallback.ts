import { whyFindings } from './ads-findings';
import { suggestedActions, timingFindings, type ReportFigures } from './aggregate';
import type { ReportCommentary } from './report-spec';
import { locationFindings, salesFindings } from './sales-findings';

function settlementPhrase(figures: ReportFigures): string {
  const stage = figures.funnelStages?.find((row) => row.id === 'settlement');
  if (!stage || stage.gap) return 'settlement data needed';
  return `${figures.settlementCount} settlements`;
}

export function fallbackCommentary(projectName: string, figures: ReportFigures): ReportCommentary {
  const actions = suggestedActions(figures);

  return {
    intro: `${projectName}: ${figures.uniqueEnquirerCount ?? figures.enquiryCount} unique enquirers, ${figures.eoiCount} EOIs, ${figures.contractCount} contracts and ${settlementPhrase(figures)}. Spend in this upload is $${Math.round(figures.spendTotal)}.`,
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
        findings: timingFindings(figures),
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

export const CHECK_REPORT_YELLOW = '#FFD600';
export const CHECK_REPORT_INK = '#1A1A1A';
export const CHECK_REPORT_FONT = 'Montserrat';

export const QUESTIONS = [
  {
    id: 'sales' as const,
    title: 'What is delivering sales?',
    delivers: 'Buyer sources and channel performance from enquiries, sales and spend.',
    decision: 'Where to increase, reduce or investigate spending.',
  },
  {
    id: 'timing' as const,
    title: 'When do people buy?',
    delivers: 'Time between enquiry, site visit, EOI and contract.',
    decision: 'How long to nurture buyers and where follow-up needs attention.',
  },
  {
    id: 'why' as const,
    title: 'Why is the marketing working?',
    delivers: 'Patterns in campaign, creative and messaging from the ads export.',
    decision: 'What to continue, change or test next.',
  },
  {
    id: 'who' as const,
    title: 'Who is buying?',
    delivers: 'Buyer mix from the washed database. Personas only where the columns exist.',
    decision: 'Which buyer groups marketing and sales should focus on.',
  },
  {
    id: 'where' as const,
    title: 'Where do buyers live?',
    delivers: 'Postcode concentrations and trends.',
    decision: 'Which areas to prioritise.',
  },
];

export type QuestionId = (typeof QUESTIONS)[number]['id'];

export interface QuestionNarrative {
  id: QuestionId;
  title: string;
  findings: string;
  adsCommentary: string | null;
}

export interface ReportCommentary {
  intro: string;
  questions: QuestionNarrative[];
  actions: string[];
  needsTesting: string[];
}

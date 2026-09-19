import type { CSSProperties } from 'react';
import { BuyerMap } from '@/components/BuyerMap';
import { funnelMeaning, spendDirectionActions, type ReportFigures } from '@/lib/aggregate';
import { rankedAds, whyFindings } from '@/lib/ads-findings';
import { locationTableRows } from '@/lib/geo/project';
import {
  CHECK_REPORT_FONT,
  CHECK_REPORT_INK,
  CHECK_REPORT_YELLOW,
  QUESTIONS,
  type ReportCommentary,
} from '@/lib/report-spec';
import { locationFindings, salesFindings } from '@/lib/sales-findings';

const C = { yellow: CHECK_REPORT_YELLOW, ink: CHECK_REPORT_INK };

const sectionLabel: CSSProperties = {
  fontSize: 8,
  fontWeight: 600,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: '#5A5A57',
  marginBottom: '2mm',
};

export function CheckReportSheet({
  projectName,
  preparedAt,
  figures,
  commentary,
}: {
  projectName: string;
  preparedAt: string;
  figures: ReportFigures;
  commentary: ReportCommentary;
}) {
  const dateLabel = new Date(preparedAt).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Australia/Brisbane',
  });
  const locations = locationTableRows(figures.postcodes, 10);
  const spendActions = spendDirectionActions(figures);

  const card = (value: string | number, label: string) => (
    <div style={{ border: '1px solid #E4E4E0', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em' }}>{value}</div>
      <div style={{ fontSize: 8.6, color: '#5A5A57', marginTop: 2 }}>{label}</div>
    </div>
  );

  return (
    <div
      className="pp-report"
      style={{
        width: '210mm',
        margin: '0 auto',
        background: '#fff',
        fontFamily: `${CHECK_REPORT_FONT}, system-ui, sans-serif`,
        color: C.ink,
        display: 'flex',
        flexDirection: 'column',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '11mm 15mm 0' }}>
        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>
          project profile<span style={{ color: C.yellow }}>.</span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 10.5, lineHeight: 1.45 }}>
          full-funnel marketing
          <br />
          from concept to completion.
        </div>
      </div>

      <div style={{ flex: 1, padding: '9mm 15mm 6mm', display: 'flex', flexDirection: 'column', gap: '5mm' }}>
        <div>
          <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8A8A85' }}>
            Project Check · {dateLabel}
          </div>
          <h1 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, margin: '2.4mm 0 0' }}>
            {projectName}
          </h1>
          <p style={{ fontSize: 9.6, color: '#5A5A57', margin: '2mm 0 3mm' }}>
            Mid-campaign check · Prepared by Project Profile · All amounts AUD excluding GST.
          </p>
          <div style={{ height: 3, background: C.yellow }} />
        </div>

        <p style={{ fontSize: 9.6, lineHeight: 1.55, margin: 0 }}>{commentary.intro}</p>

        <div>
          <div style={sectionLabel}>Campaign Stats</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3mm' }}>
            {card(figures.enquiryCount.toLocaleString('en-AU'), 'Enquiries')}
            {card(figures.siteVisitCount.toLocaleString('en-AU'), 'Site visits')}
            {card(figures.eoiCount.toLocaleString('en-AU'), 'EOIs')}
            {card(figures.contractCount.toLocaleString('en-AU'), 'Contracts')}
          </div>
          <p style={{ fontSize: 8.6, color: '#5A5A57', margin: '2.4mm 0 0' }}>{funnelMeaning(figures)}</p>
          {figures.spendTotal > 0 && (
            <p style={{ fontSize: 8.6, color: '#5A5A57', margin: '1mm 0 0' }}>
              Spend in this check: ${Math.round(figures.spendTotal).toLocaleString('en-AU')}
            </p>
          )}
        </div>

        <div style={{ breakInside: 'avoid' }}>
          <div style={sectionLabel}>Where the next dollar should go</div>
          <p style={{ fontSize: 8.2, color: '#8A8A85', margin: '0 0 2mm' }}>
            Spend direction from this check, not a restatement of the table below.
          </p>
          <ul style={{ margin: 0, paddingLeft: '4.2mm' }}>
            {spendActions.map((a) => (
              <li key={a} style={{ fontSize: 9, lineHeight: 1.5, color: '#3A3A38' }}>
                {a}
              </li>
            ))}
          </ul>
        </div>

        {figures.channels.length > 0 && (
          <div style={{ breakInside: 'avoid' }}>
            <div style={sectionLabel}>Results by source</div>
            <p style={{ fontSize: 8.2, color: '#8A8A85', margin: '0 0 2mm' }}>What the numbers show. This is not spend advice.</p>
            <PrintTable
              headers={['Source', 'Enquiries', 'Contracts', 'Spend', 'Cost / contract']}
              rows={figures.channels.slice(0, 8).map((row) => [
                row.source,
                String(row.enquiries),
                String(row.contracts),
                row.spend ? `$${Math.round(row.spend).toLocaleString('en-AU')}` : '—',
                row.costPerContract != null ? `$${Math.round(row.costPerContract).toLocaleString('en-AU')}` : '—',
              ])}
            />
          </div>
        )}

        <div>
          <div style={sectionLabel}>Do these next</div>
          <ul style={{ margin: 0, paddingLeft: '4.2mm' }}>
            {commentary.actions.map((a) => (
              <li key={a} style={{ fontSize: 9, lineHeight: 1.5, color: '#3A3A38' }}>
                {a}
              </li>
            ))}
          </ul>
        </div>

        {QUESTIONS.map((q) => {
          const block = commentary.questions.find((x) => x.id === q.id);
          const findings =
            q.id === 'sales'
              ? salesFindings(figures)
              : q.id === 'where'
                ? locationFindings(figures)
                : q.id === 'why'
                  ? whyFindings(figures)
                  : block?.findings;
          return (
            <div key={q.id} style={{ breakInside: 'avoid' }}>
              <div style={sectionLabel}>{q.title}</div>
              <p style={{ fontSize: 8.2, color: '#8A8A85', margin: '0 0 2mm' }}>{q.decision}</p>
              <p style={{ fontSize: 9.4, lineHeight: 1.5, margin: 0 }}>{findings}</p>
              {q.id === 'why' && figures.ads.length > 0 && (
                <div style={{ marginTop: '3mm' }}>
                  <PrintTable
                    headers={['Creative', 'Spend', 'Results', 'Cost / result', 'Read']}
                    rows={rankedAds(figures, 8).map((r) => [
                      r.detail ? `${r.name} (${r.detail})` : r.name,
                      `$${Math.round(r.spend).toLocaleString('en-AU')}`,
                      r.results.toLocaleString('en-AU'),
                      r.costPerResult != null ? `$${Math.round(r.costPerResult).toLocaleString('en-AU')}` : '—',
                      r.read || '—',
                    ])}
                  />
                </div>
              )}
              {q.id === 'where' && locations.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 78mm', gap: '5mm', marginTop: '3mm', alignItems: 'start' }}>
                  <PrintTable
                    headers={['Postcode', 'Enquiries', 'Contracts']}
                    rows={locations.map((r) => [r.postcode, String(r.enquiries), String(r.contracts)])}
                  />
                  <BuyerMap postcodes={figures.postcodes} width={280} height={250} />
                </div>
              )}
            </div>
          );
        })}

        <div style={{ breakInside: 'avoid' }}>
          <div style={sectionLabel}>Do not brief as fact</div>
          <p style={{ fontSize: 8.2, color: '#8A8A85', margin: '0 0 2mm' }}>Not in the data. Needs testing.</p>
          <ul style={{ margin: 0, paddingLeft: '4.2mm' }}>
            {commentary.needsTesting.map((a) => (
              <li key={a} style={{ fontSize: 9, lineHeight: 1.5, color: '#3A3A38' }}>
                {a}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div
        style={{
          background: '#58585A',
          color: '#fff',
          padding: '6mm 15mm',
          display: 'grid',
          gridTemplateColumns: '40mm 1fr 1fr',
          alignItems: 'center',
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>
          pp<span style={{ color: C.yellow }}>.</span>
        </div>
        <div style={{ fontSize: 9.3, lineHeight: 1.55 }}>
          Project Profile
          <br />
          54/111 Eagle Street, Brisbane,
          <br />
          QLD 4000
        </div>
        <div style={{ fontSize: 9.3, lineHeight: 1.55 }}>
          07 3132 1625
          <br />
          admin@projectprofile.agency
          <br />
          www.projectprofile.agency
        </div>
      </div>
    </div>
  );
}

function PrintTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const cols = headers.length;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8.6 }}>
      <thead>
        <tr>
          {headers.map((h) => (
            <th
              key={h}
              style={{
                textAlign: 'left',
                fontWeight: 600,
                color: '#5A5A57',
                padding: '1.4mm 2mm',
                borderBottom: '1px solid #E4E4E0',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontSize: 7.4,
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ background: i % 2 ? '#FAFAF8' : '#fff' }}>
            {row.map((cell, j) => (
              <td
                key={j}
                style={{
                  padding: '1.6mm 2mm',
                  borderBottom: '1px solid #E4E4E0',
                  width: `${100 / cols}%`,
                }}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

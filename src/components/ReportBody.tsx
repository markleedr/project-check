import { BuyerMap } from '@/components/BuyerMap';
import type { ReportFigures } from '@/lib/aggregate';
import { funnelMeaning, spendDirectionActions } from '@/lib/aggregate';
import { rankedAds, whyFindings } from '@/lib/ads-findings';
import { locationTableRows } from '@/lib/geo/project';
import type { ReportCommentary } from '@/lib/report-spec';
import { QUESTIONS } from '@/lib/report-spec';
import { locationFindings, salesFindings } from '@/lib/sales-findings';

export function ReportBody({
  figures,
  commentary,
}: {
  figures: ReportFigures;
  commentary: ReportCommentary;
}) {
  const spendActions = spendDirectionActions(figures);
  const locations = locationTableRows(figures.postcodes, 10);

  return (
    <div>
      <p className="mt-6 max-w-3xl text-sm leading-relaxed">{commentary.intro}</p>

      <section className="mt-10 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Do these next</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
          {commentary.actions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ol>
      </section>

      <div className="mt-8 grid gap-3 sm:grid-cols-4">
        <Stat label="Enquiries" value={figures.enquiryCount} />
        <Stat label="Site visits" value={figures.siteVisitCount} />
        <Stat label="EOIs" value={figures.eoiCount} />
        <Stat label="Contracts" value={figures.contractCount} />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{funnelMeaning(figures)}</p>
      {figures.spendTotal > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">
          Spend in this check: ${Math.round(figures.spendTotal).toLocaleString()}
        </p>
      )}

      <section className="mt-8 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Where the next dollar should go</h2>
        <p className="mt-1 text-xs text-muted-foreground">Spend direction from this check, not a restatement of the table below.</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
          {spendActions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ol>
      </section>

      {figures.channels.length > 0 && (
        <section className="mt-8 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Results by source</h2>
          <p className="mt-1 text-xs text-muted-foreground">What the numbers show. This is not spend advice.</p>
          <div className="mt-4 overflow-auto">
            <ChannelTable figures={figures} />
          </div>
        </section>
      )}

      <section className="mt-10 space-y-6">
        <h2 className="font-semibold">The five questions</h2>
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
            <article key={q.id} className="rounded-xl border bg-card p-5">
              <h3 className="font-semibold">{q.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{q.decision}</p>
              <p className="mt-3 text-sm leading-relaxed">{findings}</p>
              {q.id === 'why' && figures.ads.length > 0 && (
                <div className="mt-4 overflow-auto">
                  <AdsTable figures={figures} />
                </div>
              )}
              {q.id === 'where' && locations.length > 0 && (
                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                  <LocationTable rows={locations} />
                  <BuyerMap postcodes={figures.postcodes} />
                </div>
              )}
            </article>
          );
        })}
      </section>

      <section className="mt-6 rounded-xl border bg-[hsl(var(--highlight))] p-5">
        <h2 className="font-semibold">Do not brief as fact</h2>
        <p className="mt-1 text-xs text-muted-foreground">Not in the data. Needs testing.</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {commentary.needsTesting.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function AdsTable({ figures }: { figures: ReportFigures }) {
  const rows = rankedAds(figures, 8);
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="text-muted-foreground">
          <th className="py-1 pr-3 font-medium">Creative</th>
          <th className="py-1 pr-3 font-medium">Spend</th>
          <th className="py-1 pr-3 font-medium">Results</th>
          <th className="py-1 pr-3 font-medium">Cost / result</th>
          <th className="py-1 font-medium">Read</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-t">
            <td className="py-1.5 pr-3">
              <div>{row.name}</div>
              {row.detail && <div className="text-xs text-muted-foreground">{row.detail}</div>}
            </td>
            <td className="py-1.5 pr-3">${Math.round(row.spend).toLocaleString()}</td>
            <td className="py-1.5 pr-3">{row.results.toLocaleString()}</td>
            <td className="py-1.5 pr-3">
              {row.costPerResult != null ? `$${Math.round(row.costPerResult).toLocaleString()}` : '—'}
            </td>
            <td className="py-1.5">
              {row.read ? (
                <span
                  className={
                    row.read === 'Continue'
                      ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800'
                      : 'rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800'
                  }
                >
                  {row.read}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ChannelTable({ figures }: { figures: ReportFigures }) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="text-muted-foreground">
          <th className="py-1 pr-3 font-medium">Source</th>
          <th className="py-1 pr-3 font-medium">Enquiries</th>
          <th className="py-1 pr-3 font-medium">Contracts</th>
          <th className="py-1 pr-3 font-medium">Spend</th>
          <th className="py-1 font-medium">Cost / contract</th>
        </tr>
      </thead>
      <tbody>
        {figures.channels.slice(0, 8).map((row) => (
          <tr key={row.source} className="border-t">
            <td className="py-1 pr-3">{row.source}</td>
            <td className="py-1 pr-3">{row.enquiries}</td>
            <td className="py-1 pr-3">{row.contracts}</td>
            <td className="py-1 pr-3">{row.spend ? `$${Math.round(row.spend).toLocaleString()}` : '—'}</td>
            <td className="py-1">
              {row.costPerContract != null ? `$${Math.round(row.costPerContract).toLocaleString()}` : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function LocationTable({ rows }: { rows: { postcode: string; enquiries: number; contracts: number }[] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="text-muted-foreground">
          <th className="py-1 pr-3 font-medium">Postcode</th>
          <th className="py-1 pr-3 font-medium">Enquiries</th>
          <th className="py-1 font-medium">Contracts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.postcode} className="border-t">
            <td className="py-1 pr-3">{row.postcode}</td>
            <td className="py-1 pr-3">{row.enquiries}</td>
            <td className="py-1">{row.contracts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

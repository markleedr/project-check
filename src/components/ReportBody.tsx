import type { ReportFigures } from '@/lib/aggregate';
import { funnelMeaning, nextDollarMeaning } from '@/lib/aggregate';
import type { ReportCommentary } from '@/lib/report-spec';
import { QUESTIONS } from '@/lib/report-spec';

export function ReportBody({
  figures,
  commentary,
  print,
}: {
  figures: ReportFigures;
  commentary: ReportCommentary;
  print?: boolean;
}) {
  const heading = print ? 'text-base font-semibold' : 'font-semibold';
  const card = print ? 'mt-6 break-inside-avoid' : 'rounded-xl border bg-card p-5';
  const muted = print ? 'text-neutral-500' : 'text-muted-foreground';

  return (
    <div className={print ? 'text-black' : ''}>
      <p className={`text-sm leading-relaxed ${print ? '' : 'mt-6 max-w-3xl'}`}>{commentary.intro}</p>

      <section className={print ? 'mt-6' : 'mt-10 rounded-xl border bg-card p-5'}>
        <h2 className={heading}>Do these next</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
          {commentary.actions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ol>
      </section>

      <div className={print ? 'mt-4 grid grid-cols-4 gap-3 text-sm' : 'mt-8 grid gap-3 sm:grid-cols-4'}>
        <Stat print={print} label="Enquiries" value={figures.enquiryCount} />
        <Stat print={print} label="Site visits" value={figures.siteVisitCount} />
        <Stat print={print} label="EOIs" value={figures.eoiCount} />
        <Stat print={print} label="Contracts" value={figures.contractCount} />
      </div>
      <p className={`mt-3 text-sm ${muted}`}>{funnelMeaning(figures)}</p>
      {figures.spendTotal > 0 && (
        <p className={`mt-1 text-sm ${muted}`}>Spend in this check: ${Math.round(figures.spendTotal).toLocaleString()}</p>
      )}

      <section className={print ? 'mt-6 break-inside-avoid' : 'mt-8 rounded-xl border bg-card p-5'}>
        <h2 className={heading}>Where the next dollar should go</h2>
        <p className="mt-3 text-sm leading-relaxed">{nextDollarMeaning(figures)}</p>
        {figures.channels.length > 0 && (
          <div className="mt-4 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={muted}>
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
          </div>
        )}
      </section>

      <section className={print ? 'mt-6' : 'mt-10 space-y-6'}>
        <h2 className={`${heading} ${print ? 'mt-0' : ''}`}>The five questions</h2>
        {QUESTIONS.map((q) => {
          const block = commentary.questions.find((x) => x.id === q.id);
          return (
            <article key={q.id} className={print ? 'mt-4 break-inside-avoid' : 'rounded-xl border bg-card p-5'}>
              <h3 className={print ? 'text-sm font-semibold' : 'font-semibold'}>{q.title}</h3>
              <p className={`mt-1 text-xs ${muted}`}>{q.decision}</p>
              <p className="mt-3 text-sm leading-relaxed">{block?.findings}</p>
              {block?.adsCommentary && (
                <p className={`mt-3 text-sm leading-relaxed ${muted}`}>{block.adsCommentary}</p>
              )}
            </article>
          );
        })}
      </section>

      <section
        className={
          print
            ? 'mt-6 break-inside-avoid'
            : 'mt-6 rounded-xl border bg-[hsl(var(--highlight))] p-5'
        }
      >
        <h2 className={heading}>Do not brief as fact</h2>
        <p className={`mt-1 text-xs ${muted}`}>Not in the data. Needs testing.</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {commentary.needsTesting.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  print,
}: {
  label: string;
  value: string | number;
  print?: boolean;
}) {
  if (print) {
    return (
      <div>
        <div className="text-xs text-neutral-500">{label}</div>
        <div className="text-lg font-semibold">{value}</div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

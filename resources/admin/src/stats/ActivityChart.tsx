import { __, sprintf } from '@wordpress/i18n';
import { formatCount } from './format';

/** A truthful daily series, with the same values available as a keyboard-readable table. */
export function ActivityChart({ label, byDay }: { label: string; byDay: Record<string, number> }) {
  const days = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));
  const peak = Math.max(0, ...days.map(([, count]) => count));
  const step = 600 / Math.max(1, days.length);

  return (
    <div className="wconvert-report-chart">
      <p className="m-0 mb-3 text-note font-medium text-muted-foreground">{sprintf(__('%s per day', 'wconvert'), label)}</p>
      {peak === 0 ? (
        <div className="flex min-h-24 items-center justify-center text-note text-muted-foreground">
          {sprintf(__('No %s recorded in this period.', 'wconvert'), label.toLocaleLowerCase())}
        </div>
      ) : (
        <>
          <div className="wconvert-report-chart__plot" aria-hidden="true">
            <div className="wconvert-report-chart__axis"><span>{formatCount(peak)}</span><span>0</span></div>
            <svg viewBox="0 0 600 120" preserveAspectRatio="none" focusable="false">
              {[0, .5, 1].map((part) => <line key={part} x1="0" x2="600" y1={120 - part * 119} y2={120 - part * 119} />)}
              {days.map(([day, count], index) => <rect key={day} x={index * step + step * .15} y={120 - count / peak * 119} width={step * .7} height={count / peak * 119} rx="1"><title>{`${day}: ${formatCount(count)}`}</title></rect>)}
            </svg>
          </div>
          <div className="wconvert-report-chart__dates"><span>{days[0]?.[0]}</span><span>{days.at(-1)?.[0]}</span></div>
          <details className="wconvert-panel-details mt-2">
            <summary>{__('View daily numbers', 'wconvert')}</summary>
            <table className="wconvert-daily-numbers">
              <caption className="sr-only">{sprintf(__('%s per day', 'wconvert'), label)}</caption>
              <thead><tr><th scope="col">{__('Date', 'wconvert')}</th><th scope="col">{label}</th></tr></thead>
              <tbody>{days.map(([day, count]) => <tr key={day}><th scope="row">{day}</th><td>{formatCount(count)}</td></tr>)}</tbody>
            </table>
          </details>
        </>
      )}
    </div>
  );
}

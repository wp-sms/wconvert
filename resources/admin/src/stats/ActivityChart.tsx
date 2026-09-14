import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import type { Numbers } from './api';
import { formatCount, formatRate } from './format';
import { dateLabel } from './reporting';

/** A missing denominator is a gap, not a zero-percent result. */
export function ActivityChart({
  label,
  numbers,
  previous,
}: {
  label: string;
  numbers: Numbers;
  previous?: Numbers;
}) {
  const [metric, setMetric] = useState<'results' | 'rate' | 'shown'>('results');
  const series = (n: Numbers) =>
    Object.entries(n.impression_by_day)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, shown]) => ({
        day,
        value:
          metric === 'shown'
            ? shown
            : metric === 'results'
              ? (n.conversion_by_day[day] ?? 0)
              : shown
                ? (n.conversion_by_day[day] ?? 0) / shown
                : null,
      }));
  const current = series(numbers),
    prior = previous ? series(previous) : [];
  const maximum = Math.max(
    0,
    ...[...current, ...prior].map((d) => d.value ?? 0),
  );
  const peak =
    metric === 'rate'
      ? Math.max(0.01, Math.ceil(maximum * 100) / 100)
      : Math.max(2, Math.ceil(maximum / 2) * 2);
  const format = (n: number | null) =>
    n === null ? '—' : metric === 'rate' ? formatRate(n) : formatCount(n);
  const path = (days: typeof current) =>
    days
      .map((d, index) =>
        d.value === null
          ? ''
          : `${index === 0 || days[index - 1].value === null ? 'M' : 'L'}${20 + (index / Math.max(1, days.length - 1)) * 920},${160 - (d.value / peak) * 140}`,
      )
      .join(' ');
  const isolatedPoints = (days: typeof current, previousPeriod = false) =>
    days.map((d, i) =>
      d.value !== null &&
      days[i - 1]?.value == null &&
      days[i + 1]?.value == null ? (
        <circle
          key={d.day}
          className={previousPeriod ? 'wa-prior-point' : undefined}
          cx={20 + (i / Math.max(1, days.length - 1)) * 920}
          cy={160 - (d.value / peak) * 140}
          r="3"
        />
      ) : null,
    );
  return (
    <div className="wa-trend">
      <div className="wa-trend-heading">
        <h3>{__('Performance over time', 'wconvert')}</h3>
        <div
          className="wa-metric-tabs"
          role="group"
          aria-label={__('Chart metric', 'wconvert')}
        >
          {(
            [
              ['results', label],
              ['rate', __('Rate', 'wconvert')],
              ['shown', __('Times shown', 'wconvert')],
            ] as const
          ).map(([key, text]) => (
            <button
              type="button"
              key={key}
              aria-pressed={metric === key}
              onClick={() => setMetric(key)}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
      <div className="wa-chart-legend">
        <span>{__('Selected period', 'wconvert')}</span>
        {previous && (
          <span>{__('Previous period, aligned by day', 'wconvert')}</span>
        )}
      </div>
      <svg
        className="wa-chart"
        viewBox="0 0 960 190"
        aria-hidden="true"
        focusable="false"
      >
        {[0, 0.5, 1].map((part) => (
          <g key={part}>
            <line
              x1="20"
              x2="940"
              y1={160 - part * 140}
              y2={160 - part * 140}
            />
            <text x="20" y={152 - part * 140}>
              {format(peak * part)}
            </text>
          </g>
        ))}
        {previous && <path className="wa-prior-line" d={path(prior)} />}
        <path className="wa-current-line" d={path(current)} />
        {isolatedPoints(prior, true)}
        {isolatedPoints(current)}
      </svg>
      <div className="wa-chart-dates">
        <span>{current[0] && dateLabel(current[0].day)}</span>
        <span>{current.at(-1) && dateLabel(current.at(-1)!.day)}</span>
      </div>
      <details className="wa-daily">
        <summary>{__('View exact daily numbers', 'wconvert')}</summary>
        <div>
          <table>
            <caption className="sr-only">
              {__('Daily performance', 'wconvert')}
            </caption>
            <thead>
              <tr>
                <th scope="col">{__('Date', 'wconvert')}</th>
                <th scope="col">
                  {metric === 'results'
                    ? label
                    : metric === 'shown'
                      ? __('Times shown', 'wconvert')
                      : __('Rate', 'wconvert')}
                </th>
                {previous && (
                  <>
                    <th scope="col">{__('Previous date', 'wconvert')}</th>
                    <th scope="col">{__('Previous value', 'wconvert')}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {current.map((d, i) => (
                <tr key={d.day}>
                  <th scope="row">{dateLabel(d.day)}</th>
                  <td>{format(d.value)}</td>
                  {previous && (
                    <>
                      <td>{prior[i] ? dateLabel(prior[i].day) : '—'}</td>
                      <td>{format(prior[i]?.value ?? null)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

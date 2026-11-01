import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { formatDay } from '../lib/format';
import { DataTable, DataTableBody, DataTableCell, DataTableColumn, DataTableHead, DataTableRow } from '../shell/DataTable';
import { Disclosure } from '../shell/Disclosure';
import { OptionStrip } from '../shell/OptionStrip';
import type { Numbers } from './api';
import { formatCount, formatRate } from './format';

type Metric = 'results' | 'rate' | 'shown';

/**
 * A missing denominator is a gap, not a zero-percent result.
 *
 * A window through today ends on a day still running (ADR 0177). Drawn like
 * the others, its point would dip and read as a drop, so the last segment is
 * dashed, the point hollow, and the day says "Today so far".
 */
export function ActivityChart({
  label,
  numbers,
  previous,
  partialDay,
}: {
  label: string;
  numbers: Numbers;
  previous?: Numbers;
  /** The site day still in progress, when the window ends on it. */
  partialDay?: string;
}) {
  const [metric, setMetric] = useState<Metric>('results');
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
  const metricName =
    metric === 'results' ? label : metric === 'shown' ? __('Shown', 'wconvert') : __('Rate', 'wconvert');
  const format = (n: number | null) =>
    n === null ? '—' : metric === 'rate' ? formatRate(n) : formatCount(n);
  const x = (index: number, count: number) => 20 + (index / Math.max(1, count - 1)) * 920;
  const y = (value: number) => 160 - (value / peak) * 140;
  const path = (days: typeof current, count = days.length) =>
    days
      .map((d, index) =>
        d.value === null
          ? ''
          : `${index === 0 || days[index - 1].value === null ? 'M' : 'L'}${x(index, count)},${y(d.value)}`,
      )
      .join(' ');
  const last = current.at(-1);
  const partial = partialDay !== undefined && last?.day === partialDay && last.value !== null ? last : undefined;
  const beforeLast = partial ? current.at(-2) : undefined;
  // The solid line stops at the last whole day; the running day hangs off it, dashed.
  const solid = partial ? current.slice(0, -1) : current;
  const partialLine = partial && beforeLast?.value != null
    ? `M${x(current.length - 2, current.length)},${y(beforeLast.value)} L${x(current.length - 1, current.length)},${y(partial.value!)}`
    : null;
  const todaySoFar = __('Today so far', 'wconvert');
  // `days` is a series drawn on the whole period's axis; a point counts as
  // isolated against the whole series, so the dashed running day is a neighbour.
  const isolatedPoints = (days: typeof current, whole: typeof current, previousPeriod = false) =>
    days.map((d, i) =>
      d.value !== null &&
      whole[i - 1]?.value == null &&
      whole[i + 1]?.value == null ? (
        <circle
          key={d.day}
          className={previousPeriod ? 'wa-prior-point' : undefined}
          cx={x(i, whole.length)}
          cy={y(d.value)}
          r="3"
        />
      ) : null,
    );
  return (
    <div className="wa-trend">
      <div className="wa-trend-heading">
        <h3>{__('Performance over time', 'wconvert')}</h3>
        <OptionStrip
          label={__('Chart metric', 'wconvert')}
          value={metric}
          options={[
            { value: 'results', label },
            { value: 'rate', label: __('Rate', 'wconvert') },
            { value: 'shown', label: __('Shown', 'wconvert') },
          ]}
          onChange={(value) => setMetric(value as Metric)}
        />
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
        <path className="wa-current-line" d={path(solid, current.length)} />
        {partialLine && <path className="wa-current-line wa-partial-line" d={partialLine} />}
        {isolatedPoints(prior, prior, true)}
        {isolatedPoints(solid, current)}
        {partial && (
          <circle className="wa-partial-point" cx={x(current.length - 1, current.length)} cy={y(partial.value!)} r="4">
            <title>{todaySoFar}</title>
          </circle>
        )}
      </svg>
      <div className="wa-chart-dates">
        <span>{current[0] && formatDay(current[0].day)}</span>
        <span>{current.at(-1) && formatDay(current.at(-1)!.day)}</span>
      </div>
      <Disclosure variant="inline" title={__('View exact daily numbers', 'wconvert')} className="wa-daily">
        <DataTable label={__('Daily performance', 'wconvert')}>
          <DataTableHead>
            <DataTableColumn>{__('Date', 'wconvert')}</DataTableColumn>
            <DataTableColumn numeric>{metricName}</DataTableColumn>
            {previous && (
              <>
                <DataTableColumn>{__('Previous date', 'wconvert')}</DataTableColumn>
                <DataTableColumn numeric>{__('Previous value', 'wconvert')}</DataTableColumn>
              </>
            )}
          </DataTableHead>
          <DataTableBody>
            {current.map((d, i) => (
              <DataTableRow key={d.day}>
                <DataTableCell label={__('Date', 'wconvert')}>
                  {formatDay(d.day)}
                  {d.day === partial?.day && <span className="wa-muted"> · {todaySoFar}</span>}
                </DataTableCell>
                <DataTableCell label={metricName} numeric>{format(d.value)}</DataTableCell>
                {previous && (
                  <>
                    <DataTableCell label={__('Previous date', 'wconvert')}>{prior[i] ? formatDay(prior[i].day) : '—'}</DataTableCell>
                    <DataTableCell label={__('Previous value', 'wconvert')} numeric>{format(prior[i]?.value ?? null)}</DataTableCell>
                  </>
                )}
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </Disclosure>
    </div>
  );
}

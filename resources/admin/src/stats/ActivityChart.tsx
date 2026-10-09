import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { formatDay } from '../lib/format';
import { DataTable, DataTableBody, DataTableCell, DataTableColumn, DataTableHead, DataTableRow } from '../shell/DataTable';
import { Disclosure } from '../shell/Disclosure';
import { OptionStrip } from '../shell/OptionStrip';
import type { Numbers } from './api';
import { formatCount, formatRate } from './format';

type Metric = 'results' | 'rate' | 'shown';

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
        <path className="wa-current-line" d={path(current)} />
        {isolatedPoints(prior, true)}
        {isolatedPoints(current)}
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
                <DataTableCell label={__('Date', 'wconvert')}>{formatDay(d.day)}</DataTableCell>
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

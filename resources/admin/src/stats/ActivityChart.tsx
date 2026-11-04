import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { __ } from '@wordpress/i18n';
import { useDirection } from '../hooks/useDirection';
import { formatChartDay, formatDay } from '../lib/format';
import { DataTable, DataTableBody, DataTableCell, DataTableColumn, DataTableHead, DataTableRow } from '../shell/DataTable';
import { Disclosure } from '../shell/Disclosure';
import { OptionStrip } from '../shell/OptionStrip';
import type { Numbers } from './api';
import { formatCount, formatRate } from './format';

type Metric = 'results' | 'rate' | 'shown';

/** The drawing's width before it is measured, and where nothing can measure it. */
const UNMEASURED_WIDTH = 960;
const NARROW_WIDTH = 480;
const HEIGHT = 190;
const TOOLTIP_GAP = 12;

/** The day nearest a position along the plot, with days spaced evenly from edge to edge. */
export function nearestDay(position: number, width: number, days: number): number | null {
  if (days === 0) return null;
  if (days === 1 || width <= 0) return 0;
  return Math.min(days - 1, Math.max(0, Math.round((position / width) * (days - 1))));
}

/**
 * Which days get a date under the line: about five across a wide plot, three
 * across a narrow one. One fewer that divides the period exactly beats a set
 * whose gaps visibly differ, as seven days in five dates would. Over a long
 * period, rounding a gap by a day cannot be seen.
 */
export function dateTicks(days: number, width: number): number[] {
  const wanted = width < NARROW_WIDTH ? 3 : 5;
  if (days <= wanted) return Array.from({ length: days }, (_, index) => index);
  for (let count = wanted; count >= 3; count--) {
    if ((days - 1) % (count - 1) === 0) return Array.from({ length: count }, (_, index) => (index * (days - 1)) / (count - 1));
  }
  return Array.from({ length: wanted }, (_, index) => Math.round((index * (days - 1)) / (wanted - 1)));
}

/** The element to draw into and its width in real pixels, so text keeps its size at every width. */
function usePlotWidth() {
  const plot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(UNMEASURED_WIDTH);
  useLayoutEffect(() => {
    const element = plot.current;
    if (!element) return;
    const measure = () => {
      const measured = element.getBoundingClientRect().width;
      if (measured > 0) setWidth(measured);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [plot, width] as const;
}

/**
 * A missing denominator is a gap, not a zero-percent result.
 *
 * A window through today ends on a day still running (ADR 0177). Drawn like
 * the others, its point would dip and read as a drop, so the last segment is
 * dashed, the point hollow, and the day says "Today so far".
 *
 * Drawn in real pixels and read by pointer (ADR 0185). The drawing stays hidden
 * from assistive technology, and the tooltip with it: the daily table below is
 * the route to the same numbers by keyboard or screen reader.
 */
export function ActivityChart({
  label,
  numbers,
  previous,
  partialDay,
  today,
}: {
  label: string;
  numbers: Numbers;
  previous?: Numbers;
  /** The site day still in progress, when the window ends on it. */
  partialDay?: string;
  /** The site's day, which decides the current year: a date in it needs no year. */
  today?: string;
}) {
  const [metric, setMetric] = useState<Metric>('results');
  const [plot, width] = usePlotWidth();
  const [pickedDay, setPickedDay] = useState<number | null>(null);
  const direction = useDirection();
  // A tap has no leave to end it, so a tap elsewhere does.
  const showing = pickedDay !== null;
  useEffect(() => {
    if (!showing) return;
    const dismiss = (event: globalThis.PointerEvent) => {
      if (!plot.current?.contains(event.target as Node)) setPickedDay(null);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [showing, plot]);
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
  const x = (index: number, count: number) => (index / Math.max(1, count - 1)) * width;
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
  const point = pickedDay === null ? undefined : current[pickedDay];
  const priorPoint = pickedDay === null ? undefined : prior[pickedDay];
  const pointX = pickedDay === null ? 0 : x(pickedDay, current.length);
  const pickDay = (event: PointerEvent<HTMLDivElement>) => {
    setPickedDay(nearestDay(event.clientX - event.currentTarget.getBoundingClientRect().left, width, current.length));
  };
  // Beside the hairline on the roomier side, and never past the plot's edges: a
  // percentage in `translate` is the tooltip's own width, so nothing measures it.
  const tooltipOffset = pointX > width / 2 ? `${pointX - TOOLTIP_GAP}px - 100%` : `${pointX + TOOLTIP_GAP}px`;
  return (
    <div className="wa-trend">
      <div className="wa-trend-heading">
        <h2>{__('Performance over time', 'wconvert')}</h2>
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
      {/* Time runs left to right whichever way the words run, so the line and its dates stay together (§15). */}
      <div className="wa-chart-block" dir="ltr">
        <div
          ref={plot}
          className="wa-chart-plot"
          onPointerMove={pickDay}
          onPointerDown={pickDay}
          onPointerLeave={(event) => {
            if (event.pointerType !== 'touch') setPickedDay(null);
          }}
          onPointerCancel={() => setPickedDay(null)}
        >
          <svg
            className="wa-chart"
            viewBox={`0 0 ${width} ${HEIGHT}`}
            aria-hidden="true"
            focusable="false"
          >
            {[0, 0.5, 1].map((part) => (
              <g key={part}>
                <line
                  x1="0"
                  x2={width}
                  y1={160 - part * 140}
                  y2={160 - part * 140}
                />
                <text x="0" y={152 - part * 140}>
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
            {point && pickedDay !== null && (
              <>
                <line className="wa-chart-cursor" x1={pointX} x2={pointX} y1="20" y2="160" />
                {priorPoint && priorPoint.value !== null && (
                  <circle className="wa-chart-dot wa-chart-dot-prior" cx={x(pickedDay, prior.length)} cy={y(priorPoint.value)} r="4" />
                )}
                {point.value !== null && <circle className="wa-chart-dot" cx={pointX} cy={y(point.value)} r="4" />}
              </>
            )}
          </svg>
          {point && (
            <div
              className="wa-chart-tip"
              aria-hidden="true"
              style={{ transform: `translateX(clamp(0px, calc(${tooltipOffset}), calc(${width}px - 100%)))` }}
            >
              {/* The words take the page's direction back, as the Flow map's cards do. */}
              <div dir={direction}>
                <div className="wa-chart-tip-row">
                  <span>{formatChartDay(point.day, today)}</span>
                  <strong>{format(point.value)}</strong>
                </div>
                {point.day === partialDay && <div className="wa-chart-tip-today">{todaySoFar}</div>}
                {previous && (
                  <div className="wa-chart-tip-row wa-chart-tip-prior">
                    <span>{priorPoint ? formatChartDay(priorPoint.day, today) : '—'}</span>
                    <strong>{format(priorPoint?.value ?? null)}</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="wa-chart-dates">
          {dateTicks(current.length, width).map((index) => (
            <span
              key={current[index].day}
              className={index === 0 ? 'wa-chart-date-first' : index === current.length - 1 ? 'wa-chart-date-last' : undefined}
              style={{ insetInlineStart: x(index, current.length) }}
            >
              <bdi>{formatChartDay(current[index].day, today)}</bdi>
            </span>
          ))}
        </div>
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

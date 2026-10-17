import { __ } from '@wordpress/i18n';
import { TriangleAlert } from 'lucide-react';
import type { Occasion } from '../discovery/api';
import { formatDateTick } from '../lib/format';
import { DAY, placeBar } from '../lib/occasion';
import { statusOf, campaignName, type OptinSummary } from '../optins/api';
import { spanOf } from './span';

/**
 * The occasion's days across, one bar per campaign (#277).
 *
 * A bar is clipped to the occasion, and a campaign that also shows before or
 * after it is flagged at that edge: the occasion's dates never schedule
 * anything (ADR 0149 §6), so a teaser that runs the week before is a fact to
 * see, not an error to fix.
 */
export function DateLine({ occasion, campaigns, today }: { occasion: Occasion; campaigns: readonly OptinSummary[]; today: string }) {
  const days = Math.round((Date.parse(`${occasion.end}T00:00:00Z`) - Date.parse(`${occasion.start}T00:00:00Z`)) / DAY) + 1;
  const step = days > 16 ? Math.ceil(days / 8) : 1;
  const ticks = Array.from({ length: Math.ceil(days / step) }, (_, index) => {
    const day = new Date(Date.parse(`${occasion.start}T00:00:00Z`) + index * step * DAY).toISOString().slice(0, 10);
    return { day, at: ((index * step + 0.5) / days) * 100 };
  });
  const todayAt = today >= occasion.start && today <= occasion.end
    ? ((Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${occasion.start}T00:00:00Z`)) / 3_600_000)) / (days * 24)) * 100
    : null;
  const bars = campaigns.map((row) => ({ row, bar: placeBar(occasion, row.starts_at, row.ends_at) }));
  return (
    <div className="wconvert-dateline">
      <div className="wconvert-dateline__grid" aria-hidden="true">
        <span />
        <div className="wconvert-dateline__axis">
          {ticks.map((tick, index) => (
            <span key={tick.day} style={{ insetInlineStart: `${tick.at}%` }}>
              {formatDateTick(tick.day, index === 0 || tick.day.endsWith('-01'))}
            </span>
          ))}
        </div>
      </div>
      <ul className="wconvert-dateline__rows">
        {bars.map(({ row, bar }) => {
          const name = campaignName(row);
          const outside = bar.before && bar.after
            ? __('Shows before and after the occasion', 'wconvert')
            : bar.before ? __('Shows before the occasion', 'wconvert')
              : bar.after ? __('Shows after the occasion', 'wconvert') : null;
          return (
            <li key={row.id} className="wconvert-dateline__grid">
              <span className="wconvert-dateline__label"><bdi>{name}</bdi></span>
              <div className="wconvert-dateline__track">
                {bar.width > 0 && (
                  <span
                    className={statusOf(row) === 'draft' ? 'wconvert-dateline__bar is-draft' : 'wconvert-dateline__bar'}
                    style={{ insetInlineStart: `${bar.left}%`, inlineSize: `${bar.width}%` }}
                    aria-hidden="true"
                  >{spanOf(row)}</span>
                )}
                {bar.before && <span className="wconvert-dateline__out is-before" title={outside ?? undefined} aria-hidden="true"><TriangleAlert />{bar.width === 0 && spanOf(row)}</span>}
                {bar.after && <span className="wconvert-dateline__out is-after" title={outside ?? undefined} aria-hidden="true"><TriangleAlert />{bar.width === 0 && spanOf(row)}</span>}
                {todayAt !== null && <span className="wconvert-dateline__today" style={{ insetInlineStart: `${todayAt}%` }} aria-hidden="true" />}
                <span className="sr-only">
                  {[name, spanOf(row), outside].filter(Boolean).join('. ')}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="wconvert-dateline__legend">
        <span><i className="wconvert-dateline__key" />{__('Published', 'wconvert')}</span>
        <span><i className="wconvert-dateline__key is-draft" />{__('Draft', 'wconvert')}</span>
        {bars.some(({ bar }) => bar.before || bar.after) && <span><TriangleAlert aria-hidden="true" />{__('Shows outside the occasion', 'wconvert')}</span>}
      </p>
    </div>
  );
}

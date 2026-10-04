import { __ } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Region, RegionBody, RegionHeader } from '../shell/Region';
import { editorHref, reportHref, type ReportQuery } from '../nav';
import { formatCount, formatRate } from './format';

interface Facts { appearances: number; results: number; rate: number | null; }
export interface Insight {
  rule_id: string; fingerprint: string; optin_id: string; goal: string; name: string;
  result_label: string; title: string; note: string; limitation: string; action: 'edit' | 'display';
  facts: { current: Facts; previous: Facts | null };
  periods: { from: string; to: string; previous_from: string | null; previous_to: string | null };
}

export function Insights({ items, query }: { items: Insight[]; query: ReportQuery }) {
  if (!items.length) return null;
  return <Region label={__('Needs attention', 'wconvert')}>
    <RegionHeader title={__('Needs attention', 'wconvert')} level={3} />
    <RegionBody><div className="wa-insights">{items.slice(0, 3).map(item => <article key={item.fingerprint} className="wa-insight">
      <div><p className="wa-muted">{item.name} · {__('Observed', 'wconvert')}</p><h4>{item.title}</h4><p>{item.note}</p>
        <details><summary>{__('View evidence', 'wconvert')}</summary>
          <p className="wa-muted">{item.result_label} · {item.periods.from} – {item.periods.to}</p>
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to scroll the labeled table region. */}
          <div className="wa-table-scroll" role="region" aria-label={__('Insight evidence', 'wconvert')} tabIndex={0}>
            <table className="wa-table"><thead><tr><th scope="col">{__('Period', 'wconvert')}</th><th scope="col">{__('Shown', 'wconvert')}</th><th scope="col">{__('Results', 'wconvert')}</th><th scope="col">{__('Rate', 'wconvert')}</th></tr></thead>
              <tbody><tr><th scope="row">{__('Selected period', 'wconvert')}</th><td>{formatCount(item.facts.current.appearances)}</td><td>{formatCount(item.facts.current.results)}</td><td>{formatRate(item.facts.current.rate)}</td></tr>
                {item.facts.previous && <tr><th scope="row">{item.periods.previous_from} – {item.periods.previous_to}</th><td>{formatCount(item.facts.previous.appearances)}</td><td>{formatCount(item.facts.previous.results)}</td><td>{formatRate(item.facts.previous.rate)}</td></tr>}
              </tbody></table></div><p className="wa-muted">{item.limitation}</p>
          <a href={reportHref({ ...query, optinId: item.optin_id, goal: undefined, impact: undefined, experiment: undefined })}>{__('View campaign report', 'wconvert')}</a>
        </details>
      </div>
      <Button asChild variant="outline"><a href={editorHref(item.optin_id, reportHref(query))}>{item.action === 'display' ? __('Review display settings', 'wconvert') : __('Edit campaign', 'wconvert')}</a></Button>
    </article>)}</div></RegionBody>
  </Region>;
}

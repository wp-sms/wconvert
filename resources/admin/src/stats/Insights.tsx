import { DataTable, DataTableHead, DataTableBody, DataTableRow, DataTableColumn, DataTableCell } from '../shell/DataTable';
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
          <DataTable label={__('Insight evidence', 'wconvert')}>
            <DataTableHead><DataTableColumn>{__('Period', 'wconvert')}</DataTableColumn><DataTableColumn numeric>{__('Shown', 'wconvert')}</DataTableColumn><DataTableColumn numeric>{__('Results', 'wconvert')}</DataTableColumn><DataTableColumn numeric>{__('Rate', 'wconvert')}</DataTableColumn></DataTableHead>
            <DataTableBody>{[{ title: __('Selected period', 'wconvert'), facts: item.facts.current }, ...(item.facts.previous ? [{ title: `${item.periods.previous_from} – ${item.periods.previous_to}`, facts: item.facts.previous }] : [])].map(row => <DataTableRow key={row.title}>
              <DataTableCell label={__('Period', 'wconvert')}>{row.title}</DataTableCell><DataTableCell label={__('Shown', 'wconvert')} numeric>{formatCount(row.facts.appearances)}</DataTableCell><DataTableCell label={__('Results', 'wconvert')} numeric>{formatCount(row.facts.results)}</DataTableCell><DataTableCell label={__('Rate', 'wconvert')} numeric>{formatRate(row.facts.rate)}</DataTableCell>
            </DataTableRow>)}</DataTableBody>
          </DataTable><p className="wa-muted">{item.limitation}</p>
          <a href={reportHref({ ...query, optinId: item.optin_id, goal: undefined, impact: undefined, experiment: undefined })}>{__('View campaign report', 'wconvert')}</a>
        </details>
      </div>
      <Button asChild variant="outline"><a href={editorHref(item.optin_id, reportHref(query))}>{item.action === 'display' ? __('Review display settings', 'wconvert') : __('Edit campaign', 'wconvert')}</a></Button>
    </article>)}</div></RegionBody>
  </Region>;
}

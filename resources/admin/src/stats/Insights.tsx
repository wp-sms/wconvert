import { DataTable, DataTableHead, DataTableBody, DataTableRow, DataTableColumn, DataTableCell } from '../shell/DataTable';
import { ListChecks, Eye, TrendingDown } from 'lucide-react';
import { ReportTarget } from './ReportNavigation';
import { ReportDisclosure } from './ReportDisclosure';
import { rangeLabel } from './reporting';
import { __ } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Region, RegionHeader } from '../shell/Region';
import { editorHref, reportHref, type ReportQuery } from '../nav';
import { formatCount, formatRate } from './format';

interface Facts { appearances: number; results: number; rate: number | null; }
export interface Insight {
  rule_id: string; fingerprint: string; optin_id: string; goal: string; name: string;
  result_label: string; rate_label?: string; title: string; note: string; limitation: string; action: 'edit' | 'display';
  facts: { current: Facts; previous: Facts | null };
  periods: { from: string; to: string; previous_from: string | null; previous_to: string | null };
}

export function Insights({ items, query }: { items: Insight[]; query: ReportQuery }) {
  if (!items.length) return null;
  return <ReportTarget name="attention" label={__('Needs attention', 'wconvert')}><Region className="wa-report">
    <RegionHeader title={__('Needs attention', 'wconvert')} level={3} icon={<ListChecks />} />
    <div className="wa-insights">{items.slice(0, 3).map(item => {
      const metric = item.rule_id === 'lower_rate' ? 'rate' : 'appearances';
      const value = (facts: Facts) => metric === 'rate' ? formatRate(facts.rate) : formatCount(facts.appearances);
      const Icon = item.rule_id === 'no_appearances' ? Eye : TrendingDown;
      return <article key={item.fingerprint} className="wa-insight">
        <div className="wa-insight-main">
          <span className="wa-report-icon" aria-hidden="true"><Icon className="size-5" /></span>
          <div className="wa-insight-copy">
            <a className="wa-report-identity" href={reportHref({ ...query, optinId: item.optin_id, goal: undefined, impact: undefined, experiment: undefined })}>{item.name}</a>
            <h4>{item.title}</h4><p className="wa-muted">{item.note}</p>
          </div>
          <div className="wa-insight-fact"><span className="wa-muted">{metric === 'rate' ? item.rate_label ?? item.result_label : __('Times shown', 'wconvert')}</span>
            <strong>{value(item.facts.current)}</strong>
            {item.facts.previous && <span className="wa-muted">{__('Previously', 'wconvert')} {value(item.facts.previous)}</span>}
          </div>
        </div>
        <div className="wa-insight-action wconvert-toolbar">
          <Button asChild variant="outline"><a href={editorHref(item.optin_id, reportHref(query), item.action === 'display' ? 'rules' : undefined)}>{item.action === 'display' ? __('Review display rules', 'wconvert') : __('Edit campaign', 'wconvert')}</a></Button>
        </div>
        <ReportDisclosure title={__('View evidence', 'wconvert')}>
          <DataTable label={__('Insight evidence', 'wconvert')}>
            <DataTableHead><DataTableColumn>{__('Period', 'wconvert')}</DataTableColumn><DataTableColumn numeric>{__('Shown', 'wconvert')}</DataTableColumn><DataTableColumn numeric>{item.result_label}</DataTableColumn><DataTableColumn numeric>{__('Rate', 'wconvert')}</DataTableColumn></DataTableHead>
            <DataTableBody>{[{ title: rangeLabel(item.periods.from, item.periods.to), facts: item.facts.current }, ...(item.facts.previous ? [{ title: rangeLabel(item.periods.previous_from!, item.periods.previous_to!), facts: item.facts.previous }] : [])].map(row => <DataTableRow key={row.title}>
              <DataTableCell label={__('Period', 'wconvert')}>{row.title}</DataTableCell><DataTableCell label={__('Shown', 'wconvert')} numeric>{formatCount(row.facts.appearances)}</DataTableCell><DataTableCell label={item.result_label} numeric>{formatCount(row.facts.results)}</DataTableCell><DataTableCell label={__('Rate', 'wconvert')} numeric>{formatRate(row.facts.rate)}</DataTableCell>
            </DataTableRow>)}</DataTableBody>
          </DataTable><p className="wa-muted">{item.limitation}</p>
        </ReportDisclosure>
      </article>;
    })}</div>
  </Region></ReportTarget>;
}

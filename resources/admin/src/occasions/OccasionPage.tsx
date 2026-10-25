import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ArrowLeft, CalendarDays, Copy, Download, Megaphone, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { AdminDialog, AdminDialogBody, AdminDialogContent, AdminDialogFooter, AdminDialogHeader } from '../components/ui/admin-dialog';
import { DropdownMenu, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { OptionGroup, OptionItem, OptionMenuContent, OptionSeparator } from '../components/ui/option-menu';
import { saveOccasions, type Occasion, type Occasions } from '../discovery/api';
import { displayTypeLabel } from '../displayTypes';
import { formatCount, formatRange, formatRate, siteDay } from '../lib/format';
import { spanOf } from './span';
import { nextYearOf, occasionPhase, occasionTotals, occasionWindow, placeBar, type Phase } from '../lib/occasion';
import { createHref, occasionHref, optinsHref } from '../nav';
import { campaignName, deleteOptin, duplicateCampaign, listOptins, publishOptin, readCampaignPreviews, statusOf, unpublishOptin, type CampaignPreview, type OptinSummary } from '../optins/api';
import { CampaignMenu } from '../optins/CampaignMenu';
import { decisionCopy, type DecisionKind } from '../optins/decisionCopy';
import { StatusBadge } from '../optins/StatusBadge';
import { rowResultOf, shownLine } from '../optins/rowResult';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { DataTable, DataTableActions, DataTableActionsColumn, DataTableBody, DataTableCell, DataTableColumn, DataTableHead, DataTableRow } from '../shell/DataTable';
import { DateRangePicker, type DateRange } from '../shell/DateRangePicker';
import { EmptyState } from '../shell/EmptyState';
import { Field } from '../shell/Field';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { Region, RegionBody, RegionError, RegionErrorState, RegionFooter, RegionHeader } from '../shell/Region';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { Shell } from '../shell/Shell';
import { Stat, StatRow } from '../shell/Stat';
import { readReport, type DashboardPayload, type PeriodQuery } from '../stats/api';
import { copyOccasion, download, exportOccasion, readOccasions, type OccasionNotice } from './api';
import { DateLine } from './DateLine';
import { OccasionNoticeView } from './Notice';
import '../optins/campaigns.css';

const Design = lazy(() => import('../optins/CampaignDesign'));

/**
 * One occasion's own screen, at `#occasions/<id>` (#277, layout B of the
 * approved prototype): its results for a period, its dates with one bar per
 * campaign, and its campaigns. Copy, Export, Edit and Delete sit in the ⋯
 * beside the one primary action, New campaign in this occasion.
 *
 * It reads the same list projection the Campaigns screen reads, filtered by
 * `occasion`, so a campaign whose occasion was deleted is simply not here
 * (ADR 0149 §5).
 */
export function OccasionPage({ id, notice, onNotice, onDismissNotice, navigate, onEdit }: {
  id: string;
  notice: OccasionNotice | null;
  onNotice: (notice: OccasionNotice) => void;
  onDismissNotice: () => void;
  navigate: (hash: string) => void;
  onEdit: (campaignId: string) => void;
}) {
  const [occasions, setOccasions] = useState<Loadable<Occasions>>(LOADING);
  const [list, setList] = useState<Loadable<OptinSummary[]>>(LOADING);
  const [attempt, setAttempt] = useState(0);
  const [range, setRange] = useState<DateRange>({ preset: 'occasion' });
  const [report, setReport] = useState<Loadable<DashboardPayload> | null>(null);
  const [previews, setPreviews] = useState<Record<string, CampaignPreview>>({});
  const [asking, setAsking] = useState<'copy' | 'delete' | 'edit' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ kind: DecisionKind; row: OptinSummary } | null>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const rowFocus = useRef<HTMLElement | null>(null);
  const today = siteDay();

  useEffect(() => {
    let active = true;
    setOccasions(LOADING); setList(LOADING);
    readOccasions().then((data) => { if (active) setOccasions(ready(data)); }, (cause) => { if (active) setOccasions(failed(cause)); });
    listOptins().then((data) => { if (active) setList(ready(data)); }, (cause) => { if (active) setList(failed(cause)); });
    return () => { active = false; };
  }, [id, attempt]);

  const occasion = occasions.status === 'ready' ? occasions.data.items.find((item) => item.id === id) : undefined;
  const campaigns = useMemo(
    () => (list.status === 'ready' ? list.data.filter((row) => row.occasion === id && row.deleted_at === null) : []),
    [list, id],
  );
  const ids = campaigns.map((row) => row.id).join(',');

  // The window the Results read: the occasion's own days so far, or a preset.
  const query: PeriodQuery | null = occasion === undefined ? null
    : range.preset === 'occasion' ? occasionWindow(occasion, today)
      : range.preset === 'custom' ? { from: range.from, to: range.to }
        : range.preset === '7' || range.preset === '30' ? { days: Number(range.preset) } : null;
  const queryKey = query === null ? '' : JSON.stringify(query);
  useEffect(() => {
    if (queryKey === '' || ids === '') { setReport(null); return; }
    let active = true;
    setReport(LOADING);
    readReport(JSON.parse(queryKey) as PeriodQuery).then((data) => { if (active) setReport(ready(data)); }, (cause) => { if (active) setReport(failed(cause)); });
    return () => { active = false; };
  }, [queryKey, ids, attempt]);

  useEffect(() => {
    setPreviews({});
    if (ids === '') return;
    let active = true;
    const values = ids.split(','), batches: string[][] = [];
    for (let i = 0; i < values.length; i += 12) batches.push(values.slice(i, i + 12));
    void Promise.all(batches.map(readCampaignPreviews))
      .then((responses) => { if (active) setPreviews(Object.fromEntries(responses.flat().map((p) => [p.id, p]))); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [ids]);

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ms-3 self-start">
      <a href={optinsHref()}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Campaigns', 'wconvert')}</a>
    </Button>
  );
  const newCampaign = (
    <Button variant="brand" onClick={() => navigate(createHref({ occasion: id }))}>
      <Plus aria-hidden="true" />{__('New campaign in this occasion', 'wconvert')}
    </Button>
  );

  if (occasions.status === 'failed' || list.status === 'failed') {
    const message = occasions.status === 'failed' ? occasions.message : list.status === 'failed' ? list.message : '';
    return <Shell section="optins" pageTitle={__('Occasion', 'wconvert')} pageBack={back} hideDescription>
      <Region><RegionErrorState message={message} onRetry={() => setAttempt((n) => n + 1)} /></Region>
    </Shell>;
  }
  if (occasions.status === 'loading' || list.status === 'loading') {
    return <Shell section="optins" pageTitle={__('Occasion', 'wconvert')} pageBack={back} hideDescription>
      <RegionSkeleton label={__('Occasion', 'wconvert')} lines={6} />
    </Shell>;
  }
  if (occasion === undefined) {
    return <Shell section="optins" pageTitle={__('Occasion', 'wconvert')} pageBack={back} hideDescription>
      <Region>
        <EmptyState icon={CalendarDays} title={__('This occasion no longer exists', 'wconvert')}
          action={<Button asChild variant="outline"><a href={optinsHref()}>{__('Back to campaigns', 'wconvert')}</a></Button>}>
          {__('Its campaigns are still in Campaigns.', 'wconvert')}
        </EmptyState>
      </Region>
    </Shell>;
  }

  const items = occasions.status === 'ready' ? occasions.data : { schema: 1 as const, revision: 0, items: [] };
  const save = async (next: Occasion[]) => {
    setBusy(true); setError(null);
    try { setOccasions(ready(await saveOccasions({ ...items, items: next }))); return true; }
    catch (cause) { setError(messageOf(cause)); return false; }
    finally { setBusy(false); }
  };
  const copy = async () => {
    setAsking(null); setBusy(true); setError(null);
    try {
      const result = await copyOccasion(id);
      const total = result.created.length + result.failed.length;
      onNotice({
        occasion: result.occasion.id,
        kind: 'copy',
        title: result.failed.length === 0
          ? sprintf(/* translators: 1: how many campaigns, 2: an occasion's name. */ _n('Copied %1$d campaign into %2$s as a draft.', 'Copied %1$d campaigns into %2$s as drafts.', total, 'wconvert'), total, result.occasion.name)
          : sprintf(/* translators: 1: how many were copied, 2: how many there were, 3: an occasion's name. */ __('Copied %1$d of %2$d campaigns into %3$s as drafts.', 'wconvert'), result.created.length, total, result.occasion.name),
        problems: result.failed.map((failure) => sprintf(/* translators: 1: a campaign's name, 2: why it was not copied. */ __('%1$s wasn’t copied. %2$s', 'wconvert'), failure.name, failure.message)),
      });
      navigate(occasionHref(result.occasion.id));
    } catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  };
  // A row's action, then the page reads its list again: the same routes the Campaigns screen uses.
  const act = async (work: () => Promise<unknown>, name: string) => {
    setBusy(true); setError(null);
    try { await work(); setAttempt((n) => n + 1); }
    catch (cause) { setError(sprintf(/* translators: 1: a campaign's name, 2: why an action on it failed. */ __('%1$s: %2$s', 'wconvert'), name, messageOf(cause))); }
    finally { setBusy(false); }
  };
  const decide = ({ kind, row }: { kind: DecisionKind; row: OptinSummary }) => void act(
    () => kind === 'delete' ? deleteOptin(row.id) : kind === 'pause' ? unpublishOptin(row.id) : publishOptin(row.id),
    campaignName(row),
  );
  const decisionWords = decision ? decisionCopy(decision.kind, false, campaignName(decision.row), decision.row.arms.length) : null;
  const exportFile = async () => {
    setBusy(true); setError(null);
    try { download(`${id}.json`, await exportOccasion(id)); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  };

  const next = nextYearOf(occasion);
  const totals = report?.status === 'ready' ? occasionTotals(report.data, new Set(campaigns.map((row) => row.id))) : null;
  const numbers = report?.status === 'ready'
    ? Object.fromEntries(report.data.goals.flatMap((goal) => goal.optins.map((row) => [row.id, rowResultOf(goal, row)])))
    : {};
  const summary = query === null ? null
    : 'from' in query && query.from !== undefined && query.to !== undefined ? formatRange(query.from, query.to)
      : report?.status === 'ready' ? formatRange(report.data.from, report.data.to) : null;

  return (
    <Shell section="optins" pageTitle={occasion.name} pageBack={back}
      pageDescription={[formatRange(occasion.start, occasion.end), phaseLine(occasionPhase(occasion, today))].join(' · ')}
      actions={<>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button ref={menu} variant="outline" size="icon" disabled={busy} aria-label={sprintf(/* translators: %s: an occasion's name. */ __('Actions for %s', 'wconvert'), occasion.name)}>
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <OptionMenuContent align="end" sideOffset={5} aria-label={sprintf(/* translators: %s: an occasion's name, e.g. “Black Friday”. */ __('Actions for %s', 'wconvert'), occasion.name)}>
            <OptionGroup>
              <OptionItem icon={Copy} name={__('Copy to next year', 'wconvert')} onSelect={() => setAsking('copy')} />
              <OptionItem icon={Download} name={__('Export', 'wconvert')} onSelect={() => void exportFile()} />
              <OptionItem icon={Pencil} name={__('Edit occasion', 'wconvert')} onSelect={() => setAsking('edit')} />
              <OptionSeparator />
              <OptionItem icon={Trash2} destructive name={__('Delete occasion', 'wconvert')} onSelect={() => setAsking('delete')} />
            </OptionGroup>
          </OptionMenuContent>
        </DropdownMenu>
        {campaigns.length > 0 && newCampaign}
      </>}>
      <div className="flex flex-col gap-5">
        {notice && <OccasionNoticeView notice={notice} onDismiss={onDismissNotice} />}
        {error && <Region><RegionError message={error} /></Region>}
        {campaigns.length === 0 ? (
          <Region>
            <EmptyState icon={Megaphone} title={sprintf(/* translators: %s: an occasion's name. */ __('No campaigns in %s yet', 'wconvert'), occasion.name)} action={newCampaign}>
              {sprintf(/* translators: %s: an occasion's dates. */ __('New campaigns made here start with its dates, %s. Existing campaigns join from their Details.', 'wconvert'), formatRange(occasion.start, occasion.end))}
            </EmptyState>
          </Region>
        ) : <>
          <Region label={__('Results', 'wconvert')}>
            <RegionHeader title={__('Results', 'wconvert')} trailing={
              <DateRangePicker label={__('Results period', 'wconvert')} value={range} presets={['occasion', '7', '30']} summary={summary} today={today} maxDays={366} onChange={setRange} />
            } />
            <RegionBody>
              {report?.status === 'failed' ? <RegionError message={report.message} onRetry={() => setAttempt((n) => n + 1)} />
                : totals === null || totals.shown === 0
                  ? <p className="m-0 text-note text-muted-foreground">{report?.status === 'loading' ? __('Loading results…', 'wconvert') : __('Totals appear once a campaign here is published and shown.', 'wconvert')}</p>
                  : <StatRow>
                    <Stat emphasis label={__('Shown', 'wconvert')} value={formatCount(totals.shown)} />
                    {/* Clicks count click goals only, so with none here there is no number to give. */}
                    <Stat label={__('Clicks', 'wconvert')} value={totals.counted ? formatCount(totals.clicks) : '—'}
                      hint={!totals.counted || totals.clickRate === null ? undefined : sprintf(/* translators: %s: a rate such as "7.4%". */ __('%s of shown', 'wconvert'), formatRate(totals.clickRate))} />
                    <Stat label={__('Dismissed', 'wconvert')} value={formatCount(totals.dismissed)} />
                  </StatRow>}
            </RegionBody>
          </Region>
          <Region label={__('Dates', 'wconvert')}>
            <RegionHeader title={__('Dates', 'wconvert')} />
            <RegionBody><DateLine occasion={occasion} campaigns={campaigns} today={today} /></RegionBody>
          </Region>
          <Region label={__('Campaigns', 'wconvert')}>
            <RegionHeader title={__('Campaigns', 'wconvert')} />
            <DataTable label={sprintf(/* translators: %s: an occasion's name. */ __('Campaigns in %s', 'wconvert'), occasion.name)} className="wconvert-campaign-table is-occasion">
              <DataTableHead>
                <DataTableColumn>{__('Campaign', 'wconvert')}</DataTableColumn>
                <DataTableColumn>{__('Dates', 'wconvert')}</DataTableColumn>
                <DataTableColumn>{__('Status', 'wconvert')}</DataTableColumn>
                <DataTableColumn numeric>{__('Results', 'wconvert')}</DataTableColumn>
                <DataTableActionsColumn>{__('Actions', 'wconvert')}</DataTableActionsColumn>
              </DataTableHead>
              <DataTableBody>
                {campaigns.map((row) => {
                  const status = statusOf(row), name = campaignName(row), result = numbers[row.id];
                  const outside = outsideOf(occasion, row);
                  return (
                    <DataTableRow key={row.id} className="wconvert-campaign-row" label={name}>
                      <DataTableCell label={__('Campaign', 'wconvert')} className="wconvert-campaign-identity">
                        <div className="wconvert-campaign-thumbnail" aria-hidden="true">
                          {previews[row.id]?.template
                            ? <Suspense fallback={<div className="wconvert-preview-placeholder" />}><Design template={previews[row.id].template!} displayType={previews[row.id].display_type} /></Suspense>
                            : <div className="wconvert-preview-placeholder"><Megaphone aria-hidden="true" /></div>}
                        </div>
                        <div className="min-w-0">
                          <p className="m-0 wconvert-campaign-name"><bdi>{name}</bdi></p>
                          <p className="wconvert-campaign-meta">{displayTypeLabel(row.display_type)}</p>
                        </div>
                      </DataTableCell>
                      <DataTableCell label={__('Dates', 'wconvert')} className="wconvert-occasion-dates">
                        {spanOf(row)}
                        {outside && <span className="wconvert-occasion-outside">{outside}</span>}
                      </DataTableCell>
                      <DataTableCell label={__('Status', 'wconvert')} className="wconvert-campaign-state"><StatusBadge status={status} /></DataTableCell>
                      <DataTableCell label={__('Results', 'wconvert')} numeric className="wconvert-campaign-results">
                        {result && result.count > 0
                          ? <><strong>{formatCount(result.count)}</strong><span>{result.label}</span>
                            {result.shown > 0 && <span>{shownLine(result)}</span>}</>
                          : <span>{status === 'draft' ? __('No results yet', 'wconvert') : __('No results in this period', 'wconvert')}</span>}
                      </DataTableCell>
                      <DataTableActions className="wconvert-campaign-row-actions">
                        <Button variant="ghost" disabled={busy} onClick={() => onEdit(row.id)}>
                          {status === 'draft' ? __('Continue editing', 'wconvert') : __('Edit', 'wconvert')}
                        </Button>
                        <CampaignMenu
                          row={row}
                          name={name}
                          parent={row}
                          arm={false}
                          busy={busy}
                          navigationBusy={busy}
                          missingDesign={previews[row.id]?.template === null}
                          result={result}
                          reportReady={report?.status === 'ready'}
                          days={query !== null && 'days' in query && query.days !== undefined ? query.days : 30}
                          range={report?.status === 'ready' ? { from: report.data.from, to: report.data.to } : undefined}
                          onDuplicate={() => void act(() => duplicateCampaign(row.id, sprintf(/* translators: %s: a campaign's name. */ __('%s — copy', 'wconvert'), name)), name)}
                          onDecision={(kind, trigger) => { rowFocus.current = trigger; setDecision({ kind, row }); }}
                        />
                      </DataTableActions>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
            <RegionFooter>{sprintf(/* translators: %d: how many campaigns are listed for this occasion. */ _n('%d campaign', '%d campaigns', campaigns.length, 'wconvert'), campaigns.length)}</RegionFooter>
          </Region>
        </>}
      </div>
      <ConfirmDialog
        variant={decision?.kind === 'delete' ? 'destructive' : 'default'}
        open={decision !== null}
        onOpenChange={(open) => { if (!open) setDecision(null); }}
        title={decisionWords?.title ?? ''}
        description={decisionWords?.description ?? ''}
        confirmLabel={decisionWords?.confirmLabel ?? ''}
        returnFocusTo={rowFocus}
        onConfirm={() => {
          if (!decision) return;
          const asked = decision;
          setDecision(null);
          decide(asked);
        }} />
      <ConfirmDialog open={asking === 'copy'} onOpenChange={(open) => { if (!open) setAsking(null); }} returnFocusTo={menu}
        title={sprintf(/* translators: %s: an occasion's name. */ __('Copy %s to next year?', 'wconvert'), occasion.name)}
        description={<>
          {sprintf(
            /* translators: 1: the new occasion's name, 2: its dates, 3: how many campaigns, 4: this occasion's name. */
            _n('Creates %1$s, %2$s, with a draft of its %3$d campaign. Its dates move one year. %4$s and its campaigns stay as they are.',
              'Creates %1$s, %2$s, with a draft of each of its %3$d campaigns. Their dates move one year. %4$s and its campaigns stay as they are.', campaigns.length, 'wconvert'),
            next.name, formatRange(next.start, next.end), campaigns.length, occasion.name)}
          {' '}{__('Dates keep the same day of the month, so a sale tied to a weekday may need its dates moved.', 'wconvert')}
        </>}
        confirmLabel={__('Copy to next year', 'wconvert')} onConfirm={() => void copy()} />
      <ConfirmDialog open={asking === 'delete'} variant="destructive" onOpenChange={(open) => { if (!open) setAsking(null); }} returnFocusTo={menu}
        title={sprintf(/* translators: %s: an occasion's name. */ __('Delete %s?', 'wconvert'), occasion.name)}
        description={sprintf(
          /* translators: %d: how many campaigns the occasion holds. */
          _n('Its %d campaign stays, with its design, dates, status and results. It just leaves this occasion.',
            'Its %d campaigns stay, with their designs, dates, status and results. They just leave this occasion.', campaigns.length, 'wconvert'),
          campaigns.length)}
        confirmLabel={__('Delete occasion', 'wconvert')}
        onConfirm={() => {
          setAsking(null);
          void save(items.items.filter((item) => item.id !== id)).then((saved) => { if (saved) navigate(optinsHref()); });
        }} />
      {asking === 'edit' && <EditOccasion occasion={occasion} busy={busy} error={error} returnFocusTo={menu}
        onClose={() => { setAsking(null); setError(null); }}
        onSave={(edited) => void save(items.items.map((item) => item.id === id ? edited : item)).then((saved) => { if (saved) setAsking(null); })} />}
    </Shell>
  );
}

function phaseLine(phase: Phase): string {
  if (phase.kind === 'before') return phase.days === 1 ? __('Starts tomorrow', 'wconvert')
    : sprintf(/* translators: %d: days until the occasion starts. */ _n('Starts in %d day', 'Starts in %d days', phase.days, 'wconvert'), phase.days);
  if (phase.kind === 'after') return __('Ended', 'wconvert');
  return sprintf(/* translators: 1: today's day number in the occasion, 2: how many days it has. */ __('Day %1$d of %2$d', 'wconvert'), phase.day, phase.of);
}

/** The row's flag when the campaign shows outside its occasion, or null. */
function outsideOf(occasion: Occasion, row: OptinSummary): string | null {
  const bar = placeBar(occasion, row.starts_at, row.ends_at);
  if (bar.before && bar.after) return __('Before and after the occasion', 'wconvert');
  if (bar.before) return __('Before the occasion', 'wconvert');
  return bar.after ? __('After the occasion', 'wconvert') : null;
}

/** Name and days of the occasion; changing them moves no campaign (ADR 0149 §3). */
function EditOccasion({ occasion, busy, error, returnFocusTo, onClose, onSave }: {
  occasion: Occasion;
  busy: boolean;
  error: string | null;
  returnFocusTo: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onSave: (occasion: Occasion) => void;
}) {
  const id = useId();
  const [name, setName] = useState(occasion.name);
  const [start, setStart] = useState(occasion.start);
  const [end, setEnd] = useState(occasion.end);
  const dirty = name !== occasion.name || start !== occasion.start || end !== occasion.end;
  return (
    <AdminDialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <AdminDialogContent size="sm" dirty={dirty} showCloseButton={!busy}
        onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusTo.current?.focus(); }}>
        <AdminDialogHeader title={__('Edit occasion', 'wconvert')} />
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); onSave({ ...occasion, name: name.trim(), start, end }); }}>
          <AdminDialogBody className="flex flex-col gap-4">
            <Field label={__('Occasion name', 'wconvert')} htmlFor={`${id}-name`}>
              <Input id={`${id}-name`} required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label={__('First day', 'wconvert')} htmlFor={`${id}-start`}>
              <Input id={`${id}-start`} type="date" required value={start} onChange={(event) => setStart(event.target.value)} />
            </Field>
            <Field label={__('Last day', 'wconvert')} htmlFor={`${id}-end`} hint={__('Changing the dates moves no campaign.', 'wconvert')} hintId={`${id}-end-hint`}>
              <Input id={`${id}-end`} type="date" required min={start || undefined} value={end} aria-describedby={`${id}-end-hint`} onChange={(event) => setEnd(event.target.value)} />
            </Field>
          </AdminDialogBody>
          <AdminDialogFooter error={error} back={<Button type="button" variant="outline" disabled={busy} onClick={onClose}>{__('Cancel', 'wconvert')}</Button>}>
            <Button type="submit" disabled={busy}>{busy ? __('Saving…', 'wconvert') : __('Save occasion', 'wconvert')}</Button>
          </AdminDialogFooter>
        </form>
      </AdminDialogContent>
    </AdminDialog>
  );
}

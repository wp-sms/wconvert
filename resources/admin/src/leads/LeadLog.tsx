import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Download, Inbox } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableColumn,
  DataTableHead,
  DataTableRow,
} from '../shell/DataTable';
import { EmptyState } from '../shell/EmptyState';
import { PageAction } from '../shell/PageActions';
import {
  Region,
  RegionBody,
  RegionError,
  RegionErrorState,
  RegionFooter,
  RegionHeader,
} from '../shell/Region';
import { TableSkeleton } from '../shell/TableSkeleton';
import { Toolbar, ToolbarCount } from '../shell/Toolbar';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import {
  exportUrl,
  readLog,
  readRetention,
  saveRetention,
  type LeadLog as LeadLogPayload,
  type Retention,
} from './api';
import { listOptins, type OptinSummary } from '../optins/api';

/** What a merchant gets when they turn retention on without typing a number. */
const SUGGESTED_DAYS = 90;

/**
 * The value the filter carries for "every Optin".
 *
 * A sentinel rather than the empty string the API takes, because Radix reserves
 * `""` for a `Select` with nothing chosen — an `<SelectItem value="">` throws.
 * It is translated back at the boundary, so nothing below this component sees
 * it.
 */
const ALL_OPTINS = 'all';

/**
 * The [[Lead]] log.
 *
 * **The headline is submissions, and the grouping toggle does not move it.**
 * Collapsing Sarah's two rows into one reading "2 submissions" is a view on
 * the same log; it is never a second number the product reports. There is no
 * count of people on this screen and there is no honest one to put here —
 * identifiers are optional, so the number of groups counts identifiers seen,
 * which is a different quantity (ADR 0021).
 *
 * The Optin column shows the Optin's NAME, resolved from a map built off the
 * Optin list rather than joined in SQL: an install has tens of Optins and
 * thousands of Leads, so the map is built once and the join would be per-row.
 * A soft-deleted Optin still has a name, which is what the soft delete is for
 * (ADR 0002, ADR 0020).
 *
 * **Two regions, because this screen holds two objects** (ADR 0039). The log is
 * one; how long its rows live is another, and they shared a card until now — so
 * the thing a merchant was looking at was "leads, and also a control that
 * destroys leads". Retention stays on this screen, which is what #66 requires
 * and what `nav.ts` says: it is one question about the rows here, and a tab
 * holding a single radio pair reads as a screen somebody forgot to finish.
 *
 * **Export CSV acts on the whole log, so it is page-scoped** and sits in the
 * page header beside the title. It is rendered from here rather than from
 * {@see App} because its URL carries this screen's filter; {@see PageAction} is
 * what gets it up there without the filter having to come down.
 *
 * **The retention period is committed, never typed through.** Every keystroke
 * in a number field is a value — typing `90` passes through `9` — and each one
 * saved is a period the next cron run would enforce. Deleting a merchant's
 * Leads because they were half way through typing is the support catastrophe
 * ADR 0018 exists to avoid, arriving through the settings panel instead of
 * through a default.
 */
export function LeadLog() {
  const [log, setLog] = useState<Loadable<LeadLogPayload>>(LOADING);
  const [optins, setOptins] = useState<OptinSummary[]>([]);
  const [logError, setLogError] = useState<string | null>(null);
  const [optinId, setOptinId] = useState('');
  const [grouped, setGrouped] = useState(false);

  const [retention, setRetention] = useState<Loadable<Retention>>(LOADING);
  const [retentionError, setRetentionError] = useState<string | null>(null);
  const [draftDays, setDraftDays] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  /*
   * The radio that asked the question, so cancelling puts the caret back on it
   * rather than on `<body>` ({@see ConfirmDialog}).
   */
  const deleteRadio = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setLog(ready(await readLog(optinId, grouped)));
      setLogError(null);
    } catch (cause) {
      // The rows already on screen stay: a filter change that fails must not
      // empty a log the merchant is reading. Only a FIRST failure has nothing
      // to keep, and that arm renders the error as the region's whole content.
      setLog((current) => (current.status === 'ready' ? current : failed(cause)));
      setLogError(messageOf(cause));
    }
  }, [optinId, grouped]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    // Deleted Optins included: a Lead outlives the Optin that captured it,
    // and a blank name on those rows is exactly where provenance matters.
    //
    // Its failure belongs to the LOG's region — it costs this screen the
    // filter's options and the names in the Optin column, and nothing at all
    // on the retention region below (ADR 0039).
    listOptins(true)
      .then(setOptins)
      .catch((cause: unknown) => setLogError(messageOf(cause)));
  }, []);

  useEffect(() => {
    readRetention()
      .then((current) => {
        setRetention(ready(current));
        setDraftDays(current.days === null ? '' : String(current.days));
      })
      .catch((cause: unknown) => setRetention(failed(cause)));
  }, []);

  const names = useMemo(() => new Map(optins.map((optin) => [optin.id, optin.name])), [optins]);
  const nameOf = (id: string) => names.get(id) ?? id;

  const period = retention.status === 'ready' ? retention.data : null;

  const commitRetention = (days: number | null) => {
    setBusy(true);

    void (async () => {
      try {
        const saved = await saveRetention(days);

        setRetention(ready(saved));
        setDraftDays(saved.days === null ? '' : String(saved.days));
        setRetentionError(null);
      } catch (cause) {
        setRetentionError(messageOf(cause));
      } finally {
        setBusy(false);
      }
    })();
  };

  /**
   * The typed period, committed on blur or Enter.
   *
   * A draft that is not a usable number is not saved and not silently
   * corrected either — the field keeps what they typed, and the stored period
   * keeps what it had.
   */
  const commitDraft = () => {
    const days = Number(draftDays);

    if (!Number.isInteger(days) || days < 1 || days === period?.days) {
      return;
    }

    commitRetention(Math.min(days, period?.max_days ?? SUGGESTED_DAYS));
  };

  const csv = exportUrl(optinId);

  return (
    <div className="flex flex-col gap-5">
      {csv !== null && (
        <PageAction>
          {/*
            **It stays an `<a>`.** A download is a navigation: the browser needs
            the `Content-Disposition` the server sends, and `apiFetch` would read
            the file into memory and then have to turn it back into one (#66).
            `asChild` is what lets it wear a button and stay a link.
          */}
          <Button asChild variant="outline">
            <a href={csv}>
              <Download aria-hidden="true" />
              {__('Export CSV', 'wconvert')}
            </a>
          </Button>
        </PageAction>
      )}

      <LogRegion
        log={log}
        error={logError}
        optins={optins}
        optinId={optinId}
        onOptinId={setOptinId}
        grouped={grouped}
        onGrouped={setGrouped}
        nameOf={nameOf}
      />

      <Region>
        <RegionHeader
          title={__('How long leads are kept', 'wconvert')}
          description={__(
            'This applies to every lead above, whichever Optin captured it.',
            'wconvert',
          )}
        />

        {retention.status === 'failed' ? (
          <RegionErrorState
            message={retention.message}
            hint={__('Reload the page to try again.', 'wconvert')}
          />
        ) : (
          <>
            {retentionError !== null && <RegionError message={retentionError} />}

            <RegionBody className="flex flex-col gap-3">
              {/*
                Keep-forever is the shipped default and the first option,
                because deleting a merchant's leads on the plugin's own opinion
                is a support catastrophe and may destroy records they must keep
                (ADR 0018).
              */}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="wconvert-retention"
                  checked={period?.days === null}
                  disabled={busy || period === null}
                  onChange={() => commitRetention(null)}
                />
                {__('Keep them until I delete them', 'wconvert')}
              </label>

              <label className="flex flex-wrap items-center gap-2">
                {/*
                  **Turning it on asks first, and it is the only control in this
                  admin that destroys data a merchant cannot get back**
                  (ADR 0039). One click here schedules a cron run that deletes
                  every Lead older than the period, and keeps doing it.

                  Confirming commits a SUGGESTED period rather than whatever the
                  field happens to hold; the field is where the merchant then
                  changes it. Committing the draft here would save a number
                  nobody typed.

                  Changing an existing period does not ask. It is an adjustment
                  to a decision already made and already confirmed, and a dialog
                  on every edit is a dialog nobody reads by the third one.
                */}
                <input
                  ref={deleteRadio}
                  type="radio"
                  name="wconvert-retention"
                  checked={typeof period?.days === 'number'}
                  disabled={busy || period === null}
                  onChange={() => setConfirming(true)}
                />
                {__('Delete them automatically after', 'wconvert')}
                {/*
                  `onBlur` and Enter, never `onChange`. Typing 90 passes through
                  9, and a saved 9 is a period the next cron run enforces
                  (ADR 0018).
                */}
                <Input
                  type="number"
                  min={1}
                  max={period?.max_days ?? SUGGESTED_DAYS}
                  className="w-24"
                  value={draftDays}
                  disabled={busy || period === null || period.days === null}
                  onChange={(event) => setDraftDays(event.target.value)}
                  onBlur={commitDraft}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitDraft();
                    }
                  }}
                />
                {__('days', 'wconvert')}
              </label>
            </RegionBody>
          </>
        )}
      </Region>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={__('Delete old leads automatically?', 'wconvert')}
        description={sprintf(
          /* translators: %d: a number of days. */
          __(
            'Every lead older than %d days is deleted, from now on. Deleted leads cannot be recovered — export a CSV first if you need them.',
            'wconvert',
          ),
          SUGGESTED_DAYS,
        )}
        confirmLabel={__('Turn on automatic deletion', 'wconvert')}
        returnFocusTo={deleteRadio}
        onConfirm={() => {
          setConfirming(false);
          commitRetention(SUGGESTED_DAYS);
        }}
      />
    </div>
  );
}

/**
 * The log itself: a toolbar that says what is being shown, and the rows.
 *
 * A component of its own because the region is the unit ADR 0039 names, and a
 * screen with two of them reads better as two things than as one function with
 * a horizontal rule in the middle.
 */
function LogRegion({
  log,
  error,
  optins,
  optinId,
  onOptinId,
  grouped,
  onGrouped,
  nameOf,
}: {
  log: Loadable<LeadLogPayload>;
  error: string | null;
  optins: OptinSummary[];
  optinId: string;
  onOptinId: (id: string) => void;
  grouped: boolean;
  onGrouped: (grouped: boolean) => void;
  nameOf: (id: string) => string;
}) {
  if (log.status === 'failed') {
    return (
      <Region label={__('Submissions', 'wconvert')}>
        <RegionErrorState
          message={log.message}
          hint={__('Reload the page to try again.', 'wconvert')}
        />
      </Region>
    );
  }

  const data = log.status === 'ready' ? log.data : null;
  const rows = grouped ? (data?.groups.length ?? 0) : (data?.leads.length ?? 0);
  const truncated =
    data !== null && !grouped && data.leads.length > 0 && data.leads.length < data.submissions;

  return (
    <Region label={__('Submissions', 'wconvert')}>
      <Toolbar
        trailing={
          data === null ? undefined : (
            /*
              **One number, one text node, and it says what it counts.**
              "Leads" alone would invite the reading that this is a count of
              people, which it is not and cannot be (ADR 0021) — and a number
              split from its noun to style them apart is a number a later
              change can render without it.
            */
            <ToolbarCount
              /*
                **The promise moved here from the page subtitle.** CONTEXT.md's
                sharpest rule is that a [[Lead]] is an event and never a person
                (ADR 0021), and THIS number is the exact place a merchant reads
                it the other way — so the sentence sits on the number rather
                than three lines above the table, where it was a permanent tax
                on every visit for one reading.
              */
              hint={__('One row is one submission, never one person.', 'wconvert')}
            >
              {sprintf(
                /* translators: %s: a number of form submissions. */
                _n('%s submission', '%s submissions', data.submissions, 'wconvert'),
                String(data.submissions),
              )}
            </ToolbarCount>
          )
        }
      >
        <Label htmlFor="wconvert-lead-optin" className="text-muted-foreground">
          {__('Optin', 'wconvert')}
        </Label>
        <Select
          value={optinId === '' ? ALL_OPTINS : optinId}
          onValueChange={(value) => onOptinId(value === ALL_OPTINS ? '' : value)}
        >
          <SelectTrigger id="wconvert-lead-optin" size="sm" className="max-w-full min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_OPTINS}>{__('All Optins', 'wconvert')}</SelectItem>
            {optins.map((optin) => (
              <SelectItem key={optin.id} value={optin.id}>
                {optin.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/*
          **A 24px pointer target, drawn at 16px.** `size-4` is under WCAG 2.2
          SC 2.5.8 and nothing on this screen does the same job at a bigger
          size, so no exception applies. `.wconvert-check` is where the box's
          target and the label's line height are grown; see `index.css` for why
          the pair is NOT wrapped in one `<label>`.
        */}
        <span className="wconvert-check">
          <Checkbox
            id="wconvert-lead-grouped"
            checked={grouped}
            onCheckedChange={(checked) => onGrouped(checked === true)}
          />
          <Label htmlFor="wconvert-lead-grouped">
            {__('Group submissions that share an email or phone', 'wconvert')}
          </Label>
        </span>
      </Toolbar>

      {error !== null && <RegionError message={error} />}

      {log.status === 'ready' && rows === 0 ? (
        <EmptyState
          icon={Inbox}
          title={
            optinId === ''
              ? __('No submissions yet', 'wconvert')
              : __('No submissions from this Optin', 'wconvert')
          }
          action={
            optinId === '' ? (
              <Button asChild variant="outline">
                <a href="#optins">{__('Go to Optins', 'wconvert')}</a>
              </Button>
            ) : (
              <Button variant="outline" onClick={() => onOptinId('')}>
                {__('Show every Optin', 'wconvert')}
              </Button>
            )
          }
        >
          {optinId === ''
            ? __(
                'A row appears the moment a visitor submits a published Optin.',
                'wconvert',
              )
            : __('Another Optin may have captured what you are looking for.', 'wconvert')}
        </EmptyState>
      ) : (
        <DataTable>
          {grouped ? (
            <DataTableHead>
              <DataTableColumn>{__('Identifier', 'wconvert')}</DataTableColumn>
              <DataTableColumn numeric>{__('Submissions', 'wconvert')}</DataTableColumn>
              <DataTableColumn>{__('Last submitted', 'wconvert')}</DataTableColumn>
            </DataTableHead>
          ) : (
            <DataTableHead>
              <DataTableColumn>{__('Submitted', 'wconvert')}</DataTableColumn>
              <DataTableColumn>{__('Optin', 'wconvert')}</DataTableColumn>
              <DataTableColumn>{__('Email', 'wconvert')}</DataTableColumn>
              <DataTableColumn>{__('Phone', 'wconvert')}</DataTableColumn>
              <DataTableColumn>{__('Captured', 'wconvert')}</DataTableColumn>
            </DataTableHead>
          )}

          {data === null ? (
            <TableSkeleton columns={grouped ? 3 : 5} />
          ) : (
            <DataTableBody>
              {grouped
                ? data.groups.map((group) => (
                    <DataTableRow key={group.identifier}>
                      <DataTableCell label={__('Identifier', 'wconvert')}>
                        {group.identifier}
                      </DataTableCell>
                      <DataTableCell label={__('Submissions', 'wconvert')} numeric>
                        {sprintf(
                          /* translators: %s: a number of form submissions. */
                          _n('%s submission', '%s submissions', group.submissions, 'wconvert'),
                          String(group.submissions),
                        )}
                      </DataTableCell>
                      <DataTableCell label={__('Last submitted', 'wconvert')}>
                        {group.latest_at ?? '—'}
                      </DataTableCell>
                    </DataTableRow>
                  ))
                : data.leads.map((lead) => (
                    <DataTableRow key={lead.id}>
                      <DataTableCell label={__('Submitted', 'wconvert')}>
                        {lead.created_at}
                      </DataTableCell>
                      <DataTableCell label={__('Optin', 'wconvert')}>
                        {nameOf(lead.optin_id)}
                      </DataTableCell>
                      {/*
                        An em dash rather than a blank. A [[Lead]] may carry only
                        an email, only a phone, or neither — an empty cell reads
                        as a rendering fault, and a merchant checking whether a
                        capture kept the phone number needs the answer to be
                        visible.
                      */}
                      <DataTableCell label={__('Email', 'wconvert')}>
                        {lead.email ?? '—'}
                      </DataTableCell>
                      <DataTableCell label={__('Phone', 'wconvert')}>
                        {lead.phone ?? '—'}
                      </DataTableCell>
                      <DataTableCell
                        label={__('Captured', 'wconvert')}
                        className="whitespace-normal"
                      >
                        {Object.entries(lead.fields).map(([name, value]) => (
                          <span key={name} className="block">
                            <code className="font-mono text-xs text-muted-foreground">{name}</code>{' '}
                            {value}
                          </span>
                        ))}
                      </DataTableCell>
                    </DataTableRow>
                  ))}
            </DataTableBody>
          )}
        </DataTable>
      )}

      {/*
        **A truncated log says so, and the sentence has a place to live now.**
        One read is capped, and a screen showing the newest fifty of nine
        hundred submissions while the count reads nine hundred is a screen that
        looks broken. The region footer is where a notice about the SET below
        the table goes — and where pagination lands when it arrives, so #66 did
        not have to invent one (ADR 0039).
      */}
      {truncated && data !== null && (
        <RegionFooter>
          {sprintf(
            /* translators: 1: how many rows are shown. 2: how many submissions there are in total. */
            __('Showing the newest %1$s of %2$s submissions.', 'wconvert'),
            String(data.leads.length),
            String(data.submissions),
          )}
        </RegionFooter>
      )}
    </Region>
  );
}

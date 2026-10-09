import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowUpRight, Check } from 'lucide-react';
import { InfoTip } from '../shell/InfoTip';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogFooter,
  AdminDialogHeader,
} from '../components/ui/admin-dialog';
import { Field } from '../shell/Field';
import { PageError, Region, RegionErrorState } from '../shell/Region';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { reportHref } from '../nav';
import { messageOf } from '../shell/loadable';
import { formatDay, formatRange, siteLocale } from '../lib/format';
import { formatCount } from './format';
import {
  readMonthlyTargets,
  saveMonthlyTargets,
  type MonthlyTargetReport,
} from './targets-api';
import './monthly-targets.css';

/** Starts beside the report read, not after it. A saved response invalidates
 * older in-flight reads; focus refreshes the site month without a polling loop. */
export function useMonthlyTargets(enabled: boolean) {
  const [data, setData] = useState<MonthlyTargetReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const revision = useRef(0);
  const refresh = useCallback(() => setRetry((n) => n + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const ticket = ++revision.current;
    setLoading(true);
    readMonthlyTargets()
      .then((next) => {
        if (active && ticket === revision.current) {
          setData(next);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (active && ticket === revision.current) setError(messageOf(cause));
      })
      .finally(() => {
        if (active && ticket === revision.current) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enabled, retry]);
  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [enabled, refresh]);
  const accept = (next: MonthlyTargetReport) => {
    revision.current++;
    setData(next);
    setError(null);
    setLoading(false);
  };
  return { data, error, loading, refresh, accept };
}

export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat(siteLocale(), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T12:00:00Z`));
}

/** Calendar days from `from` to `to`, both counted; zone-free like the server's. */
const dayCount = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1;

/**
 * **A reading of the benchmark, never a forecast** (ADR 0090): where an even
 * spread of the target would stand on the last counted day. Null before the
 * first complete day and once the target is reached, where pace says nothing.
 * `short` is 0 when on pace.
 */
export function paceOf(
  target: number,
  actual: number,
  month: Pick<MonthlyTargetReport, 'from' | 'end' | 'through'>,
): { short: number } | null {
  if (!month.through || actual >= target) return null;
  const expected = (target * dayCount(month.from, month.through)) / dayCount(month.from, month.end);
  return { short: Math.max(0, Math.round(expected - actual)) };
}

/** What the loaded report counted, to set a target against: "Last 30 complete days: 105". */
export interface TargetReference {
  label: string;
  counts: Record<string, number>;
}

export function MonthlyTargets({
  report,
  reference,
}: {
  report: ReturnType<typeof useMonthlyTargets>;
  reference?: TargetReference;
}) {
  const { data, error, refresh, accept } = report;
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  if (!data)
    return error ? (
      <Region label={__('Monthly targets', 'wconvert')} className="wa-targets-failed">
        <RegionErrorState
          message={sprintf(__('Could not load monthly targets. %s', 'wconvert'), error)}
          onRetry={refresh}
        />
      </Region>
    ) : (
      <RegionSkeleton label={__('Monthly targets', 'wconvert')} lines={3} />
    );
  const active = data.metrics.filter((m) => m.target !== null);
  // Not refused while a refresh is failing: the editor freezes the month it
  // opened on, and the server refuses a save for a month that has passed.
  const edit = (label: string) => (
    <Button ref={editButton} variant="outline" onClick={() => setEditing(true)}>
      {label}
    </Button>
  );
  return (
    <section className="wa-targets" aria-labelledby="wa-targets-heading">
      {error && (
        // A refresh failed: the last accepted month stays on screen under it.
        <PageError
          message={sprintf(
            __('Could not refresh targets. Showing the last loaded values. %s', 'wconvert'),
            error,
          )}
          onRetry={refresh}
        />
      )}
      {active.length > 0 ? (
        <>
          <header className="wa-targets-heading">
            <div>
              <h2 id="wa-targets-heading">
                {sprintf(__('%s targets', 'wconvert'), monthLabel(data.month))}
              </h2>
              <p className="wa-muted">
                {formatRange(data.from, data.end)} ·{' '}
                {__('all campaigns', 'wconvert')}
                <br />
                {data.through
                  ? sprintf(
                      __('Counted through %s', 'wconvert'),
                      formatDay(data.through),
                    )
                  : __('No complete days yet this month', 'wconvert')}
              </p>
            </div>
            {edit(__('Edit targets', 'wconvert'))}
          </header>
          <div className="wa-target-grid">
            {active.map((metric) => {
              const target = metric.target!;
              const percent = Math.round((metric.actual / target) * 100);
              const reached = metric.actual >= target;
              const pace = paceOf(target, metric.actual, data);
              return (
                <article className="wa-target-card" key={metric.id}>
                  <div className="wa-target-card-heading">
                    <h3>{metric.label}</h3>
                    <InfoTip label={sprintf(__('What counts toward %s?', 'wconvert'), metric.label)}>
                      <p>{metric.note}</p>
                    </InfoTip>
                  </div>
                  <div className="wa-target-number">
                    <strong>{formatCount(metric.actual)}</strong>
                    <span>
                      {sprintf(__('of %s', 'wconvert'), formatCount(target))}
                    </span>
                  </div>
                  <div
                    className="wa-target-progress"
                    role="progressbar"
                    aria-label={metric.label}
                    aria-valuemin={0}
                    aria-valuemax={target}
                    aria-valuenow={Math.min(metric.actual, target)}
                    aria-valuetext={sprintf(
                      __('%1$s of %2$s %3$s; %4$s%% of target', 'wconvert'),
                      formatCount(metric.actual),
                      formatCount(target),
                      metric.unit,
                      formatCount(percent),
                    )}
                  >
                    <span style={{ inlineSize: `${Math.min(percent, 100)}%` }} />
                  </div>
                  <div className="wa-target-percent">
                    <span>
                      {sprintf(
                        __('%s%% of target', 'wconvert'),
                        formatCount(percent),
                      )}
                    </span>
                    {reached && (
                      <span className="wa-target-reached">
                        <Check aria-hidden="true" />
                        {__('Reached', 'wconvert')}
                      </span>
                    )}
                    {/* Behind is neutral text, never amber: a slow month is a fact, not a fault (§14). */}
                    {pace &&
                      (pace.short === 0 ? (
                        <span className="wa-target-pace wa-target-on-pace">
                          {__('On pace', 'wconvert')}
                        </span>
                      ) : (
                        <span className="wa-target-pace">
                          {sprintf(
                            __('Behind pace: about %s short', 'wconvert'),
                            formatCount(pace.short),
                          )}
                        </span>
                      ))}
                  </div>
                  <div className="wa-target-footer">
                    <span>
                      {reached
                        ? sprintf(
                            __('%s above target', 'wconvert'),
                            formatCount(metric.actual - target),
                          )
                        : sprintf(
                            __('%s to go', 'wconvert'),
                            formatCount(target - metric.actual),
                          )}
                    </span>
                    <a
                      href={reportHref({
                        month: data.month,
                        impact: metric.id,
                      })}
                      aria-label={sprintf(
                        __('View monthly results for %s', 'wconvert'),
                        metric.label,
                      )}
                    >
                      {__('View results', 'wconvert')}
                      <ArrowUpRight aria-hidden="true" className="rtl:-scale-x-100" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="wa-target-note">
            {__('Targets keep their calendar month when the report dates change.', 'wconvert')}
          </p>
        </>
      ) : (
        <div className="wa-target-empty">
          <div>
            <h2 id="wa-targets-heading">{__('Monthly targets', 'wconvert')}</h2>
            <p>
              {__(
                'Set a target for this month, such as 100 submissions, and track it here.',
                'wconvert',
              )}
            </p>
          </div>
          {edit(__('Set a monthly target', 'wconvert'))}
        </div>
      )}
      {editing && (
        <TargetEditor
          initial={data}
          reference={reference}
          onClose={() => {
            setEditing(false);
            refresh();
          }}
          onClosed={() => editButton.current?.focus()}
          onSaved={(next) => {
            accept(next);
            setEditing(false);
          }}
        />
      )}
    </section>
  );
}

function TargetEditor({
  initial,
  reference,
  onClose,
  onClosed,
  onSaved,
}: {
  initial: MonthlyTargetReport;
  reference?: TargetReference;
  onClose: () => void;
  onClosed: () => void;
  onSaved: (next: MonthlyTargetReport) => void;
}) {
  // Freeze the month alongside the draft. A dialog left open at midnight must
  // not apply old numbers to a new month without review; the server refuses it.
  const [context] = useState(initial);
  const metrics = context.metrics.filter(
    (m) => m.available || m.target !== null,
  );
  const [start] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      metrics.map((m) => [m.id, m.target === null ? '' : String(m.target)]),
    ),
  );
  const [draft, setDraft] = useState(start);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [reused, setReused] = useState(false);
  const id = useId();
  const dirty = metrics.some((m) => draft[m.id] !== start[m.id]);
  const limit = sprintf(
    __('Use a whole number from 1 to %s.', 'wconvert'),
    formatCount(context.max_target),
  );
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const values: Record<string, number> = {};
    const wrong: string[] = [];
    for (const metric of metrics) {
      const text = draft[metric.id].trim();
      if (!text) continue;
      const value = Number(text);
      if (!Number.isSafeInteger(value) || value < 1 || value > context.max_target) wrong.push(metric.id);
      else values[metric.id] = value;
    }
    setInvalid(wrong);
    if (wrong.length > 0) return;
    setSaving(true);
    setError(null);
    try {
      onSaved(await saveMonthlyTargets(context.month, values));
    } catch (cause: unknown) {
      setError(messageOf(cause));
      setSaving(false);
    }
  };
  return (
    <AdminDialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <AdminDialogContent
        size="sm"
        dirty={dirty && !saving}
        showCloseButton={!saving}
        onEscapeKeyDown={(event) => {
          if (saving) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (saving) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClosed();
        }}
      >
        <AdminDialogHeader
          title={sprintf(__('%s targets', 'wconvert'), monthLabel(context.month))}
          meta={`${formatRange(context.from, context.end)} · ${__('all campaigns', 'wconvert')}`}
        />
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit} noValidate>
          <AdminDialogBody className="grid content-start gap-5">
            <p className="m-0 text-note text-muted-foreground">
              {__(
                'Leave a field blank for no target. Results are kept either way, and targets do not carry over to next month.',
                'wconvert',
              )}
            </p>
            {Object.keys(context.previous_targets).length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    setDraft(
                      Object.fromEntries(
                        metrics.map((m) => [
                          m.id,
                          context.previous_targets[m.id] === undefined
                            ? ''
                            : String(context.previous_targets[m.id]),
                        ]),
                      ),
                    );
                    setInvalid([]);
                    setReused(true);
                  }}
                >
                  {__('Reuse last month’s targets', 'wconvert')}
                </Button>
                <span role="status" className="text-note text-muted-foreground">
                  {reused ? __('Copied. Save to apply them.', 'wconvert') : ''}
                </span>
              </div>
            )}
            {metrics.map((metric) => (
              <Field
                key={metric.id}
                label={metric.label}
                htmlFor={`${id}-${metric.id}`}
                hint={
                  <>
                    {metric.note}
                    {reference?.counts[metric.id] !== undefined && (
                      <span className="block">
                        {sprintf(
                          /* translators: 1: the report's dates, e.g. "Last 30 complete days", 2: a count. */
                          __('%1$s: %2$s', 'wconvert'),
                          reference.label,
                          formatCount(reference.counts[metric.id]),
                        )}
                      </span>
                    )}
                  </>
                }
                hintId={`${id}-${metric.id}-hint`}
                error={invalid.includes(metric.id) ? limit : undefined}
              >
                <Input
                  id={`${id}-${metric.id}`}
                  className="wa-target-input"
                  type="number"
                  min={1}
                  max={context.max_target}
                  step={1}
                  inputMode="numeric"
                  value={draft[metric.id]}
                  disabled={saving}
                  aria-describedby={`${id}-${metric.id}-hint`}
                  aria-invalid={invalid.includes(metric.id) || undefined}
                  onChange={(event) => {
                    setDraft({ ...draft, [metric.id]: event.target.value });
                    setReused(false);
                  }}
                />
              </Field>
            ))}
          </AdminDialogBody>
          <AdminDialogFooter
            back={
              <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
                {__('Cancel', 'wconvert')}
              </Button>
            }
            error={
              error &&
              sprintf(
                __('Could not save. Your draft is kept. %s', 'wconvert'),
                error,
              )
            }
          >
            <Button type="submit" disabled={saving}>
              {saving ? __('Saving…', 'wconvert') : __('Save targets', 'wconvert')}
            </Button>
          </AdminDialogFooter>
        </form>
      </AdminDialogContent>
    </AdminDialog>
  );
}

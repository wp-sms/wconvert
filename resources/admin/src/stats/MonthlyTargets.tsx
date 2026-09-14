import { useCallback, useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Info } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { reportHref } from '../nav';
import { messageOf } from '../shell/loadable';
import { formatCount } from './format';
import { dateLabel, rangeLabel } from './reporting';
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
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T12:00:00Z`));
}

export function MonthlyTargets({
  report,
}: {
  report: ReturnType<typeof useMonthlyTargets>;
}) {
  const { data, error, loading, refresh, accept } = report;
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const editButton = useRef<HTMLButtonElement>(null);
  if (!data)
    return (
      <section
        className="wa-targets-status"
        aria-label={__('Monthly targets', 'wconvert')}
      >
        {error ? (
          <>
            <p role="alert">
              {sprintf(
                __('Could not load monthly targets. %s', 'wconvert'),
                error,
              )}
            </p>
            <Button variant="outline" size="sm" onClick={refresh}>
              {__('Retry targets', 'wconvert')}
            </Button>
          </>
        ) : (
          <p role="status">{__('Loading monthly targets…', 'wconvert')}</p>
        )}
      </section>
    );
  const active = data.metrics.filter((m) => m.target !== null);
  const edit = (label: string) => (
    <Button
      ref={editButton}
      variant="outline"
      size="sm"
      disabled={!!error}
      onClick={() => {
        setNotice('');
        setEditing(true);
      }}
    >
      {label}
    </Button>
  );
  return (
    <section className="wa-targets" aria-labelledby="wa-targets-heading">
      {active.length > 0 ? (
        <>
          <header className="wa-targets-heading">
            <div>
              <p className="wa-eyebrow">
                {__('Aim a little higher', 'wconvert')}
              </p>
              <h2 id="wa-targets-heading">
                {sprintf(__('%s targets', 'wconvert'), monthLabel(data.month))}
              </h2>
              <p className="wa-muted">
                {rangeLabel(data.from, data.end)} ·{' '}
                {__('All campaigns', 'wconvert')}
                <br />
                {data.through
                  ? sprintf(
                      __('Counted through %s', 'wconvert'),
                      dateLabel(data.through),
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
              return (
                <article className="wa-target-card" key={metric.id}>
                  <div className="wa-target-card-heading">
                    <h3>{metric.label}</h3>
                    <details className="wa-target-info">
                      <summary
                        aria-label={sprintf(
                          __('What counts toward %s?', 'wconvert'),
                          metric.label,
                        )}
                      >
                        <Info size={15} aria-hidden="true" />
                      </summary>
                      <p>{metric.note}</p>
                    </details>
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
                    <span style={{ width: `${Math.min(percent, 100)}%` }} />
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
                        {__('✓ Reached', 'wconvert')}
                      </span>
                    )}
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
                      {__('View results ↗', 'wconvert')}
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="wa-target-note">
            {__(
              'Targets keep their calendar month when report dates change. Reaching a target never pauses a campaign.',
              'wconvert',
            )}
          </p>
        </>
      ) : (
        <div className="wa-target-empty">
          <div>
            <h2 id="wa-targets-heading">
              {__('Have a number in mind?', 'wconvert')}
            </h2>
            <p>
              {__(
                'Try a monthly target, like 100 lead submissions.',
                'wconvert',
              )}
            </p>
          </div>
          {edit(__('Set a monthly target', 'wconvert'))}
        </div>
      )}
      {loading && (
        <p className="wa-muted" role="status">
          {__('Refreshing targets…', 'wconvert')}
        </p>
      )}
      {error && (
        <div className="wa-targets-status">
          <p role="alert">
            {sprintf(
              __(
                'Could not refresh targets. Showing the last loaded month and values. %s',
                'wconvert',
              ),
              error,
            )}
          </p>
          <Button variant="outline" size="sm" onClick={refresh}>
            {__('Retry targets', 'wconvert')}
          </Button>
        </div>
      )}
      {notice && (
        <p className="wa-target-note" role="status">
          {notice}
        </p>
      )}
      {editing && (
        <TargetEditor
          initial={data}
          onClose={() => {
            setEditing(false);
            refresh();
          }}
          onClosed={() => editButton.current?.focus()}
          onSaved={(next) => {
            accept(next);
            setEditing(false);
            setNotice(
              __(
                'Monthly targets saved. Campaigns and recorded results are unchanged.',
                'wconvert',
              ),
            );
          }}
        />
      )}
    </section>
  );
}

function TargetEditor({
  initial,
  onClose,
  onClosed,
  onSaved,
}: {
  initial: MonthlyTargetReport;
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
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      metrics.map((m) => [m.id, m.target === null ? '' : String(m.target)]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reused, setReused] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const values: Record<string, number> = {};
    for (const metric of metrics) {
      const text = draft[metric.id].trim();
      if (!text) continue;
      const value = Number(text);
      if (
        !Number.isSafeInteger(value) ||
        value < 1 ||
        value > context.max_target
      ) {
        setError(
          __(
            'Use whole positive counts within the displayed limit.',
            'wconvert',
          ),
        );
        return;
      }
      values[metric.id] = value;
    }
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent
        className="wa-target-editor"
        showCloseButton={!saving}
        onEscapeKeyDown={(event) => {
          if (saving) event.preventDefault();
        }}
        onPointerDownOutside={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClosed();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {sprintf(
              __('Set %s targets', 'wconvert'),
              monthLabel(context.month),
            )}
          </DialogTitle>
          <DialogDescription>
            {__(
              'Choose optional targets across your site. Leave a field empty to remove its target, not its results.',
              'wconvert',
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <p className="wa-target-editor-scope">
            {rangeLabel(context.from, context.end)} ·{' '}
            {__('All campaigns', 'wconvert')}
            <br />
            {__(
              'Completed days only. Targets do not renew automatically.',
              'wconvert',
            )}
          </p>
          {Object.keys(context.previous_targets).length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
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
                setReused(true);
              }}
            >
              {__('Reuse last month’s targets', 'wconvert')}
            </Button>
          )}
          {reused && (
            <p className="wa-target-note" role="status">
              {__(
                'Last month’s values copied into this draft. Review them, then save.',
                'wconvert',
              )}
            </p>
          )}
          {metrics.map((metric) => (
            <label className="wa-target-field" key={metric.id}>
              <span>
                {metric.label}
                <small>{metric.note}</small>
              </span>
              <input
                type="number"
                min={1}
                max={context.max_target}
                step={1}
                inputMode="numeric"
                value={draft[metric.id]}
                disabled={saving}
                onChange={(event) =>
                  setDraft({ ...draft, [metric.id]: event.target.value })
                }
              />
            </label>
          ))}
          <p className="wa-target-note">
            {sprintf(
              __(
                'Whole numbers from 1 to %s. Blank means no target. Saving replaces this month’s targets only.',
                'wconvert',
              ),
              formatCount(context.max_target),
            )}
          </p>
          {error && (
            <p className="wa-target-save-error" role="alert">
              {sprintf(
                __(
                  'Could not confirm the save. Your draft is kept. %s',
                  'wconvert',
                ),
                error,
              )}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onClose}
            >
              {__('Cancel', 'wconvert')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? __('Saving…', 'wconvert')
                : __('Save targets', 'wconvert')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

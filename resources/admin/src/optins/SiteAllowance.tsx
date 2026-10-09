import { useEffect, useId, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { ALLOWANCE_LABELS, allowanceLines } from './allowanceSummary';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogClose,
  AdminDialogContent,
  AdminDialogFooter,
  AdminDialogHeader,
} from '../components/ui/admin-dialog';
import {
  Region,
  RegionBody,
  RegionErrorState,
  RegionFooter,
  RegionHeader,
} from '../shell/Region';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { CheckRow } from '../shell/CheckRow';
import { Field } from '../shell/Field';
import { SaveStatus, useSaveStatus } from '../shell/SaveStatus';
import {
  LOADING,
  failed,
  messageOf,
  ready,
  type Loadable,
} from '../shell/loadable';
import {
  useSettingsEditing,
  type SettingsEditing,
} from '../settings-page/useSettingsEditing';
import {
  readSiteAllowance,
  saveSiteAllowance,
  type SiteAllowance as Allowance,
} from './api';

type Draft = Omit<Allowance, 'maxImpressions' | 'cooldownDays'> & {
  maxImpressions: string;
  cooldownDays: string;
};
const draftOf = (value: Allowance): Draft => ({
  ...value,
  maxImpressions:
    value.maxImpressions === null ? '' : String(value.maxImpressions),
  cooldownDays: value.cooldownDays === null ? '' : String(value.cooldownDays),
});
const allowanceOf = (draft: Draft): Allowance => ({
  ...draft,
  maxImpressions: draft.maxImpressions === '' ? null : Number(draft.maxImpressions),
  cooldownDays: draft.cooldownDays === '' ? null : Number(draft.cooldownDays),
});
/** Empty is "no limit"; anything else must be a whole number from 1. */
const invalid = (value: string) =>
  value !== '' && (!Number.isSafeInteger(Number(value)) || Number(value) < 1);

/** Site-wide vetoes remain off by default. No control writes before Save. */
export function SiteAllowance({
  onEditingStateChange,
}: { onEditingStateChange?: SettingsEditing } = {}) {
  const id = useId();
  const [allowance, setAllowance] = useState<Loadable<Allowance>>(LOADING);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [retry, setRetry] = useState(0);
  const status = useSaveStatus();
  const saveButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let active = true;
    setAllowance(LOADING);
    readSiteAllowance()
      .then((value) => {
        if (!active) return;
        setAllowance(ready(value));
        setDraft(draftOf(value));
      })
      .catch((cause: unknown) => {
        if (active) setAllowance(failed(cause));
      });
    return () => {
      active = false;
    };
  }, [retry]);
  const current = allowance.status === 'ready' ? allowance.data : null;
  const dirty =
    current !== null &&
    JSON.stringify(draft) !== JSON.stringify(draftOf(current));
  useSettingsEditing(dirty, saving, onEditingStateChange);
  const change = (next: Partial<Draft>) => {
    setDraft((held) => (held === null ? null : { ...held, ...next }));
    setError(null);
    status.clear();
  };
  const invalidMax = checked && draft !== null && invalid(draft.maxImpressions);
  const invalidWait = checked && draft !== null && invalid(draft.cooldownDays);
  const review = () => {
    if (!draft || !dirty || saving) return;
    setChecked(true);
    if (invalid(draft.maxImpressions) || invalid(draft.cooldownDays)) {
      document.getElementById(invalid(draft.maxImpressions) ? `${id}-max` : `${id}-wait`)?.focus();
      return;
    }
    setError(null);
    setReviewing(true);
  };
  const save = async () => {
    if (!draft || saving) return;
    setSaving(true);
    setError(null);
    try {
      const next = await saveSiteAllowance(allowanceOf(draft));
      setAllowance(ready(next));
      setDraft(draftOf(next));
      setChecked(false);
      setReviewing(false);
      status.markSaved();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  };
  const title = __('Display limits', 'wconvert');
  if (allowance.status === 'loading')
    return <RegionSkeleton label={title} lines={4} />;
  if (allowance.status === 'failed')
    return (
      <Region>
        <RegionHeader title={title} />
        <RegionErrorState
          message={allowance.message}
          onRetry={() => setRetry((value) => value + 1)}
        />
      </Region>
    );
  const pending = draft === null ? [] : allowanceLines(allowanceOf(draft));
  const wholeNumber = __('Enter a whole number of at least 1, or leave it empty.', 'wconvert');
  return (
    <Region>
      <RegionHeader
        title={title}
        description={__('These apply to every campaign, on top of its own display rules.', 'wconvert')}
      />
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          review();
        }}
      >
        <RegionBody>
          <fieldset disabled={saving} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
            <legend className="sr-only">
              {__('Site-wide display limits', 'wconvert')}
            </legend>
            <Field
              label={ALLOWANCE_LABELS.maxImpressions()}
              htmlFor={`${id}-max`}
              hint={__('A total across all campaigns, not per day. Leave empty for no limit.', 'wconvert')}
              hintId={`${id}-max-hint`}
              error={invalidMax ? wholeNumber : undefined}
            >
              <span className="flex items-center gap-2">
                <Input id={`${id}-max`} className="w-28" type="number" inputMode="numeric" min={1} step={1}
                  placeholder={__('No limit', 'wconvert')} aria-invalid={invalidMax || undefined}
                  aria-describedby={`${id}-max-unit ${id}-max-hint`}
                  value={draft?.maxImpressions ?? ''} onChange={(event) => change({ maxImpressions: event.target.value })} />
                <span id={`${id}-max-unit`}>{__('times per visitor', 'wconvert')}</span>
              </span>
            </Field>
            <Field
              label={ALLOWANCE_LABELS.cooldownDays()}
              htmlFor={`${id}-wait`}
              hint={__('Leave empty for no wait.', 'wconvert')}
              hintId={`${id}-wait-hint`}
              error={invalidWait ? wholeNumber : undefined}
            >
              <span className="flex items-center gap-2">
                <Input id={`${id}-wait`} className="w-28" type="number" inputMode="numeric" min={1} step={1}
                  placeholder={__('None', 'wconvert')} aria-invalid={invalidWait || undefined}
                  aria-describedby={`${id}-wait-unit ${id}-wait-hint`}
                  value={draft?.cooldownDays ?? ''} onChange={(event) => change({ cooldownDays: event.target.value })} />
                <span id={`${id}-wait-unit`}>{__('days', 'wconvert')}</span>
              </span>
            </Field>
            <CheckRow
              label={ALLOWANCE_LABELS.stopAfterDismiss()}
              hint={__('Applies to every campaign, not only the one they closed.', 'wconvert')}
              checked={draft?.stopAfterDismiss ?? false}
              onChange={(event) => change({ stopAfterDismiss: event.target.checked })}
            />
            <CheckRow
              label={ALLOWANCE_LABELS.stopAfterConversion()}
              hint={__('A conversion is a form submission or a campaign link click.', 'wconvert')}
              checked={draft?.stopAfterConversion ?? false}
              onChange={(event) => change({ stopAfterConversion: event.target.checked })}
            />
          </fieldset>
        </RegionBody>
        <RegionFooter className="flex flex-wrap items-center justify-end gap-3">
          <SaveStatus saved={status.saved} />
          <Button type="button" variant="outline" disabled={!dirty || saving} onClick={() => { setDraft(draftOf(allowance.data)); setError(null); setChecked(false); }}>{__('Cancel changes', 'wconvert')}</Button>
          <Button ref={saveButton} type="submit" disabled={!dirty || saving}>{saving ? __('Saving…', 'wconvert') : __('Save display limits', 'wconvert')}</Button>
        </RegionFooter>
      </form>
      <AdminDialog open={reviewing} onOpenChange={(open) => { if (!saving) { setReviewing(open); setError(null); } }}>
        <AdminDialogContent
          size="sm"
          onCloseAutoFocus={(event) => {
            // There is no trigger for Radix to return to: back to Save while
            // it still has something to save, else to the first limit.
            event.preventDefault();
            (saveButton.current?.disabled ? document.getElementById(`${id}-max`) : saveButton.current)?.focus();
          }}
        >
          <AdminDialogHeader
            title={__('Site-wide display limits', 'wconvert')}
            meta={__('These take effect on every campaign. Each campaign’s own display rules still apply.', 'wconvert')}
          />
          <AdminDialogBody>
            {pending.length === 0 ? (
              <p className="m-0">{__('No site-wide limits. Each campaign uses its own display rules.', 'wconvert')}</p>
            ) : (
              <ul className="m-0 grid list-disc gap-1 ps-5">
                {pending.map((line) => <li key={line}>{line}</li>)}
              </ul>
            )}
          </AdminDialogBody>
          <AdminDialogFooter
            back={<AdminDialogClose asChild><Button variant="outline" disabled={saving}>{__('Keep editing', 'wconvert')}</Button></AdminDialogClose>}
            error={error}
          >
            <Button disabled={saving} onClick={() => void save()}>{saving ? __('Saving…', 'wconvert') : __('Apply to all campaigns', 'wconvert')}</Button>
          </AdminDialogFooter>
        </AdminDialogContent>
      </AdminDialog>
    </Region>
  );
}

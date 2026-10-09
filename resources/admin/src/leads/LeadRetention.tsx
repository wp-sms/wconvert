import { useEffect, useId, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Field } from '../shell/Field';
import { OptionStrip } from '../shell/OptionStrip';
import { Region, RegionBody, RegionError, RegionErrorState, RegionFooter, RegionHeader } from '../shell/Region';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { SaveStatus, useSaveStatus } from '../shell/SaveStatus';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { readRetention, saveRetention, type Retention } from './api';
import { formatCount } from '../lib/format';
import { useSettingsEditing, type SettingsEditing } from '../settings-page/useSettingsEditing';

interface Draft {
  automatic: boolean;
  days: string;
  /** The Custom chip is chosen, so the number field shows even when it holds a preset's value. */
  custom: boolean;
}

/** The periods most policies name; anything else is Custom. */
const PRESETS = [30, 90, 180, 365] as const;
const isPreset = (days: string) => PRESETS.some((preset) => String(preset) === days);

const draftOf = (period: Retention): Draft => {
  const days = period.days === null ? '' : String(period.days);
  return { automatic: period.days !== null, days, custom: !isPreset(days) };
};

/**
 * How long submissions are kept: the one real setting on Data & privacy, so
 * it is an open region at the top rather than a folded disclosure (it was the
 * last thing a merchant found). The header line describes the SAVED policy;
 * the controls are a separate, explicit draft.
 */
export function LeadRetention({ onEditingStateChange }: { onEditingStateChange?: SettingsEditing } = {}) {
  const [retention, setRetention] = useState<Loadable<Retention>>(LOADING);
  const [draft, setDraft] = useState<Draft>({ automatic: false, days: '', custom: true });
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { saved, markSaved, clear: clearSaved } = useSaveStatus();
  const [confirmDays, setConfirmDays] = useState<number | null>(null);
  const foreverRadio = useRef<HTMLInputElement>(null);
  const automaticRadio = useRef<HTMLInputElement>(null);
  const daysInput = useRef<HTMLInputElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const returnToSavedPolicy = useRef(false);
  const focusDays = useRef(false);
  const id = useId();

  useEffect(() => {
    let active = true;
    setRetention(LOADING);
    readRetention().then((period) => {
      if (!active) return;
      setRetention(ready(period));
      setDraft(draftOf(period));
    }).catch((cause: unknown) => {
      if (active) setRetention(failed(cause));
    });
    return () => { active = false; };
  }, [retry]);

  useEffect(() => {
    if (saved && !saving && !draft.automatic) foreverRadio.current?.focus();
  }, [saved, saving, draft.automatic]);

  // Choosing Custom puts the cursor in the field it just drew.
  useEffect(() => {
    if (focusDays.current && draft.custom) daysInput.current?.focus();
    focusDays.current = false;
  }, [draft.custom]);

  const period = retention.status === 'ready' ? retention.data : null;
  const dirty = period !== null && (
    draft.automatic !== (period.days !== null)
    || (draft.automatic && draft.days !== String(period.days))
  );
  useSettingsEditing(dirty, saving, onEditingStateChange);
  const changeDraft = (next: Draft) => {
    setDraft(next);
    setValidation(null);
    clearSaved();
  };
  const cancelChanges = () => {
    if (period === null || saving) return;
    setDraft(draftOf(period));
    setValidation(null);
    setError(null);
    clearSaved();
    (period.days === null ? foreverRadio : automaticRadio).current?.focus();
  };
  const commit = async (days: number | null) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const current = await saveRetention(days);
      setRetention(ready(current));
      setDraft(draftOf(current));
      markSaved();
      returnToSavedPolicy.current = true;
      setConfirmDays(null);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  };
  const saveDraft = () => {
    if (period === null || saving || !dirty) return;
    if (!draft.automatic) {
      void commit(null);
      return;
    }
    const days = Number(draft.days);
    if (draft.days.trim() === '' || !Number.isInteger(days) || days < 1 || days > period.max_days) {
      setValidation(sprintf(
        __('Enter a whole number from 1 to %d days.', 'wconvert'),
        period.max_days,
      ));
      daysInput.current?.focus();
      return;
    }
    returnToSavedPolicy.current = false;
    setConfirmDays(days);
  };

  const title = __('How long submissions are kept', 'wconvert');
  if (retention.status === 'loading') return <RegionSkeleton label={title} lines={2} />;
  if (retention.status === 'failed') {
    return (
      <Region>
        <RegionHeader title={title} />
        <RegionErrorState message={retention.message} onRetry={() => setRetry((value) => value + 1)} />
      </Region>
    );
  }
  const maxDays = retention.data.max_days;
  const presets = PRESETS.filter((preset) => preset <= maxDays);
  const chip = draft.custom ? 'custom' : draft.days;

  return (
    <>
      <Region>
        <RegionHeader
          title={title}
          description={retention.data.days === null
            ? __('Kept until you delete them', 'wconvert')
            : sprintf(
                _n('Deleted automatically after %s day', 'Deleted automatically after %s days', retention.data.days, 'wconvert'),
                formatCount(retention.data.days),
              )}
        />
        {error !== null && confirmDays === null && <RegionError message={error} />}
        <RegionBody className="flex flex-col gap-3">
          <p className="m-0 text-note text-muted-foreground" id={`${id}-scope`}>
            {__('Applies to submissions from every campaign. Copies already sent to destinations or exported aren’t affected.', 'wconvert')}
          </p>
          <fieldset className="wconvert-radio-cards" disabled={saving} aria-describedby={`${id}-scope`}>
            <legend className="mb-4 pt-2 font-medium">{__('Keep submissions', 'wconvert')}</legend>
            <label className="wconvert-radio-card">
              <input
                ref={foreverRadio}
                aria-labelledby={`${id}-forever`}
                type="radio"
                name={`${id}-policy`}
                checked={!draft.automatic}
                onChange={() => changeDraft({ ...draft, automatic: false })}
              />
              <span><span id={`${id}-forever`}>{__('Keep them until I delete them', 'wconvert')}</span></span>
            </label>
            <label className="wconvert-radio-card">
              <input
                ref={automaticRadio}
                aria-labelledby={`${id}-automatic`}
                aria-describedby={`${id}-automatic-hint`}
                type="radio"
                name={`${id}-policy`}
                checked={draft.automatic}
                data-setting="retention-automatic"
                onChange={() => changeDraft({ ...draft, automatic: true })}
              />
              <span><span id={`${id}-automatic`}>{__('Delete them automatically after', 'wconvert')}</span><span id={`${id}-automatic-hint`}>{__('A daily cleanup permanently deletes older submissions.', 'wconvert')}</span></span>
            </label>
            {draft.automatic && (
              <div className="flex flex-col items-start gap-3 ps-[39px]">
                <OptionStrip
                  label={__('Retention period', 'wconvert')}
                  value={chip}
                  disabled={saving}
                  options={[
                    ...presets.map((preset) => ({
                      value: String(preset),
                      label: sprintf(_n('%s day', '%s days', preset, 'wconvert'), formatCount(preset)),
                    })),
                    { value: 'custom', label: __('Custom', 'wconvert') },
                  ]}
                  onChange={(next) => {
                    if (next === 'custom') {
                      focusDays.current = true;
                      changeDraft({ ...draft, custom: true });
                    } else changeDraft({ ...draft, days: next, custom: false });
                  }}
                />
                {draft.custom && (
                  <Field
                    className="items-start"
                    label={__('Retention period in days', 'wconvert')}
                    htmlFor={`${id}-days`}
                    error={validation !== null && <span id={`${id}-validation`}>{validation}</span>}
                  >
                    <Input
                      ref={daysInput}
                      id={`${id}-days`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={maxDays}
                      step={1}
                      className="w-28"
                      value={draft.days}
                      aria-invalid={validation !== null || undefined}
                      aria-describedby={validation !== null ? `${id}-validation` : undefined}
                      onChange={(event) => changeDraft({ ...draft, days: event.target.value })}
                    />
                  </Field>
                )}
              </div>
            )}
          </fieldset>
        </RegionBody>
        <RegionFooter className="flex flex-wrap items-center justify-end gap-3">
          <SaveStatus saved={saved} />
          {dirty && (
            <Button variant="outline" disabled={saving} onClick={cancelChanges}>
              {__('Cancel changes', 'wconvert')}
            </Button>
          )}
          <Button ref={saveButton} disabled={saving || !dirty} onClick={saveDraft}>
            {saving ? __('Saving…', 'wconvert') : __('Save retention', 'wconvert')}
          </Button>
        </RegionFooter>
      </Region>
      <AlertDialog
        open={confirmDays !== null}
        onOpenChange={(open) => { if (!open && !saving) setConfirmDays(null); }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = returnToSavedPolicy.current
              ? period?.days === null ? foreverRadio : automaticRadio
              : saveButton;
            target.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {sprintf(
                _n('Delete submissions older than %s day?', 'Delete submissions older than %s days?', confirmDays ?? 0, 'wconvert'),
                formatCount(confirmDays ?? 0),
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {__('Existing and future submissions from every campaign are permanently deleted once they are older than this. Export a CSV first if you need them.', 'wconvert')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="m-0 text-note text-muted-foreground">{__('Campaign totals in analytics stay. Copies already sent to destinations or exported aren’t affected.', 'wconvert')}</p>
          {error !== null && <p role="alert" className="m-0 text-note text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{__('Cancel', 'wconvert')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={saving}
              onClick={(event) => {
                event.preventDefault();
                if (confirmDays !== null) void commit(confirmDays);
              }}
            >
              {saving
                ? __('Saving…', 'wconvert')
                : sprintf(
                    _n('Delete after %s day', 'Delete after %s days', confirmDays ?? 0, 'wconvert'),
                    formatCount(confirmDays ?? 0),
                  )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

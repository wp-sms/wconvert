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
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { RegionBody, RegionError, RegionErrorState, RegionFooter } from '../shell/Region';
import { SettingsDisclosure } from '../shell/SettingsDisclosure';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { readRetention, saveRetention, type Retention } from './api';
import { useSettingsEditing, type SettingsEditing } from '../settings-page/useSettingsEditing';

interface Draft {
  automatic: boolean;
  days: string;
}

const draftOf = (period: Retention): Draft => ({
  automatic: period.days !== null,
  days: period.days === null ? '' : String(period.days),
});

/** The disclosure describes the saved policy; controls are a separate, explicit draft. */
export function LeadRetention({ expanded = false, onEditingStateChange }: { expanded?: boolean; onEditingStateChange?: SettingsEditing } = {}) {
  const [retention, setRetention] = useState<Loadable<Retention>>(LOADING);
  const [draft, setDraft] = useState<Draft>({ automatic: false, days: '' });
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDays, setConfirmDays] = useState<number | null>(null);
  const foreverRadio = useRef<HTMLInputElement>(null);
  const automaticRadio = useRef<HTMLInputElement>(null);
  const daysInput = useRef<HTMLInputElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const returnToSavedPolicy = useRef(false);
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

  const period = retention.status === 'ready' ? retention.data : null;
  const dirty = period !== null && (
    draft.automatic !== (period.days !== null)
    || (draft.automatic && draft.days !== String(period.days))
  );
  useSettingsEditing(dirty, saving, onEditingStateChange);
  const changeDraft = (next: Draft) => {
    setDraft(next);
    setValidation(null);
    setSaved(false);
  };
  const cancelChanges = () => {
    if (period === null || saving) return;
    setDraft(draftOf(period));
    setValidation(null);
    setError(null);
    setSaved(false);
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
      setSaved(true);
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

  return (
    <>
      <SettingsDisclosure
        expanded={expanded}
        title={expanded ? __('Data & privacy', 'wconvert') : __('How long leads are kept', 'wconvert')}
        summary={period === null
          ? __('Lead retention settings', 'wconvert')
          : period.days === null
            ? __('Kept until you delete them', 'wconvert')
            : sprintf(
                _n('Automatically deleted after %d day', 'Automatically deleted after %d days', period.days, 'wconvert'),
                period.days,
              )}
        attention={retention.status === 'failed' || error !== null}
      >
        {retention.status === 'loading' ? (
          <RegionBody className="flex flex-col gap-3">
            <span role="status" className="sr-only">{__('Loading…', 'wconvert')}</span>
            <Skeleton aria-hidden="true" className="h-[1lh] w-64 max-w-full" />
            <Skeleton aria-hidden="true" className="h-(--control-height) w-64 max-w-full" />
          </RegionBody>
        ) : retention.status === 'failed' ? (
          <>
            <RegionErrorState
              message={retention.message}
              hint={__('Try loading the retention settings again.', 'wconvert')}
            />
            <RegionFooter>
              <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>
                {__('Retry loading retention', 'wconvert')}
              </Button>
            </RegionFooter>
          </>
        ) : (
          <>
            {error !== null && confirmDays === null && <RegionError message={error} />}
            <RegionBody className="flex flex-col gap-3">
              <p className="m-0 rounded-md border border-border bg-secondary p-4 text-note text-muted-foreground" id={`${id}-scope`}>
                {__('Applies to leads from every Campaign. Copies already sent to destinations or exported are unaffected.', 'wconvert')}
              </p>
              <fieldset className="wconvert-radio-cards" disabled={saving} aria-describedby={`${id}-scope`}>
                <legend className="mb-4 pt-5 font-medium">{__('Keep captured submissions', 'wconvert')}</legend>
                <label className="wconvert-radio-card">
                  <input
                    ref={foreverRadio}
                    aria-label={__('Keep them until I delete them', 'wconvert')}
                    type="radio"
                    name={`${id}-policy`}
                    checked={!draft.automatic}
                    onChange={() => changeDraft({ ...draft, automatic: false })}
                  />
                  <span><span>{__('Keep them until I delete them', 'wconvert')}</span><span>{__('No automatic deletion schedule.', 'wconvert')}</span></span>
                </label>
                <label className="wconvert-radio-card">
                  <input
                    ref={automaticRadio}
                    aria-label={__('Delete them automatically after', 'wconvert')}
                    type="radio"
                    name={`${id}-policy`}
                    checked={draft.automatic}
                    onChange={() => changeDraft({ ...draft, automatic: true })}
                  />
                  <span><span>{__('Delete them automatically after', 'wconvert')}</span><span>{__('Older stored submissions are permanently removed.', 'wconvert')}</span></span>
                </label>
                {draft.automatic && (
                  <div className="flex flex-col items-start gap-1.5 ps-[39px]">
                    <Label htmlFor={`${id}-days`}>{__('Retention period in days', 'wconvert')}</Label>
                    <Input
                      ref={daysInput}
                      id={`${id}-days`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={retention.data.max_days}
                      step={1}
                      className="w-28"
                      value={draft.days}
                      aria-invalid={validation !== null || undefined}
                      aria-describedby={validation !== null ? `${id}-validation` : undefined}
                      onChange={(event) => changeDraft({ ...draft, days: event.target.value })}
                    />
                    {validation !== null && (
                      <p id={`${id}-validation`} role="alert" className="m-0 text-note text-destructive">
                        {validation}
                      </p>
                    )}
                  </div>
                )}
              </fieldset>
            </RegionBody>
            <RegionFooter className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-note text-muted-foreground">{dirty ? __('Unsaved changes', 'wconvert') : __('No unsaved changes', 'wconvert')}</span>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={saving || !dirty} onClick={cancelChanges}>
                  {__('Cancel changes', 'wconvert')}
                </Button>
                <Button ref={saveButton} disabled={saving || !dirty} onClick={saveDraft}>
                  {saving ? __('Saving…', 'wconvert') : __('Save retention', 'wconvert')}
                </Button>
              </div>
              {saved && <span role="status" className="text-note">{__('Retention saved.', 'wconvert')}</span>}
            </RegionFooter>
          </>
        )}
      </SettingsDisclosure>
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
                _n('Automatically delete leads older than %d day?', 'Automatically delete leads older than %d days?', confirmDays ?? 0, 'wconvert'),
                confirmDays ?? 0,
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {__('Existing and future leads older than this period will be permanently deleted during daily cleanup. Export a CSV first if you need them. This applies to every Campaign.', 'wconvert')}
            </AlertDialogDescription>
          </AlertDialogHeader>
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
                    _n('Delete after %d day', 'Delete after %d days', confirmDays ?? 0, 'wconvert'),
                    confirmDays ?? 0,
                  )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

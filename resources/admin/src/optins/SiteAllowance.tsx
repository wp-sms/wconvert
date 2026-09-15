import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { allowanceSummary } from './allowanceSummary';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '../components/ui/alert-dialog';
import {
  Region,
  RegionBody,
  RegionError,
  RegionErrorState,
  RegionFooter,
  RegionHeader,
} from '../shell/Region';
import { RegionSkeleton } from '../shell/RegionSkeleton';
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

/** Site-wide vetoes remain off by default. No control writes before Save. */
export function SiteAllowance({
  onEditingStateChange,
}: { onEditingStateChange?: SettingsEditing } = {}) {
  const [allowance, setAllowance] = useState<Loadable<Allowance>>(LOADING);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [retry, setRetry] = useState(0);
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
  };
  const save = async (confirmed = false) => {
    if (!draft || !dirty || saving) return;
    if (
      [draft.maxImpressions, draft.cooldownDays].some(
        (value) =>
          value !== '' &&
          (!Number.isSafeInteger(Number(value)) || Number(value) < 1),
      )
    ) {
      setError(
        __(
          'Enter a whole number of at least 1, or leave the field empty.',
          'wconvert',
        ),
      );
      return;
    }
    if (!confirmed) { setReviewing(true); return; }
    setSaving(true);
    setError(null);
    try {
      const next = await saveSiteAllowance({
        ...draft,
        maxImpressions:
          draft.maxImpressions === '' ? null : Number(draft.maxImpressions),
        cooldownDays:
          draft.cooldownDays === '' ? null : Number(draft.cooldownDays),
      });
      setAllowance(ready(next));
      setDraft(draftOf(next));
      setReviewing(false);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  };
  if (allowance.status === 'loading')
    return (
      <RegionSkeleton label={__('Display limits', 'wconvert')} lines={4} />
    );
  if (allowance.status === 'failed')
    return (
      <Region>
        <RegionErrorState message={allowance.message} />
        <RegionFooter>
          <Button
            variant="outline"
            onClick={() => setRetry((value) => value + 1)}
          >
            {__('Retry loading display limits', 'wconvert')}
          </Button>
        </RegionFooter>
      </Region>
    );
  return (
    <Region>
      <RegionHeader
        title={__('Visitor experience', 'wconvert')}
        description={allowanceSummary(allowance.data)}
      />
      {error && !reviewing && <RegionError message={error} />}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <RegionBody>
          <p className="mt-0 rounded-md border border-border bg-secondary px-4 py-3 text-note text-muted-foreground">
            {__(
              'These limits apply to every Campaign, in addition to its own display rules.',
              'wconvert',
            )}
          </p>
          <fieldset disabled={saving} className="m-0 min-w-0 border-0 p-0">
            <legend className="sr-only">
              {__('Site-wide display limits', 'wconvert')}
            </legend>
            <div className="flex flex-col divide-y divide-border">
              <div className="flex flex-wrap items-center justify-between gap-4 py-5">
                <div><label htmlFor="wconvert-site-max" className="font-medium">{__('Total campaign appearances per visitor', 'wconvert')}</label>
                  <p className="mb-0 mt-1 text-note text-muted-foreground">{__('A site-wide total, not a daily limit. Leave blank for no extra cap.', 'wconvert')}</p></div>
                <Input id="wconvert-site-max" className="w-28" type="number" min={1} step={1} placeholder={__('No limit', 'wconvert')} value={draft?.maxImpressions ?? ''} onChange={(event) => change({ maxImpressions: event.target.value })} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 py-5">
                <div><label htmlFor="wconvert-site-cooldown" className="font-medium">{__('Wait between campaigns', 'wconvert')}</label>
                  <p className="mb-0 mt-1 text-note text-muted-foreground">{__('Leave blank to add no site-wide waiting period.', 'wconvert')}</p></div>
                <span className="flex items-center gap-2"><Input id="wconvert-site-cooldown" className="w-28" type="number" min={1} step={1} placeholder={__('None', 'wconvert')} value={draft?.cooldownDays ?? ''} onChange={(event) => change({ cooldownDays: event.target.value })} /><span>{__('days', 'wconvert')}</span></span>
              </div>
              <label htmlFor="wconvert-site-dismiss" className="flex items-start gap-3 py-5">
                <input id="wconvert-site-dismiss" className="mt-1 size-4 shrink-0 accent-primary" type="checkbox" checked={draft?.stopAfterDismiss ?? false} onChange={(event) => change({ stopAfterDismiss: event.target.checked })} />
                <span className="font-medium">{__('Stop showing campaigns after a visitor closes one', 'wconvert')}<small className="mt-1 block text-note font-normal text-muted-foreground">{__('Applies across all campaigns, not only the one they closed.', 'wconvert')}</small></span>
              </label>
              <label htmlFor="wconvert-site-convert" className="flex items-start gap-3 py-5">
                <input id="wconvert-site-convert" className="mt-1 size-4 shrink-0 accent-primary" type="checkbox" checked={draft?.stopAfterConversion ?? false} onChange={(event) => change({ stopAfterConversion: event.target.checked })} />
                <span className="font-medium">{__('Stop showing campaigns after a visitor converts', 'wconvert')}<small className="mt-1 block text-note font-normal text-muted-foreground">{__('A conversion can be a form submission or a campaign link click.', 'wconvert')}</small></span>
              </label>
            </div>
          </fieldset>
        </RegionBody>
        <RegionFooter className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-note text-muted-foreground">{dirty ? __('Unsaved changes', 'wconvert') : __('No unsaved changes', 'wconvert')}</span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!dirty || saving} onClick={() => { setDraft(draftOf(allowance.data)); setError(null); }}>{__('Cancel changes', 'wconvert')}</Button>
            <Button type="submit" disabled={!dirty || saving}>{saving ? __('Saving…', 'wconvert') : __('Save display limits', 'wconvert')}</Button>
          </div>
        </RegionFooter>
      </form>
      <AlertDialog open={reviewing} onOpenChange={(open) => { if (!saving) setReviewing(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{__('Review shared changes', 'wconvert')}</AlertDialogTitle>
            <AlertDialogDescription>{__('These display limits take effect across every campaign on this site. Campaign-specific rules still apply.', 'wconvert')}</AlertDialogDescription></AlertDialogHeader>
          {draft && <dl className="m-0 grid grid-cols-2 gap-3 text-note">
            <dt>{__('Total appearances per visitor', 'wconvert')}</dt><dd className="m-0">{draft.maxImpressions || __('No extra limit', 'wconvert')}</dd>
            <dt>{__('Wait between campaigns (days)', 'wconvert')}</dt><dd className="m-0">{draft.cooldownDays || __('No extra wait', 'wconvert')}</dd>
            <dt>{__('Stop after closing', 'wconvert')}</dt><dd className="m-0">{draft.stopAfterDismiss ? __('On', 'wconvert') : __('Off', 'wconvert')}</dd>
            <dt>{__('Stop after conversion', 'wconvert')}</dt><dd className="m-0">{draft.stopAfterConversion ? __('On', 'wconvert') : __('Off', 'wconvert')}</dd>
          </dl>}
          {error && <p role="alert" className="text-destructive">{error}</p>}
          <AlertDialogFooter><AlertDialogCancel disabled={saving}>{__('Keep editing', 'wconvert')}</AlertDialogCancel><Button disabled={saving} onClick={() => void save(true)}>{saving ? __('Saving…', 'wconvert') : __('Apply to all campaigns', 'wconvert')}</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Region>
  );
}

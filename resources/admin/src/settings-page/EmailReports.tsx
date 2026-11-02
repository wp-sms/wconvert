import { useEffect, useId, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { CheckRow } from '../shell/CheckRow';
import { Field } from '../shell/Field';
import { Region, RegionBody, RegionErrorState, RegionFooter, RegionHeader } from '../shell/Region';
import { SettingsRegionSkeleton } from './SettingsSkeleton';
import { SaveStatus, useSaveStatus } from '../shell/SaveStatus';
import { formatWhen } from '../lib/format';
import { messageOf } from '../shell/loadable';
import { useSettingsEditing, type SettingsEditing } from './useSettingsEditing';
import { readWeeklySummary, saveWeeklySummary, sendTestSummary, type WeeklySummarySetting } from './emailReportsApi';

/**
 * Settings → Email reports: the weekly summary email (ADR 0176; approved
 * prototype claude.ai/artifact/7kfMUDZUzGU3rbrxADFEcs).
 *
 * On by default, to the site's admin email. "Send a test email" sends this
 * week's summary to the addresses in the field now, saved or not, so the
 * layout can be checked before anything is saved. Switched off, the address
 * and the test button are hidden: they have nothing to act on.
 */
export function EmailReports({ onEditingStateChange }: { onEditingStateChange?: SettingsEditing }) {
  const id = useId();
  const [saved, setSaved] = useState<WeeklySummarySetting | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [recipients, setRecipients] = useState('');
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tested, setTested] = useState<string | null>(null);
  const status = useSaveStatus();

  useEffect(() => {
    let active = true;
    setLoadingError(null);
    void readWeeklySummary().then(
      (data) => {
        if (!active) return;
        setSaved(data);
        setEnabled(data.enabled);
        setRecipients(data.recipients);
      },
      (cause: unknown) => { if (active) setLoadingError(messageOf(cause)); },
    );
    return () => { active = false; };
  }, [retry]);

  const dirty = saved !== null && (saved.enabled !== enabled || saved.recipients !== recipients.trim());
  useSettingsEditing(dirty, saving || testing, onEditingStateChange);

  const title = __('Weekly summary email', 'wconvert');

  if (saved === null) {
    return loadingError === null
      ? <SettingsRegionSkeleton region="reports" />
      : <Region><RegionHeader title={title} /><RegionErrorState message={loadingError} onRetry={() => setRetry((n) => n + 1)} /></Region>;
  }

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const next = await saveWeeklySummary(enabled, recipients.trim());
      setSaved(next);
      setEnabled(next.enabled);
      setRecipients(next.recipients);
      status.markSaved();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setError(null);
    setTested(null);
    try {
      const result = await sendTestSummary(recipients.trim());
      setTested(result.to.join(', '));
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setTesting(false);
    }
  };

  const edited = () => { setError(null); setTested(null); status.clear(); };
  const cancel = () => { setEnabled(saved.enabled); setRecipients(saved.recipients); edited(); };

  return (
    <Region>
      <RegionHeader title={title} description={__('Every Monday morning: last week’s totals, your best campaign, and anything worth a look.', 'wconvert')} />
      <RegionBody className="flex flex-col gap-5">
        <CheckRow
          label={__('Send me a weekly summary', 'wconvert')}
          hint={__('Totals only. It never includes names, email addresses or phone numbers.', 'wconvert')}
          checked={enabled}
          disabled={saving}
          data-setting="weekly-summary"
          onChange={(event) => { setEnabled(event.target.checked); edited(); }}
        />
        {enabled && <>
          <Field label={__('Send to', 'wconvert')} htmlFor={`${id}-to`} hintId={`${id}-to-hint`}
            hint={__('Starts as your site’s admin email. Separate more than one address with commas.', 'wconvert')}>
            <Input id={`${id}-to`} type="text" inputMode="email" autoComplete="email" className="max-w-md" value={recipients}
              placeholder={saved.default_recipient} aria-describedby={`${id}-to-hint`} data-setting="weekly-summary-recipients"
              disabled={saving} onChange={(event) => { setRecipients(event.target.value); edited(); }} />
          </Field>
          <p className="m-0 text-note text-muted-foreground">
            {saved.waiting_for_publish
              ? __('The first one goes out the Monday after your first campaign is published.', 'wconvert')
              : saved.next_send
                ? sprintf(/* translators: %s: a date and time, e.g. “Nov 2, 2026, 9:00 AM”. */ __('Next summary: %s, in your site’s time zone.', 'wconvert'), formatWhen(saved.next_send, 'detail'))
                : null}
          </p>
        </>}
      </RegionBody>
      <RegionFooter className="flex flex-wrap items-center justify-end gap-3">
        <p role="status" className="m-0 min-w-0 flex-1 basis-64 text-note text-muted-foreground">
          {tested !== null && sprintf(/* translators: %s: the addresses the test went to. */ __('Test sent to %s. Not there in a few minutes? Check spam, then your site’s email setup.', 'wconvert'), tested)}
        </p>
        <div className="ms-auto flex flex-wrap items-center justify-end gap-3">
          {enabled && (
            <Button type="button" variant="outline" disabled={testing || saving} data-setting="weekly-summary-test" onClick={() => { void test(); }}>
              {testing ? __('Sending…', 'wconvert') : __('Send a test email', 'wconvert')}
            </Button>
          )}
          {error !== null && <p role="alert" className="m-0 text-note text-destructive">{error}</p>}
          <SaveStatus saved={status.saved} />
          {dirty && <Button type="button" variant="outline" disabled={saving} onClick={cancel}>{__('Cancel changes', 'wconvert')}</Button>}
          <Button type="button" disabled={!dirty || saving} onClick={() => { void save(); }}>
            {saving ? __('Saving…', 'wconvert') : __('Save email reports', 'wconvert')}
          </Button>
        </div>
      </RegionFooter>
    </Region>
  );
}

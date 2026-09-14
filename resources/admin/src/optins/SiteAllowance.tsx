import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { allowanceSummary } from './allowanceSummary';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
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
  const save = async () => {
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
        title={__('How often anything shows', 'wconvert')}
        description={allowanceSummary(allowance.data)}
      />
      {error && <RegionError message={error} />}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <RegionBody>
          <p className="mt-0 text-note text-muted-foreground">
            {__(
              'These limits apply to every Campaign, in addition to its own display rules.',
              'wconvert',
            )}
          </p>
          <fieldset disabled={saving} className="m-0 min-w-0 border-0 p-0">
            <legend className="sr-only">
              {__('Site-wide display limits', 'wconvert')}
            </legend>
            <div className="wconvert-allowance">
              <label className="wconvert-allowance__switch text-body">
                <input
                  type="checkbox"
                  checked={draft?.stopAfterDismiss ?? false}
                  onChange={(event) =>
                    change({ stopAfterDismiss: event.target.checked })
                  }
                />{' '}
                {__(
                  'Once they close any Campaign, show them nothing else',
                  'wconvert',
                )}
              </label>
              <label className="wconvert-allowance__switch text-body">
                <input
                  type="checkbox"
                  checked={draft?.stopAfterConversion ?? false}
                  onChange={(event) =>
                    change({ stopAfterConversion: event.target.checked })
                  }
                />{' '}
                {__(
                  'Once they sign up to anything, show them nothing else',
                  'wconvert',
                )}
              </label>
              <label htmlFor="wconvert-site-max">
                {__('Show at most this many in total', 'wconvert')}
              </label>
              <Input
                id="wconvert-site-max"
                className="w-24"
                type="number"
                min={1}
                step={1}
                value={draft?.maxImpressions ?? ''}
                onChange={(event) =>
                  change({ maxImpressions: event.target.value })
                }
              />
              <span className="text-note text-muted-foreground">
                {__('Empty means no limit.', 'wconvert')}
              </span>
              <label htmlFor="wconvert-site-cooldown">
                {__('Days to wait between any two', 'wconvert')}
              </label>
              <Input
                id="wconvert-site-cooldown"
                className="w-24"
                type="number"
                min={1}
                step={1}
                value={draft?.cooldownDays ?? ''}
                onChange={(event) =>
                  change({ cooldownDays: event.target.value })
                }
              />
              <span className="text-note text-muted-foreground">
                {__('Empty means no wait.', 'wconvert')}
              </span>
            </div>
          </fieldset>
        </RegionBody>
        <RegionFooter className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={!dirty || saving}>
            {saving
              ? __('Saving…', 'wconvert')
              : __('Save display limits', 'wconvert')}
          </Button>
          {dirty && (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setDraft(draftOf(allowance.data));
                setError(null);
              }}
            >
              {__('Cancel changes', 'wconvert')}
            </Button>
          )}
          {dirty && !saving && (
            <span className="text-note">
              {__('Unsaved changes', 'wconvert')}
            </span>
          )}
        </RegionFooter>
      </form>
    </Region>
  );
}

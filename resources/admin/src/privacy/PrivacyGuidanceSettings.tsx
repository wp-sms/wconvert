import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
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
import { messageOf } from '../shell/loadable';
import {
  readPrivacyGuidance,
  savePrivacyGuidance,
} from './api';
import {
  useSettingsEditing,
  type SettingsEditing,
} from '../settings-page/useSettingsEditing';

/** Site-wide progressive disclosure for Campaign privacy authoring. */
export function PrivacyGuidanceSettings({
  onEditingStateChange,
}: { onEditingStateChange?: SettingsEditing } = {}) {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [draft, setDraft] = useState<boolean | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setSaved(null);
    setDraft(null);
    setLoadingError(null);
    void readPrivacyGuidance()
      .then(({ enabled }) => {
        if (!active) return;
        setSaved(enabled);
        setDraft(enabled);
      })
      .catch((cause: unknown) => {
        if (active) setLoadingError(messageOf(cause));
      });
    return () => { active = false; };
  }, [retry]);

  const dirty = saved !== null && draft !== null && saved !== draft;
  useSettingsEditing(dirty, saving, onEditingStateChange);

  const save = async () => {
    if (draft === null || !dirty || saving) return;
    setSaving(true);
    setSaveError(null);
    setSavedNotice(false);
    try {
      const current = await savePrivacyGuidance(draft);
      setSaved(current.enabled);
      setDraft(current.enabled);
      setSavedNotice(true);
    } catch (cause) {
      setSaveError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  };

  if (saved === null || draft === null) {
    if (loadingError !== null) {
      return (
        <Region>
          <RegionHeader title={__('Data & privacy', 'wconvert')} />
          <RegionErrorState
            message={loadingError}
            hint={__('Try loading privacy guidance again.', 'wconvert')}
          />
          <RegionFooter>
            <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>
              {__('Retry loading privacy guidance', 'wconvert')}
            </Button>
          </RegionFooter>
        </Region>
      );
    }

    return <RegionSkeleton label={__('Data & privacy', 'wconvert')} lines={3} />;
  }

  return (
    <Region>
      <RegionHeader
        title={__('Data & privacy', 'wconvert')}
        description={__('Choose how much privacy help appears while creating Campaigns.', 'wconvert')}
      />
      {saveError !== null && <RegionError message={saveError} />}
      <RegionBody>
        <label className="flex items-start gap-3 py-2" htmlFor="wconvert-privacy-guidance">
          <input
            id="wconvert-privacy-guidance"
            className="mt-1 size-4 shrink-0 accent-primary"
            type="checkbox"
            checked={draft}
            disabled={saving}
            onChange={(event) => {
              setDraft(event.target.checked);
              setSaveError(null);
              setSavedNotice(false);
            }}
          />
          <span className="font-medium">
            {__('Show privacy guidance in the Campaign editor', 'wconvert')}
            <small className="mt-1 block text-note font-normal text-muted-foreground">
              {__('Adds a short Privacy Policy notice to new Campaign setups and checks it before publishing.', 'wconvert')}
            </small>
          </span>
        </label>
        <p className="mb-0 mt-4 rounded-md border border-border bg-secondary px-4 py-3 text-note text-muted-foreground">
          {__('Turning this off only simplifies future Campaign drafts and the editor. Export, erasure, retention and WordPress Privacy Policy tools stay available.', 'wconvert')}
        </p>
      </RegionBody>
      <RegionFooter className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-note text-muted-foreground">
          {dirty ? __('Unsaved changes', 'wconvert') : __('No unsaved changes', 'wconvert')}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!dirty || saving}
            onClick={() => {
              setDraft(saved);
              setSaveError(null);
              setSavedNotice(false);
            }}
          >
            {__('Cancel changes', 'wconvert')}
          </Button>
          <Button type="button" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? __('Saving…', 'wconvert') : __('Save privacy guidance', 'wconvert')}
          </Button>
        </div>
        {savedNotice && <span role="status" className="text-note">{__('Privacy guidance saved.', 'wconvert')}</span>}
      </RegionFooter>
    </Region>
  );
}

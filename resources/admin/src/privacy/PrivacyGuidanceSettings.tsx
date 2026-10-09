import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import {
  Region,
  RegionBody,
  RegionErrorState,
  RegionFooter,
  RegionHeader,
} from '../shell/Region';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { CheckRow } from '../shell/CheckRow';
import { SaveStatus, useSaveStatus } from '../shell/SaveStatus';
import { messageOf } from '../shell/loadable';
import {
  readPrivacyGuidance,
  savePrivacyGuidance,
} from './api';
import {
  useSettingsEditing,
  type SettingsEditing,
} from '../settings-page/useSettingsEditing';

/** Site-wide progressive disclosure for campaign privacy authoring. */
export function PrivacyGuidanceSettings({
  onEditingStateChange,
}: { onEditingStateChange?: SettingsEditing } = {}) {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [draft, setDraft] = useState<boolean | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const status = useSaveStatus();
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
    try {
      const current = await savePrivacyGuidance(draft);
      setSaved(current.enabled);
      setDraft(current.enabled);
      status.markSaved();
    } catch (cause) {
      setSaveError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  };

  const title = __('Privacy guidance', 'wconvert');
  if (saved === null || draft === null) {
    if (loadingError !== null) {
      return (
        <Region>
          <RegionHeader title={title} />
          <RegionErrorState message={loadingError} onRetry={() => setRetry((value) => value + 1)} />
        </Region>
      );
    }

    return <RegionSkeleton label={title} lines={2} />;
  }

  return (
    <Region>
      <RegionHeader title={title} />
      <RegionBody>
        <CheckRow
          label={__('Show privacy guidance in the campaign editor', 'wconvert')}
          hint={__('Adds a short privacy notice to new campaigns and checks it before publishing. Export, erasure and retention work either way.', 'wconvert')}
          checked={draft}
          disabled={saving}
          onChange={(event) => {
            setDraft(event.target.checked);
            setSaveError(null);
            status.clear();
          }}
        />
      </RegionBody>
      <RegionFooter className="flex flex-wrap items-center justify-end gap-3">
        {saveError !== null && <p role="alert" className="m-0 text-note text-destructive">{saveError}</p>}
        <SaveStatus saved={status.saved} />
        <Button
          type="button"
          variant="outline"
          disabled={!dirty || saving}
          onClick={() => {
            setDraft(saved);
            setSaveError(null);
          }}
        >
          {__('Cancel changes', 'wconvert')}
        </Button>
        <Button type="button" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? __('Saving…', 'wconvert') : __('Save privacy guidance', 'wconvert')}
        </Button>
      </RegionFooter>
    </Region>
  );
}

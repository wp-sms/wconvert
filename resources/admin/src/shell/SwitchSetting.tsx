import { useEffect, useState, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import {
  Region,
  RegionBody,
  RegionErrorState,
  RegionFooter,
  RegionHeader,
} from './Region';
import { RegionSkeleton } from './RegionSkeleton';
import { CheckRow } from './CheckRow';
import { SaveStatus, useSaveStatus } from './SaveStatus';
import { messageOf } from './loadable';
import {
  useSettingsEditing,
  type SettingsEditing,
} from '../settings-page/useSettingsEditing';

/**
 * One site-wide switch in its own region: read, toggle as a draft, Save.
 * Privacy guidance and "Let AI agents publish" are both this.
 */
export function SwitchSetting({
  title,
  label,
  hint,
  setting,
  saveLabel,
  read,
  save: write,
  children,
  onEditingStateChange,
}: {
  title: string;
  label: string;
  hint: string;
  /** The `data-setting` that Find a setting jumps to. */
  setting: string;
  saveLabel: string;
  read: () => Promise<{ enabled: boolean }>;
  save: (enabled: boolean) => Promise<{ enabled: boolean }>;
  /** Under the switch: a guide link, a note. */
  children?: ReactNode;
  onEditingStateChange?: SettingsEditing;
}) {
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
    void read()
      .then(({ enabled }) => {
        if (!active) return;
        setSaved(enabled);
        setDraft(enabled);
      })
      .catch((cause: unknown) => {
        if (active) setLoadingError(messageOf(cause));
      });
    return () => { active = false; };
  }, [retry, read]);

  const dirty = saved !== null && draft !== null && saved !== draft;
  useSettingsEditing(dirty, saving, onEditingStateChange);

  const save = async () => {
    if (draft === null || !dirty || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const current = await write(draft);
      setSaved(current.enabled);
      setDraft(current.enabled);
      status.markSaved();
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
          label={label}
          hint={hint}
          checked={draft}
          disabled={saving}
          data-setting={setting}
          onChange={(event) => {
            setDraft(event.target.checked);
            setSaveError(null);
            status.clear();
          }}
        />
        {children}
      </RegionBody>
      <RegionFooter className="flex flex-wrap items-center justify-end gap-3">
        {saveError !== null && <p role="alert" className="m-0 text-note text-destructive">{saveError}</p>}
        <SaveStatus saved={status.saved} />
        {dirty && (
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => {
              setDraft(saved);
              setSaveError(null);
            }}
          >
            {__('Cancel changes', 'wconvert')}
          </Button>
        )}
        <Button type="button" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? __('Saving…', 'wconvert') : saveLabel}
        </Button>
      </RegionFooter>
    </Region>
  );
}

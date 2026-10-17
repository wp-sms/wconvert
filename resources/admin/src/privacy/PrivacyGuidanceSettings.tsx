import { __ } from '@wordpress/i18n';
import { SwitchSetting } from '../shell/SwitchSetting';
import { readPrivacyGuidance, savePrivacyGuidance } from './api';
import type { SettingsEditing } from '../settings-page/useSettingsEditing';

/** Site-wide progressive disclosure for campaign privacy authoring. */
export function PrivacyGuidanceSettings({
  onEditingStateChange,
}: { onEditingStateChange?: SettingsEditing } = {}) {
  return (
    <SwitchSetting
      title={__('Privacy guidance', 'wconvert')}
      label={__('Show privacy guidance in the campaign editor', 'wconvert')}
      hint={__('Adds a short privacy notice to new campaigns and checks it before publishing. Export, erasure and retention work either way.', 'wconvert')}
      setting="privacy-guidance"
      saveLabel={__('Save privacy guidance', 'wconvert')}
      read={readPrivacyGuidance}
      save={savePrivacyGuidance}
      onEditingStateChange={onEditingStateChange}
    />
  );
}

import { __ } from '@wordpress/i18n';
import { SwitchSetting } from '../shell/SwitchSetting';
import { readAgentPublishing, saveAgentPublishing } from './api';
import type { SettingsEditing } from '../settings-page/useSettingsEditing';

/**
 * Settings → Connections & destinations → AI agents. Agents read and draft
 * whatever this says; the switch decides only whether they may also publish
 * and pause (ADR 0154 §7).
 */
export function AgentSettings({
  onEditingStateChange,
}: { onEditingStateChange?: SettingsEditing } = {}) {
  return (
    <SwitchSetting
      title={__('AI agents', 'wconvert')}
      label={__('Let AI agents publish', 'wconvert')}
      hint={__('Agents can always read and make drafts. Give your agent its own WordPress user so you can see and revoke what it does.', 'wconvert')}
      setting="agents-publish"
      saveLabel={__('Save AI agent setting', 'wconvert')}
      read={readAgentPublishing}
      save={saveAgentPublishing}
      onEditingStateChange={onEditingStateChange}
    />
  );
}

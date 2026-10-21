import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { SwitchSetting } from '../shell/SwitchSetting';
import type { SettingsEditing } from './useSettingsEditing';

const path = '/wconvert/v1/theme/google-fonts';
const read = () => apiFetch<{ enabled: boolean }>({ path });
const save = (enabled: boolean) => apiFetch<{ enabled: boolean }>({ path, method: 'POST', data: { enabled, acknowledged: enabled } });

export function GoogleFontSettings({ onEditingStateChange }: { onEditingStateChange?: SettingsEditing }) {
  return <SwitchSetting title={__('Google Fonts', 'wconvert')} label={__('Load selected fonts from Google', 'wconvert')}
    hint={__('Off by default. Load only fonts needed by campaigns that appear. Install fonts in the WordPress Font Library to host them on your site instead. After changing this setting, clear any host or CDN page cache.', 'wconvert')}
    setting="google-fonts" saveLabel={__('Save Google Fonts', 'wconvert')} read={read} save={save} onEditingStateChange={onEditingStateChange}
    enableConfirmation={{ title: __('Enable Google Fonts?', 'wconvert'),
      description: __('WConvert will load selected fonts from Google when they are needed. Visitors’ browsers will connect to Google, sharing their IP address as part of those requests. Fonts also load in your editor preview. You can avoid these connections by installing fonts through the WordPress Font Library instead.', 'wconvert'),
      confirm: __('Enable Google Fonts', 'wconvert'), cancel: __('Keep disabled', 'wconvert') }} />;
}

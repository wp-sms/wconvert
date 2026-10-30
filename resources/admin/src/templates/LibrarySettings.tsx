import { __ } from '@wordpress/i18n';
import { SwitchSetting } from '../shell/SwitchSetting';
import { setCatalogConsent, catalogStatus } from './catalog';
import type { SettingsEditing } from '../settings-page/useSettingsEditing';

/**
 * What the library sends and to whom (wp.org Guideline 7). The library is on
 * by default (ADR 0175), so this is said here and in the readme's External
 * services rather than asked first.
 */
const disclosure = () => __('Designs and their thumbnails come from templates.wconvert.io, run on Cloudflare. Thumbnails load in your browser, so Cloudflare sees its IP address. No site address, licence or visitor data is sent. WConvert checks for new designs at most twice a day, and only while you have this library open.', 'wconvert');

const readConsent = async () => ({ enabled: (await catalogStatus()).consent === 'yes' });
const saveConsent = async (enabled: boolean) => ({ enabled: (await setCatalogConsent(enabled)).consent === 'yes' });

/** The library's off switch, in Settings → Data & privacy. */
export function LibrarySettings({ onEditingStateChange }: { onEditingStateChange?: SettingsEditing } = {}) {
  return (
    <SwitchSetting
      title={__('Online template library', 'wconvert')}
      label={__('Show designs from the WConvert library', 'wconvert')}
      hint={disclosure()}
      setting="template-library"
      saveLabel={__('Save template library', 'wconvert')}
      read={readConsent}
      save={saveConsent}
      onEditingStateChange={onEditingStateChange}
    />
  );
}


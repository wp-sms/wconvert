import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Library } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Description } from '../shell/Description';
import { SwitchSetting } from '../shell/SwitchSetting';
import { messageOf } from '../shell/loadable';
import { refreshCatalog, setCatalogConsent, catalogStatus } from './catalog';
import type { SettingsEditing } from '../settings-page/useSettingsEditing';

/**
 * What the library sends and to whom, said once and said the same in both
 * places it is asked: the picker's card and Settings (wp.org Guideline 7).
 */
const disclosure = () => __('Designs and their thumbnails come from templates.wconvert.io, run on Cloudflare. Thumbnails load in your browser, so Cloudflare sees its IP address. No site address, licence or visitor data is sent. WConvert checks for new designs at most twice a day, and only while you have this library open.', 'wconvert');

/**
 * The one-time question before any online design loads (ADR 0156). Nothing
 * reaches the network until it is answered yes, and "Not now" is remembered
 * just as firmly; Settings can change either answer.
 */
export function LibraryConsent({ onAnswered }: { onAnswered: (allowed: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answer = async (allowed: boolean) => {
    setBusy(true); setError(null);
    try {
      await setCatalogConsent(allowed);
      if (allowed) await refreshCatalog();
      onAnswered(allowed);
    } catch (cause) {
      setError(messageOf(cause));
      // The answer is saved even when the first fetch fails; the next open retries.
      onAnswered(allowed);
    } finally { setBusy(false); }
  };
  return (
    <section className="wconvert-library-consent" aria-labelledby="wconvert-library-consent-title">
      <Library aria-hidden="true" className="wconvert-library-consent__icon" />
      <div className="wconvert-library-consent__body">
        <h3 id="wconvert-library-consent-title" className="m-0 text-body font-semibold">{__('See more designs from the WConvert library?', 'wconvert')}</h3>
        <Description>{disclosure()}</Description>
        {error && <p role="alert" className="m-0 text-note text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => { void answer(true); }}>{__('Show online designs', 'wconvert')}</Button>
          <Button variant="outline" disabled={busy} onClick={() => { void answer(false); }}>{__('Not now', 'wconvert')}</Button>
        </div>
      </div>
    </section>
  );
}

/** The same answer, kept in Settings → Data & privacy. */
export function LibrarySettings({ onEditingStateChange }: { onEditingStateChange?: SettingsEditing } = {}) {
  return (
    <SwitchSetting
      title={__('Online template library', 'wconvert')}
      label={__('Show designs from the WConvert library', 'wconvert')}
      hint={disclosure()}
      setting="template-library"
      saveLabel={__('Save template library', 'wconvert')}
      read={async () => ({ enabled: (await catalogStatus()).consent === 'yes' })}
      save={async (enabled) => ({ enabled: (await setCatalogConsent(enabled)).consent === 'yes' })}
      onEditingStateChange={onEditingStateChange}
    />
  );
}


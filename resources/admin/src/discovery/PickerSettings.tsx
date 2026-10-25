import { useRef, useEffect, useId } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { AdminDialogBody, AdminDialogFooter, AdminDialogHeader } from '../components/ui/admin-dialog';
import { CheckRow } from '../shell/CheckRow';
import { RegionErrorState, TryAgain } from '../shell/Region';
import type { usePicker } from './usePicker';

/**
 * The design library's preferences as a view (ADR 0131): header, one
 * scrolling body, a footer with the way back. The library is already a dialog
 * and never stacks another, so it opens in place (`nested`) with a plain
 * heading. Occasions moved to the Campaigns ⋯ menu (ADR 0171).
 *
 * Choices save as they are made, like the star on a card: they are one
 * person's preferences, not a site setting.
 */
export function PickerSettings({ picker, onBack, nested = false, backLabel }: {
  picker: ReturnType<typeof usePicker>; onBack: () => void; nested?: boolean; backLabel?: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const sections = useId();
  useEffect(() => { if (nested) heading.current?.focus({ preventScroll: true }); }, [nested]);
  const data = picker.data;
  const title = __('Preferences', 'wconvert');
  const meta = __('Personal to your account on this site.', 'wconvert');

  return <>
    {nested
      ? <div className="wconvert-design-detail__header wconvert-picker-settings__header">
        <h3 ref={heading} tabIndex={-1}>{title}</h3>
        <p className="m-0 text-note text-muted-foreground">{meta}</p>
      </div>
      : <AdminDialogHeader title={title} meta={meta} />}
    <AdminDialogBody className="wconvert-picker-settings">
      {!data ? picker.error
        ? <RegionErrorState message={picker.error} onRetry={() => { void picker.reload(); }} />
        : <p role="status" className="m-0 text-note text-muted-foreground">{__('Loading preferences…', 'wconvert')}</p>
        : <>
          <section className="wconvert-picker-settings__section" aria-labelledby={`${sections}-recommendations`}>
            <h3 id={`${sections}-recommendations`}>{__('Personal recommendations', 'wconvert')}</h3>
            <CheckRow label={__('Show featured collections', 'wconvert')} checked={data.preferences.show_featured !== false} disabled={picker.saving}
              onChange={event => { void picker.preferences({ ...data.preferences, show_featured: event.target.checked }); }} />
            {data.preferences.hidden.length > 0 && <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={picker.saving} onClick={() => { void picker.preferences({ ...data.preferences, hidden: [] }); }}>{__('Restore hidden collections', 'wconvert')}</Button>
            </div>}
          </section>
          {data.preferences.saved.length > 0 && <section className="wconvert-picker-settings__section" aria-labelledby={`${sections}-saved`}>
            <h3 id={`${sections}-saved`}>{__('Saved designs', 'wconvert')}</h3>
            <ul className="wconvert-occasion-list">{data.preferences.saved.map(key => {
              const entry = data.saved_designs?.find(value => value.key === key);
              const name = entry?.name || __('Unnamed design', 'wconvert');
              return <li key={key}><div><strong><bdi>{name}</bdi></strong>{entry?.retired && <span>{__('No longer in the library', 'wconvert')}</span>}</div>
                <Button variant="ghost" disabled={picker.saving} aria-label={sprintf(/* translators: %s: a saved design's name, e.g. “Spring sale popup”. */ __('Remove %s from saved designs', 'wconvert'), name)} onClick={() => picker.toggleSaved(key)}>{__('Remove', 'wconvert')}</Button></li>;
            })}</ul>
          </section>}
        </>}
    </AdminDialogBody>
    <AdminDialogFooter
      back={<Button className="wconvert-picker__back" variant="outline" onClick={onBack}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{backLabel ?? __('Back to library', 'wconvert')}</Button>}
      note={<span role="status">{picker.saving ? __('Saving…', 'wconvert') : ''}</span>}
      error={data ? picker.error : null}>
      {data && picker.error && <TryAgain busy={picker.saving} onClick={() => { void picker.reload(); }} />}
    </AdminDialogFooter>
  </>;
}

import { useLayoutEffect, useRef, useState } from '@wordpress/element';
import { Button, ComboboxControl, Notice } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

type Campaign = { id: string; name: string; status: 'ready' | 'disabled' | 'unavailable' };
type Choices = { campaigns: Campaign[]; manageUrl: string | null };
declare global { interface Window { wconvertContentLockEditor?: unknown } }

function choices(value: unknown): Choices | null {
  if (!value || typeof value !== 'object' || !('campaigns' in value) || !Array.isArray(value.campaigns)) return null;
  if (!value.campaigns.every(item => item && typeof item.id === 'string' && typeof item.name === 'string' && ['ready', 'disabled', 'unavailable'].includes(item.status))) return null;
  const manageUrl = 'manageUrl' in value && typeof value.manageUrl === 'string' ? value.manageUrl : null;
  return { campaigns: value.campaigns, manageUrl };
}

export function useCampaignChoices() {
  const [data, setData] = useState(() => choices(window.wconvertContentLockEditor));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'updated' | 'error' | null>(null);
  async function refresh() {
    setBusy(true); setResult(null);
    try {
      const next = choices(await apiFetch({ path: '/wconvert/v1/content-lock-campaigns' }));
      if (!next) throw new Error('Invalid Campaign choices');
      window.wconvertContentLockEditor = next;
      setData(next); setResult('updated');
    } catch { setResult('error'); }
    finally { setBusy(false); }
  }
  return { data, busy, result, refresh };
}

type PickerState = ReturnType<typeof useCampaignChoices>;
type PickerProps = { value: string; onChange(value: string): void; focusRequested?: boolean; onFocusHandled?(): void };

/** Used in the canvas as well as settings, so repair guidance never disappears. */
export function CampaignStatus({ value, state }: { value: string; state: PickerState }) {
  const { data } = state;
  const selected = data?.campaigns.find(item => item.id === value);
  return <>
    {data === null && <Notice status="warning" isDismissible={false}>{__('Campaign choices could not be loaded. Try Refresh campaigns.', 'wconvert')}</Notice>}
    {value && data !== null && selected?.status !== 'ready' && <Notice status="warning" isDismissible={false}>{!selected
      ? __('This campaign is no longer published as inline. Choose another or republish it. Content stays public.', 'wconvert')
      : selected.status === 'disabled'
        ? __('Enable Content lock and republish this campaign, or choose another.', 'wconvert')
        : __('This campaign is unavailable. Content stays public.', 'wconvert')}</Notice>}
  </>;
}

export function CampaignPickerFields({ value, onChange, state, focusRequested, onFocusHandled }: PickerProps & { state: PickerState }) {
  const { data, busy, result, refresh } = state;
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(false);
  const picker = useRef<HTMLDivElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<'picker' | 'change' | null>(null);
  // These controls replace one another. Move focus only after a user action,
  // never when the block mounts or Campaign choices refresh.
  useLayoutEffect(() => {
    const target = focusRequested || pendingFocus.current === 'picker'
      ? picker.current?.querySelector<HTMLElement>('[role="combobox"]')
      : pendingFocus.current === 'change' ? changeButton.current : null;
    if (target) {
      target.focus();
      pendingFocus.current = null;
      if (focusRequested) onFocusHandled?.();
    }
  });
  const selected = data?.campaigns.find(item => item.id === value);
  const ready = data?.campaigns.filter(item => item.status === 'ready') ?? [];
  const options = ready.filter(item => item.id === value || item.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase()))
    .map(item => ({ value: item.id, label: item.name }));
  // Preserve unavailable selections visibly. Refresh never edits the post.
  if (value && selected?.status !== 'ready') options.unshift({ value, label: selected?.name ?? __('Previously selected campaign', 'wconvert') });
  return <div className="wconvert-lock-picker" ref={picker}>
    {value && !editing ? <div className="wconvert-lock-picker__selected">
      <span className="wconvert-lock-picker__label">{__('Campaign', 'wconvert')}</span>
      <strong>{selected?.name ?? __('Previously selected campaign', 'wconvert')}</strong>
      <div className="wconvert-lock-picker__actions">
        <Button ref={changeButton} variant="tertiary" aria-label={__('Change campaign', 'wconvert')} onClick={() => { pendingFocus.current = 'picker'; setEditing(true); }}>{__('Change', 'wconvert')}</Button>
        <Button variant="tertiary" aria-label={__('Clear campaign', 'wconvert')} onClick={() => { pendingFocus.current = 'picker'; setFilter(''); setEditing(false); onChange(''); }}>{__('Clear', 'wconvert')}</Button>
      </div>
    </div> : <>
      <ComboboxControl label={__('Campaign', 'wconvert')} value={value || null} options={options}
        onFilterValueChange={setFilter} onChange={next => { pendingFocus.current = next ? 'change' : 'picker'; setFilter(''); setEditing(false); onChange(next ?? ''); }} />
      {editing && value && <Button variant="tertiary" onClick={() => { pendingFocus.current = 'change'; setFilter(''); setEditing(false); }}>{__('Cancel', 'wconvert')}</Button>}
    </>}
    <CampaignStatus value={value} state={state} />
    {data !== null && ready.length === 0 && <p>{data.campaigns.some(item => item.status === 'unavailable')
      ? __('No Content lock campaigns are available right now.', 'wconvert')
      : __('No published Content lock campaigns yet.', 'wconvert')}</p>}
    <div className="wconvert-lock-picker__actions"><Button variant="tertiary" disabled={busy} onClick={() => { void refresh(); }}>{busy ? __('Refreshing…', 'wconvert') : __('Refresh campaigns', 'wconvert')}</Button>
    {data?.manageUrl ? <p><a href={data.manageUrl} target="_blank" rel="noopener noreferrer">{__('Manage campaigns', 'wconvert')}<span className="screen-reader-text">{__(' (opens in a new tab)', 'wconvert')}</span></a></p>
      : data && (ready.length === 0 || (value && selected?.status !== 'ready')) ? <p>{__('Ask your administrator to publish a Content lock campaign.', 'wconvert')}</p> : null}</div>
    {result === 'updated' && <p role="status">{__('Campaign choices updated.', 'wconvert')}</p>}
    {result === 'error' && <Notice status="error" isDismissible={false}>{__('Could not refresh campaigns. Your selection is unchanged. Try again.', 'wconvert')}</Notice>}
  </div>;
}

export function CampaignPicker(props: PickerProps) {
  const state = useCampaignChoices();
  return <CampaignPickerFields {...props} state={state} />;
}

import { useState } from '@wordpress/element';
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

/** Used in the canvas as well as settings, so repair guidance never disappears. */
export function CampaignStatus({ value, state }: { value: string; state: PickerState }) {
  const { data } = state;
  const selected = data?.campaigns.find(item => item.id === value);
  return <>
    {data === null && <Notice status="warning" isDismissible={false}>{__('Campaign choices could not be loaded. Try Refresh Campaigns.', 'wconvert')}</Notice>}
    {value && data !== null && selected?.status !== 'ready' && <Notice status="warning" isDismissible={false}>{!selected
      ? __('This Campaign is no longer published as inline. Choose another or republish it. Content stays public.', 'wconvert')
      : selected.status === 'disabled'
        ? __('Enable Content lock and republish this Campaign, or choose another.', 'wconvert')
        : __('This Campaign is unavailable. Content stays public.', 'wconvert')}</Notice>}
  </>;
}

export function CampaignPickerFields({ value, onChange, state }: { value: string; onChange(value: string): void; state: PickerState }) {
  const { data, busy, result, refresh } = state;
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(false);
  const selected = data?.campaigns.find(item => item.id === value);
  const ready = data?.campaigns.filter(item => item.status === 'ready') ?? [];
  const options = ready.filter(item => item.id === value || item.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase()))
    .map(item => ({ value: item.id, label: item.name }));
  // Preserve unavailable selections visibly. Refresh never edits the post.
  if (value && selected?.status !== 'ready') options.unshift({ value, label: selected?.name ?? __('Previously selected Campaign', 'wconvert') });
  return <div className="wconvert-lock-picker">
    {value && !editing ? <div className="wconvert-lock-picker__selected">
      <span className="wconvert-lock-picker__label">{__('Campaign', 'wconvert')}</span>
      <strong>{selected?.name ?? __('Previously selected Campaign', 'wconvert')}</strong>
      <div className="wconvert-lock-picker__actions">
        <Button variant="tertiary" aria-label={__('Change Campaign', 'wconvert')} onClick={() => setEditing(true)}>{__('Change', 'wconvert')}</Button>
        <Button variant="tertiary" aria-label={__('Clear Campaign', 'wconvert')} onClick={() => { setFilter(''); setEditing(false); onChange(''); }}>{__('Clear', 'wconvert')}</Button>
      </div>
    </div> : <>
      <ComboboxControl label={__('Campaign', 'wconvert')} value={value || null} options={options}
        onFilterValueChange={setFilter} onChange={next => { setFilter(''); setEditing(false); onChange(next ?? ''); }} />
      {editing && value && <Button variant="tertiary" onClick={() => { setFilter(''); setEditing(false); }}>{__('Cancel', 'wconvert')}</Button>}
    </>}
    <CampaignStatus value={value} state={state} />
    {data !== null && ready.length === 0 && <p>{data.campaigns.some(item => item.status === 'unavailable')
      ? __('No Content lock Campaigns are available right now.', 'wconvert')
      : __('No published Content lock Campaigns yet.', 'wconvert')}</p>}
    <div className="wconvert-lock-picker__actions"><Button variant="tertiary" disabled={busy} onClick={() => { void refresh(); }}>{busy ? __('Refreshing…', 'wconvert') : __('Refresh Campaigns', 'wconvert')}</Button>
    {data?.manageUrl ? <p><a href={data.manageUrl} target="_blank" rel="noopener noreferrer">{__('Manage Campaigns', 'wconvert')}<span className="screen-reader-text">{__(' (opens in a new tab)', 'wconvert')}</span></a></p>
      : data && (ready.length === 0 || (value && selected?.status !== 'ready')) ? <p>{__('Ask your administrator to publish a Content lock Campaign.', 'wconvert')}</p> : null}</div>
    {result === 'updated' && <p role="status">{__('Campaign choices updated.', 'wconvert')}</p>}
    {result === 'error' && <Notice status="error" isDismissible={false}>{__('Could not refresh Campaigns. Your selection is unchanged. Try again.', 'wconvert')}</Notice>}
  </div>;
}

export function CampaignPicker(props: { value: string; onChange(value: string): void }) {
  const state = useCampaignChoices();
  return <CampaignPickerFields {...props} state={state} />;
}

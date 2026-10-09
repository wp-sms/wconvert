import { Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import type { ChoicesSource, PickerCampaign, PickerRules, PickerState } from '@block/campaignPicker';
import { CampaignPickerFields as SharedFields, urlOrNull, useCampaignChoices as useSharedChoices } from '@block/campaignPicker';

/**
 * The content lock's picker: the free block-editor picker with the lock's
 * rules. Search, Refresh, the links out and focus handling are shared with the
 * inline campaign block (`resources/blocks/inline-optin/src/campaignPicker.tsx`);
 * what is here is what only a lock knows — a campaign is placeable when its
 * published version has content lock on and its rules can run.
 */
type Campaign = PickerCampaign & { status: 'ready' | 'disabled' | 'unavailable' };
declare global { interface Window { wconvertContentLockEditor?: unknown } }

function choices(value: unknown) {
  if (!value || typeof value !== 'object' || !('campaigns' in value) || !Array.isArray(value.campaigns)) return null;
  if (!value.campaigns.every(item => item && typeof item.id === 'string' && typeof item.name === 'string' && ['ready', 'disabled', 'unavailable'].includes(item.status))) return null;
  return { campaigns: value.campaigns as Campaign[], manageUrl: urlOrNull(value, 'manageUrl'), createUrl: null };
}

const source: ChoicesSource<Campaign> = {
  initial: () => window.wconvertContentLockEditor,
  path: '/wconvert/v1/content-lock-campaigns',
  parse: choices,
  remember: next => { window.wconvertContentLockEditor = next; },
};

export function useCampaignChoices() {
  return useSharedChoices(source);
}

type LockState = PickerState<Campaign>;
type PickerProps = { value: string; onChange(value: string): void; focusRequested?: boolean; onFocusHandled?(): void };

/** `__()` must not run at module scope, so the rules are built per render. */
function rules(): PickerRules<Campaign> {
  return {
    ready: item => item.status === 'ready',
    empty: data => data.campaigns.some(item => item.status === 'unavailable')
      ? __('No content lock campaigns are available right now.', 'wconvert')
      : __('No published content lock campaigns yet.', 'wconvert'),
    askAdministrator: __('Ask your administrator to publish a content lock campaign.', 'wconvert'),
  };
}

/**
 * What the canvas boundary says about the chosen campaign, named by its state
 * rather than "needs attention": the state is what tells the merchant which
 * door to use.
 */
export function boundaryLabel(value: string, state: LockState, unset: string): string {
  if (!value) return unset;
  // No list is not a verdict on the campaign; claim nothing about it.
  if (state.data === null) return __('Campaign choices not loaded', 'wconvert');
  const selected = state.data.campaigns.find(item => item.id === value);
  if (!selected) return __('Campaign unpublished', 'wconvert');
  if (selected.status === 'disabled') return __('Content lock off for this campaign', 'wconvert');
  if (selected.status === 'unavailable') return __('Campaign unavailable', 'wconvert');
  return selected.name !== '' ? selected.name : __('Unnamed campaign', 'wconvert');
}

/** Used in the canvas as well as settings, so repair guidance never disappears. */
export function CampaignStatus({ value, state }: { value: string; state: LockState }) {
  const { data } = state;
  const selected = data?.campaigns.find(item => item.id === value);
  return <>
    {data === null && <Notice status="warning" isDismissible={false}>{__('Campaign choices could not be loaded. Try Refresh campaigns.', 'wconvert')}</Notice>}
    {value && data !== null && selected?.status !== 'ready' && <Notice status="warning" isDismissible={false}>{!selected
      ? __('This campaign is no longer published as inline. Choose another or republish it. Content stays public.', 'wconvert')
      : selected.status === 'disabled'
        ? __('Turn on content lock and republish this campaign, or choose another. Content stays public.', 'wconvert')
        : __('This campaign is unavailable. Content stays public.', 'wconvert')}</Notice>}
  </>;
}

export function CampaignPickerFields({ state, ...props }: PickerProps & { state: LockState }) {
  return <>
    <SharedFields {...props} state={state} rules={rules()}><CampaignStatus value={props.value} state={state} /></SharedFields>
    {/* The trap a merchant falls into first: previewing a draft, seeing it unlocked, and concluding the lock is broken. */}
    <p className="wconvert-lock-settings__hint">{__('Draft previews stay unlocked. Check the published page in a private window.', 'wconvert')}</p>
  </>;
}

export function CampaignPicker(props: PickerProps) {
  const state = useCampaignChoices();
  return <CampaignPickerFields {...props} state={state} />;
}

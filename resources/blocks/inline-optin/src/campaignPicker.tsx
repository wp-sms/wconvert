import { useLayoutEffect, useRef, useState } from '@wordpress/element';
import { Button, ComboboxControl, Notice } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import type { ReactNode } from 'react';

/**
 * The block editor's campaign picker, shared by every WConvert block that
 * names a campaign.
 *
 * ============================================================================
 * FREE CODE, BECAUSE THE FREE BLOCK USES IT.
 * ============================================================================
 * It began as the content lock's picker (Pro), and the inline campaign block
 * was the weaker sibling: a plain select, no Refresh, no way out to WConvert.
 * The block is free, and free never imports `pro/` (bin/verify-source-contract.sh),
 * so the generic half moved here and Pro imports it through `@block/`.
 *
 * What stays with each block is what differs: which statuses can be placed,
 * why the others cannot, and the notice under the picker. The rest — search,
 * the selected card with Change and Clear, Refresh, the links out, and where
 * keyboard focus goes — is one implementation.
 */

export interface PickerCampaign {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly editUrl?: string | null;
}

export interface CampaignChoices<C extends PickerCampaign> {
  readonly campaigns: C[];
  /** WConvert's campaigns list, or null for someone who cannot open it. */
  readonly manageUrl: string | null;
  /** Campaign creation, or null where the block offers none or the user cannot create. */
  readonly createUrl: string | null;
}

export interface ChoicesSource<C extends PickerCampaign> {
  /** What the page arrived with, before any refresh. */
  initial(): unknown;
  /** The REST read behind Refresh. */
  readonly path: string;
  /** Null for anything that is not a list: "no list" is never "no campaigns". */
  parse(value: unknown): CampaignChoices<C> | null;
  /** Keep a refreshed list for the next block of the same kind to mount. */
  remember(next: CampaignChoices<C>): void;
}

/** A link's URL, or null; anything else is treated as absent. */
export function urlOrNull(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object' || !(key in value)) return null;
  const url = (value as Record<string, unknown>)[key];
  return typeof url === 'string' && url !== '' ? url : null;
}

/** A campaign's name on screen. An empty name is never replaced by its ID (ADR 0131). */
export function campaignName(campaign: PickerCampaign | undefined): string {
  if (campaign === undefined) return __('Previously selected campaign', 'wconvert');
  return campaign.name !== '' ? campaign.name : __('Unnamed campaign', 'wconvert');
}

export function useCampaignChoices<C extends PickerCampaign>(source: ChoicesSource<C>) {
  const [data, setData] = useState(() => source.parse(source.initial()));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'updated' | 'error' | null>(null);
  async function refresh() {
    setBusy(true); setResult(null);
    try {
      const next = source.parse(await apiFetch({ path: source.path }));
      if (!next) throw new Error('Invalid campaign choices');
      source.remember(next);
      setData(next); setResult('updated');
    } catch { setResult('error'); }
    finally { setBusy(false); }
  }
  return { data, busy, result, refresh };
}

export type PickerState<C extends PickerCampaign> = ReturnType<typeof useCampaignChoices<C>>;

/** What differs between the blocks that use the picker. */
export interface PickerRules<C extends PickerCampaign> {
  /** Can be placed now. */
  ready(campaign: C): boolean;
  /**
   * Listed but refused, with the reason in its label (GUIDELINES §8: never
   * offer what will be refused; mark it before the click). Null leaves a
   * campaign that is not ready out of the list entirely.
   */
  refused?(campaign: C): string | null;
  /**
   * Shown under the picker when nothing can be placed yet. Optional, for a
   * block that already says it louder (the inline block's placeholder).
   */
  empty?(data: CampaignChoices<C>): string;
  /** The door's label when nothing can be placed and `createUrl` is set. */
  createLabel?: string;
  /** For someone with no link into WConvert, who to ask instead. */
  askAdministrator: string;
}

type PickerProps<C extends PickerCampaign> = {
  value: string;
  onChange(value: string): void;
  state: PickerState<C>;
  rules: PickerRules<C>;
  focusRequested?: boolean;
  onFocusHandled?(): void;
  /** The block's own status notice, under the picker. */
  children?: ReactNode;
};

/** A link out of the editor. A new tab, so the post being edited stays open. */
export function NewTabLink({ href, children, button }: { href: string; children: string; button?: boolean }) {
  const label = <>{children}<span className="screen-reader-text">{__(' (opens in a new tab)', 'wconvert')}</span></>;
  return button
    ? <Button variant="secondary" href={href} target="_blank" rel="noopener noreferrer">{label}</Button>
    : <a href={href} target="_blank" rel="noopener noreferrer">{label}</a>;
}

export function CampaignPickerFields<C extends PickerCampaign>({ value, onChange, state, rules, focusRequested, onFocusHandled, children }: PickerProps<C>) {
  const { data, busy, result, refresh } = state;
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(false);
  const picker = useRef<HTMLDivElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<'picker' | 'change' | null>(null);
  // These controls replace one another. Move focus only after a user action,
  // never when the block mounts or campaign choices refresh.
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
  const ready = data?.campaigns.filter(item => rules.ready(item)) ?? [];
  const placeable = selected !== undefined && rules.ready(selected);
  const matches = (item: C) => item.id === value || campaignName(item).toLocaleLowerCase().includes(filter.toLocaleLowerCase());
  const options: { value: string; label: string; disabled?: boolean }[] = ready.filter(matches)
    .map(item => ({ value: item.id, label: campaignName(item) }));
  const refusedIds = new Set<string>();
  for (const item of data?.campaigns ?? []) {
    const reason = rules.ready(item) || item.id === value ? null : rules.refused?.(item) ?? null;
    if (reason === null) continue;
    refusedIds.add(item.id);
    if (matches(item)) options.push({ value: item.id, label: reason, disabled: true });
  }
  // Preserve unavailable selections visibly. Refresh never edits the post.
  if (value && !placeable) options.unshift({ value, label: campaignName(selected) });
  const choose = (next: string | null | undefined) => {
    // A refused option is disabled in the list; this is the guard for an
    // editor whose combobox predates disabled options.
    if (next && refusedIds.has(next)) return;
    pendingFocus.current = next ? 'change' : 'picker'; setFilter(''); setEditing(false); onChange(next ?? '');
  };
  const nothingToPlace = data !== null && ready.length === 0;
  return <div className="wconvert-lock-picker" ref={picker}>
    {value && !editing ? <div className="wconvert-lock-picker__selected">
      <span className="wconvert-lock-picker__label">{__('Campaign', 'wconvert')}</span>
      <strong>{campaignName(selected)}</strong>
      <div className="wconvert-lock-picker__actions">
        <Button ref={changeButton} variant="tertiary" aria-label={__('Change campaign', 'wconvert')} onClick={() => { pendingFocus.current = 'picker'; setEditing(true); }}>{__('Change', 'wconvert')}</Button>
        <Button variant="tertiary" aria-label={__('Clear campaign', 'wconvert')} onClick={() => { pendingFocus.current = 'picker'; setFilter(''); setEditing(false); onChange(''); }}>{__('Clear', 'wconvert')}</Button>
      </div>
    </div> : <>
      <ComboboxControl label={__('Campaign', 'wconvert')} value={value || null} options={options}
        onFilterValueChange={setFilter} onChange={choose} />
      {editing && value && <Button variant="tertiary" onClick={() => { pendingFocus.current = 'change'; setFilter(''); setEditing(false); }}>{__('Cancel', 'wconvert')}</Button>}
    </>}
    {children}
    {nothingToPlace && rules.empty && <p>{rules.empty(data)}</p>}
    <div className="wconvert-lock-picker__actions">
      {nothingToPlace && data.createUrl && rules.createLabel && <NewTabLink href={data.createUrl} button>{rules.createLabel}</NewTabLink>}
      <Button variant="tertiary" disabled={busy} onClick={() => { void refresh(); }}>{busy ? __('Refreshing…', 'wconvert') : __('Refresh campaigns', 'wconvert')}</Button>
      {data?.manageUrl && !(nothingToPlace && data.createUrl && rules.createLabel)
        ? <p><NewTabLink href={data.manageUrl}>{__('Manage campaigns', 'wconvert')}</NewTabLink></p>
        : data && !data.manageUrl && (nothingToPlace || (value && !placeable)) ? <p>{rules.askAdministrator}</p> : null}
    </div>
    {result === 'updated' && <p role="status">{__('Campaign choices updated.', 'wconvert')}</p>}
    {result === 'error' && <Notice status="error" isDismissible={false}>{__('Could not refresh campaigns. Your selection is unchanged. Try again.', 'wconvert')}</Notice>}
  </div>;
}

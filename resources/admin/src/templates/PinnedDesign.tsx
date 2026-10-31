import { useCallback, useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Description } from '../shell/Description';
import { RegionError } from '../shell/Region';
import { messageOf } from '../shell/loadable';
import { designIdOf, listTemplates, type TemplateIndex, type TemplateIndexEntry } from './api';
import { installDesign, refreshCatalog } from './catalog';
import { createHref, settingsHref } from '../nav';
import { tierProductName } from '../goals/availability';

/**
 * Where a "Use this template" link stands on this site (ADR 0156).
 *
 * `ready` is a local design new campaigns can start from; `install` is in the
 * hosted library and one explicit click away; `off` is a library turned off
 * in Settings or switched off by the site (constant, filter or empty address);
 * `locked`, `update_plugin` and `unavailable` explain, offering close designs
 * this site can use; `missing` is an id nothing here or online
 * knows any more. A link to an earlier id (an alias) finds the design.
 */
export type Pinned =
  | { state: 'loading' }
  | { state: 'failed'; message: string }
  | { state: 'ready' | 'install'; entry: TemplateIndexEntry }
  | { state: 'locked' | 'update_plugin' | 'unavailable'; entry: TemplateIndexEntry; related: TemplateIndexEntry[] }
  | { state: 'off' }
  | { state: 'missing'; related: TemplateIndexEntry[] };

export function usePinnedDesign(design: string | undefined) {
  const [pinned, setPinned] = useState<Pinned | null>(design ? { state: 'loading' } : null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!design) { setPinned(null); return; }
    let current = true;
    setPinned({ state: 'loading' });
    // A design the cached index does not know may be newer than the cache:
    // refresh once (at most every twelve hours, server-side) before saying so.
    void listTemplates().then(async (index) => {
      let found = resolve(index, design);
      if (found.state === 'missing' && index.catalog?.enabled && index.catalog.consent === 'yes') {
        await refreshCatalog(true).catch(() => undefined);
        found = resolve(await listTemplates(), design);
      }
      if (current) setPinned(found);
    })
      .catch((cause: unknown) => { if (current) setPinned({ state: 'failed', message: messageOf(cause) }); });
    return () => { current = false; };
  }, [design, retry]);
  const reload = useCallback(() => setRetry((value) => value + 1), []);
  return { pinned, reload };
}

function resolve(index: TemplateIndex, design: string): Pinned {
  const entry = index.templates.find((candidate) => designIdOf(candidate) === design || candidate.id === design)
    ?? index.templates.find((candidate) => candidate.aliases?.includes(design));
  const usable = (candidate: TemplateIndexEntry) => candidate !== entry
    && (candidate.remote === undefined ? candidate.availability === 'ready' : candidate.remote.state === 'install');
  if (entry?.remote && entry.remote.state !== 'install') return { state: entry.remote.state, entry, related: closest(index, entry.name, usable) };
  if (entry?.remote) return { state: 'install', entry };
  if (entry) return entry.availability === 'ready' ? { state: 'ready', entry } : { state: 'locked', entry, related: closest(index, entry.name, usable) };
  if (!index.catalog?.enabled || index.catalog.consent === 'no') return { state: 'off' };
  // Unknown here and online: offer what is closest by name, never a guess applied.
  return { state: 'missing', related: closest(index, design, usable) };
}

function closest(index: TemplateIndex, name: string, usable: (candidate: TemplateIndexEntry) => boolean): TemplateIndexEntry[] {
  const words = new Set(name.toLowerCase().split(/[-\s]+/u).filter((word) => word.length > 2));
  return index.templates
    .map((candidate) => ({ candidate, score: designIdOf(candidate).split('-').filter((word) => words.has(word)).length }))
    .filter(({ candidate, score }) => score > 0 && usable(candidate))
    .sort((a, b) => b.score - a.score).slice(0, 3).map(({ candidate }) => candidate);
}

function Related({ related }: { related: TemplateIndexEntry[] }) {
  if (!related.length) return null;
  return <>
    <Description>{__('These are close to it:', 'wconvert')}</Description>
    <ul className="m-0 flex flex-wrap gap-x-4 ps-0">{related.map((entry) => <li key={entry.id} className="list-none">
      <a className="underline underline-offset-2" href={createHref({ design: designIdOf(entry) })}><bdi>{entry.name}</bdi></a>
    </li>)}</ul>
  </>;
}

/** The banner at the top of creation that says which design the campaign will start from. */
export function PinnedDesignNotice({ pinned, onReload, onInstalled, onClear }: {
  pinned: Pinned;
  onReload: () => void;
  onInstalled: () => void;
  onClear: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (pinned.state === 'loading') return <p className="wconvert-picker__notice text-note">{__('Finding the design you chose…', 'wconvert')}</p>;
  if (pinned.state === 'failed') return <RegionError message={pinned.message} onRetry={onReload} />;
  const clear = <Button variant="link" onClick={onClear}>{__('Start without it', 'wconvert')}</Button>;
  if (pinned.state === 'off') {
    return <div className="wconvert-picker__notice" role="status">
      <strong>{__('The online design library is off', 'wconvert')}</strong>
      <Description>{__('Turn it on in Settings to find this design.', 'wconvert')}</Description>
      <div><a className="underline underline-offset-2" href={settingsHref('data')}>{__('Open Settings', 'wconvert')}</a></div>
      {clear}
    </div>;
  }
  if (pinned.state === 'missing') {
    return <div className="wconvert-picker__notice" role="status">
      <strong>{__('That design is no longer available', 'wconvert')}</strong>
      {pinned.related.length ? <Related related={pinned.related} /> : <Description>{__('Choose a goal, then a design.', 'wconvert')}</Description>}
      {clear}
    </div>;
  }
  const { entry } = pinned;
  const install = async () => {
    if (!entry.remote) return;
    setBusy(true); setError(null);
    try { await installDesign(entry.remote.id, entry.remote.sha256); onInstalled(); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  };
  return <div className="wconvert-picker__notice" role="status">
    <strong>{sprintf(/* translators: %s: a design name. */ __('Starting from “%s”', 'wconvert'), entry.name)}</strong>
    {pinned.state === 'ready' && <Description>{__('Choose a goal this design can serve. Your campaign starts with it.', 'wconvert')}</Description>}
    {pinned.state === 'install' && <>
      <Description>{__('This design is in the online library. Add it to your designs to start a campaign with it.', 'wconvert')}</Description>
      <div><Button disabled={busy} onClick={() => { void install(); }}>{busy ? __('Adding…', 'wconvert') : __('Add to my designs', 'wconvert')}</Button></div>
    </>}
    {pinned.state === 'update_plugin' && <Description>{__('This design needs a newer version of WConvert.', 'wconvert')}</Description>}
    {pinned.state === 'unavailable' && <Description>{__('This design needs a plugin this site doesn’t have.', 'wconvert')}</Description>}
    {/* A plain fact answering the link the admin followed: no link out, no
        price, nothing that reads as an advertisement (ADR 0156 §9). */}
    {pinned.state === 'locked' && <Description>{sprintf(/* translators: %s: the product that supplies it, e.g. “WConvert Pro”. */ __('This design needs %s.', 'wconvert'), tierProductName(entry.tier))}</Description>}
    {(pinned.state === 'locked' || pinned.state === 'update_plugin' || pinned.state === 'unavailable') && <Related related={pinned.related} />}
    {error && <p role="alert" className="m-0 text-note text-destructive">{error}</p>}
    {clear}
  </div>;
}

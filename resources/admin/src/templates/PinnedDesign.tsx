import { useCallback, useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ExternalLink } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Description } from '../shell/Description';
import { RegionError } from '../shell/Region';
import { messageOf } from '../shell/loadable';
import { listTemplates, type TemplateIndex, type TemplateIndexEntry } from './api';
import { installDesign } from './catalog';
import { LibraryConsent } from './LibraryConsent';
import { createHref } from '../nav';
import { tierProductName } from '../goals/availability';

/**
 * Where a "Use this template" link stands on this site (ADR 0156).
 *
 * `ready` is a local design new campaigns can start from; `install` is in the
 * hosted library and one explicit click away; `consent` cannot be looked up
 * until the library is allowed; `locked`, `update_plugin` and `unavailable`
 * explain; `missing` is an id nothing here or online knows any more.
 */
export type Pinned =
  | { state: 'loading' }
  | { state: 'failed'; message: string }
  | { state: 'ready' | 'install' | 'locked' | 'update_plugin' | 'unavailable'; entry: TemplateIndexEntry }
  | { state: 'consent' }
  | { state: 'missing'; related: TemplateIndexEntry[] };

export function usePinnedDesign(design: string | undefined) {
  const [pinned, setPinned] = useState<Pinned | null>(design ? { state: 'loading' } : null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!design) { setPinned(null); return; }
    let current = true;
    setPinned({ state: 'loading' });
    void listTemplates().then((index) => { if (current) setPinned(resolve(index, design)); })
      .catch((cause: unknown) => { if (current) setPinned({ state: 'failed', message: messageOf(cause) }); });
    return () => { current = false; };
  }, [design, retry]);
  const reload = useCallback(() => setRetry((value) => value + 1), []);
  return { pinned, reload };
}

function resolve(index: TemplateIndex, design: string): Pinned {
  const key = `registered:${design}`;
  const entry = index.templates.find((candidate) => candidate.design_key === key || candidate.id === design);
  if (entry?.remote) return { state: entry.remote.state, entry };
  if (entry) return { state: entry.availability === 'ready' ? 'ready' : 'locked', entry };
  if (index.catalog?.enabled && index.catalog.consent === 'unanswered') return { state: 'consent' };
  // Unknown here and online: offer what is closest by name, never a guess applied.
  const words = new Set(design.split('-'));
  const related = index.templates
    .map((candidate) => ({ candidate, score: (candidate.design_key ?? candidate.id).replace(/^registered:/u, '').split('-').filter((word) => words.has(word)).length }))
    .filter(({ candidate, score }) => score > 0 && (candidate.remote === undefined || candidate.remote.state === 'install'))
    .sort((a, b) => b.score - a.score).slice(0, 3).map(({ candidate }) => candidate);
  return { state: 'missing', related };
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
  if (pinned.state === 'consent') return <LibraryConsent onAnswered={onReload} />;
  const clear = <Button variant="link" onClick={onClear}>{__('Start without it', 'wconvert')}</Button>;
  if (pinned.state === 'missing') {
    return <div className="wconvert-picker__notice" role="status">
      <strong>{__('That design is no longer available', 'wconvert')}</strong>
      <Description>{pinned.related.length ? __('These are close to it:', 'wconvert') : __('Choose a goal, then a design.', 'wconvert')}</Description>
      {pinned.related.length > 0 && <ul className="m-0 flex flex-wrap gap-x-4 ps-0">{pinned.related.map((entry) => <li key={entry.id} className="list-none">
        <a className="underline underline-offset-2" href={createHref({ design: (entry.design_key ?? entry.id).replace(/^registered:/u, '') })}><bdi>{entry.name}</bdi></a>
      </li>)}</ul>}
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
    {pinned.state === 'locked' && <>
      <Description>{sprintf(/* translators: %s: the product that supplies it, e.g. “WConvert Pro”. */ __('This design comes with %s.', 'wconvert'), tierProductName(entry.tier))}</Description>
      {entry.preview_url && <a className="inline-flex items-center gap-1 underline underline-offset-2" href={entry.preview_url} target="_blank" rel="noopener noreferrer">
        {__('See this design', 'wconvert')}<ExternalLink aria-hidden="true" className="size-3.5" /></a>}
    </>}
    {error && <p role="alert" className="m-0 text-note text-destructive">{error}</p>}
    {clear}
  </div>;
}

import { useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeft, ArrowUpRight, Clock3, LayoutGrid, Lock, MapPin, Repeat2, Users } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { renderingFor, tierName } from '../../goals/availability';
import { listWithAnd } from './sentence';
import type { Frequency, RuleBundle, Targeting } from '../api';

export interface StartingPointsProps {
  readonly bundles: readonly RuleBundle[];
  readonly onApply: (patch: BundlePatch) => void;
  readonly describe: (bundle: RuleBundle) => readonly { label: string; before: string; after: string }[];
}

/** What applying one bundle changes — only the sections it named. */
export interface BundlePatch {
  readonly triggers?: readonly { type: string }[];
  readonly conditions?: readonly { type: string }[];
  readonly targeting?: Targeting;
  readonly frequency?: Frequency;
}

/** Browse and review in one dialog. Only the final apply writes draft rules. */
export function StartingPoints({ bundles, onApply, describe }: StartingPointsProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<RuleBundle | null>(null);
  const returnFocusTo = useRef<HTMLButtonElement | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (pending) reviewHeading.current?.focus();
    else if (open) returnFocusTo.current?.focus();
  }, [pending, open]);

  if (bundles.length === 0) return null;
  const shown = bundles.filter(bundle => [bundle.label, bundle.description, sectionsIn(bundle)]
    .some(text => text.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));

  return <div className="wconvert-starters wconvert-starters--compact">
    <div><h3>{__('Display rule sets', 'wconvert')}</h3>
      <p>{__('Start with a ready-made set of display rules.', 'wconvert')}</p>
    </div>
    <Dialog open={open} onOpenChange={next => {
      setOpen(next);
      if (next) { setSearch(''); setPending(null); returnFocusTo.current = null; }
    }}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><LayoutGrid aria-hidden="true" />{__('Browse display rule sets', 'wconvert')}</Button></DialogTrigger>
      <DialogContent className="wconvert-starting-picker sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{__('Choose a display rule set', 'wconvert')}</DialogTitle>
          <DialogDescription>{__('Browse ready-made rules, then review what will change before applying.', 'wconvert')}</DialogDescription>
        </DialogHeader>
        <div className="wconvert-starters-body">
          <div hidden={pending !== null}>
            <label className="wconvert-starters-search">{__('Find a display rule set', 'wconvert')}
              <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={__('Search by name or rule…', 'wconvert')} />
            </label>
            <ul className="wconvert-starters__list">
              {shown.map(bundle => {
                const rendering = renderingFor(bundle.availability, 'settings_list');
                const Icon = bundle.triggers !== undefined ? Clock3 : bundle.targeting !== undefined ? MapPin : bundle.frequency !== undefined ? Repeat2 : Users;
                const content = <>
                  <span className="wconvert-starter__icon" aria-hidden="true"><Icon /></span>
                  <span className="wconvert-starter__head">
                    <span className="wconvert-starter__name text-note font-semibold">{bundle.label}</span>
                    {rendering === 'offer' ? <Badge variant="secondary">{sectionsIn(bundle)}</Badge>
                      : rendering === 'upsell' ? <Badge variant="secondary"><Lock aria-hidden="true" />{tierName(undefined)}</Badge>
                        : <Badge variant="warning">{sprintf(__('Needs %s', 'wconvert'), bundle.requires_label ?? __('another plugin', 'wconvert'))}</Badge>}
                  </span>
                  <span className="wconvert-starter__what text-note text-muted-foreground">{bundle.description}</span>
                  {rendering === 'offer' && <span className="wconvert-starter__action">{__('Review rules', 'wconvert')}<ArrowUpRight aria-hidden="true" /></span>}
                </>;
                return <li key={bundle.id}>{rendering === 'offer'
                  ? <button type="button" className="wconvert-starter" onClick={event => { returnFocusTo.current = event.currentTarget; setPending(bundle); }}>{content}</button>
                  : <div className="wconvert-starter wconvert-starter--absent">{content}</div>}
                </li>;
              })}
            </ul>
            {shown.length === 0 && <p role="status">{__('No matching display rule sets.', 'wconvert')}</p>}
          </div>
          {pending && <div className="wconvert-starters-review">
            <Button variant="ghost" size="sm" onClick={() => setPending(null)}><ArrowLeft aria-hidden="true" />{__('Back to choices', 'wconvert')}</Button>
            <h3 ref={reviewHeading} tabIndex={-1}>{pending.label}</h3>
            <p>{pending.description}</p>
            <div className="wconvert-rule-comparison">
              <p>{__('Review the settings this display rule set will replace.', 'wconvert')}</p>
              {describe(pending).map(section => <div key={section.label} className="wconvert-rule-comparison__section">
                <strong>{section.label}</strong>
                <span><strong>{__('Current:', 'wconvert')}</strong> {section.before}</span>
                <span><strong>{__('After applying:', 'wconvert')}</strong> {section.after}</span>
              </div>)}
              <p>{__('Your start and end dates, priority and settings outside these sections stay the same. Undo can restore these draft settings.', 'wconvert')}</p>
            </div>
          </div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{__('Cancel', 'wconvert')}</Button>
          {pending && <Button onClick={() => { onApply(patchOf(pending)); setOpen(false); }}>{__('Replace these rules', 'wconvert')}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

/**
 * The sections a bundle names, in the order they appear on screen.
 *
 * Read off the keys the response carries rather than from a list kept beside
 * it, so the words and the effect cannot disagree: what the confirmation names
 * is what {@link patchOf} sends.
 */
export function affectedSections(bundle: RuleBundle): string[] {
  const named: string[] = [];

  if (bundle.targeting !== undefined) {
    named.push('where');
  }

  // A targeting replacement also replaces its logged-in and role restrictions.
  if (bundle.conditions !== undefined || bundle.targeting !== undefined) {
    named.push('who');
  }

  if (bundle.triggers !== undefined) {
    named.push('when');
  }

  if (bundle.frequency !== undefined) {
    named.push('how-often');
  }

  return named;
}

function sectionsIn(bundle: RuleBundle): string {
  const labels: Record<string, string> = {
    where: __('Pages', 'wconvert'),
    who: __('Audience', 'wconvert'),
    when: __('When it appears', 'wconvert'),
    'how-often': __('Frequency', 'wconvert'),
  };
  return listWithAnd(affectedSections(bundle).map((id) => labels[id]));
}

/** The bundle as a patch — exactly the sections it carries, and no others. */
export function patchOf(bundle: RuleBundle): BundlePatch {
  const patch: BundlePatch = {};

  return {
    ...patch,
    ...(bundle.triggers === undefined ? {} : { triggers: bundle.triggers }),
    ...(bundle.conditions === undefined ? {} : { conditions: bundle.conditions }),
    ...(bundle.targeting === undefined ? {} : { targeting: bundle.targeting }),
    ...(bundle.frequency === undefined ? {} : { frequency: bundle.frequency }),
  };
}

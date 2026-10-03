import { useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeft, ArrowUpRight, Clock3, LayoutGrid, Lock, MapPin, Repeat2, Users } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { isShown, renderingFor, tierName } from '../../goals/availability';
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
  const [section, setSection] = useState('all');
  const [pending, setPending] = useState<RuleBundle | null>(null);
  const returnFocusTo = useRef<HTMLButtonElement | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (pending) reviewHeading.current?.focus();
    else if (open) returnFocusTo.current?.focus();
  }, [pending, open]);

  if (bundles.length === 0) return null;
  const labels = sectionLabels();
  const words = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const shown = bundles.filter(bundle => isShown(bundle.availability) && (section === 'all' || affectedSections(bundle).includes(section))
    && words.every(word => [bundle.label, bundle.description, sectionsIn(bundle)].join(' ').toLocaleLowerCase().includes(word)));

  return <Dialog open={open} onOpenChange={next => {
      setOpen(next);
      if (next) { setSearch(''); setSection('all'); setPending(null); returnFocusTo.current = null; }
    }}>
      <DialogTrigger asChild><Button variant="ghost"><LayoutGrid aria-hidden="true" />{__('Browse display rule sets', 'wconvert')}</Button></DialogTrigger>
      <DialogContent className="wconvert-starting-picker sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{__('Choose a display rule set', 'wconvert')}</DialogTitle>
          <DialogDescription>{__('Start with ready-made rules. Review what they replace before applying to your draft.', 'wconvert')}</DialogDescription>
        </DialogHeader>
        <div className="wconvert-starters-body">
          <div hidden={pending !== null}>
            <div className="wconvert-starters-filters"><label className="wconvert-starters-search">{__('Find a display rule set', 'wconvert')}
              <Input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={__('Try scroll, mobile or repeat…', 'wconvert')} />
            </label>
            <label className="wconvert-starters-search">{__('Settings to change', 'wconvert')}
              <select value={section} onChange={event => setSection(event.target.value)}>
                <option value="all">{__('All settings', 'wconvert')}</option>
                {Object.entries(labels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label></div>
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
              <p>{__('Only the settings listed above are replaced. Dates, priority and campaign design stay the same. Undo can restore these draft settings.', 'wconvert')}</p>
            </div>
          </div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{__('Cancel', 'wconvert')}</Button>
          {pending && <Button onClick={() => { onApply(patchOf(pending)); setOpen(false); }}>{__('Apply to draft', 'wconvert')}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>;
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

  // Visitor restrictions belong to display_rules.audience, not page targeting.
  if (bundle.conditions !== undefined) {
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

function sectionLabels(): Record<string, string> {
  return {
    where: __('Pages', 'wconvert'),
    who: __('Audience', 'wconvert'),
    when: __('Opening moment', 'wconvert'),
    'how-often': __('Repeat limits', 'wconvert'),
  };
}

function sectionsIn(bundle: RuleBundle): string {
  const labels = sectionLabels();
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

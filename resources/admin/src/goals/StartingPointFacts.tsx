import { __, _n, sprintf } from '@wordpress/i18n';
import { CircleDashed, Clock, LayoutTemplate, MapPin, Repeat, Target, Users, type LucideIcon } from 'lucide-react';
import { displayTypeDescription, displayTypeLabel } from '../displayTypes';
import { summarise, summaryOf } from '../builder/rules/summaries';
import { howOftenSummary } from '../builder/rules/sentence';
import { targetingSummary } from '../builder/rules/targetingSummary';
import { convertingActOf } from '../builder/structure/guards';
import { nodesOf } from '../builder/structure/tree';
import { resultLinksToChoose } from '../builder/structure/journey';
import type { RuleVocabulary } from '../builder/api';
import type { GoalEntry, PlaybookEntry } from './api';

import { startingPointDisplayType } from '../discovery/model';
export { startingPointDisplayType } from '../discovery/model';

/** Only the differences needed to choose; the full setup is available on demand. */
export function StartingPointSummary({ playbook, vocabulary }: {
  playbook: PlaybookEntry;
  vocabulary: RuleVocabulary | null;
}) {
  const displayType = startingPointDisplayType(playbook);
  const timing = displayType === 'inline' ? __('Place with a block or shortcode', 'wconvert')
    : playbook.setup && vocabulary ? summaryOf(summarise({ ...playbook.setup, targeting: playbook.setup.targeting ?? {}, frequency: playbook.setup.frequency ?? {}, schedule: {}, priority: 0 }, vocabulary), 'when').text : null;
  return <p className="m-0 text-note text-muted-foreground">
    <span>{displayTypeDescription(displayType)}</span>{timing && <> · {timing}</>}
  </p>;
}

/**
 * **What this setup does, and what you still need** — a glance, not a page.
 *
 * Facts are one short line each beside an icon; the to-dos are the things a
 * merchant has to bring that the design cannot (a real code, a real link, a
 * service). The publication rule is listed only when the design does not
 * already meet it — the server leaves it out otherwise (ADR 0087, amended).
 */
export function StartingPointFacts({ playbook, goal, vocabulary }: {
  playbook: PlaybookEntry;
  goal: GoalEntry;
  vocabulary: RuleVocabulary | null;
}) {
  const setup = playbook.setup;
  const displayType = startingPointDisplayType(playbook);
  const facts: { icon: LucideIcon; label: string; text: string }[] = [
    { icon: LayoutTemplate, label: __('Format', 'wconvert'), text: displayTypeLabel(displayType) },
  ];

  if (setup && vocabulary) {
    const summaries = summarise({ ...setup, targeting: setup.targeting ?? {}, frequency: setup.frequency ?? {}, schedule: {}, priority: 0 }, vocabulary);
    const targeting = setup.targeting ?? {};
    facts.push({ icon: Clock, label: __('Opens', 'wconvert'), text: displayType === 'inline'
      ? __('Where you place it', 'wconvert')
      : summaryOf(summaries, 'when').text });
    facts.push({ icon: MapPin, label: __('Where', 'wconvert'), text: targetingSummary(targeting, vocabulary.targeting, 'compact') });
    if (setup.display_rules.audience.mode !== 'everyone') facts.push({ icon: Users, label: __('Who', 'wconvert'), text: summaryOf(summaries, 'who').text });
    if (setup.frequency && Object.keys(setup.frequency).length) {
      const act = playbook.template ? (convertingActOf(playbook.template.tree)[0] ?? 'submit') : 'submit';
      facts.push({ icon: Repeat, label: __('How often', 'wconvert'), text: howOftenSummary(setup.frequency, 0, displayType !== 'inline', act).text });
    }
  }
  facts.push({ icon: Target, label: __('Counts', 'wconvert'), text: goal.headline_label });

  const types = playbook.template ? new Set(nodesOf(playbook.template.tree).map((node) => node.type)) : new Set<string>();
  const resultLinks = playbook.template ? resultLinksToChoose(playbook.template.tree) : 0;
  const todo: string[] = [...(playbook.requirements ?? [])];
  if (types.has('code')) todo.push(__('A real discount code from your store', 'wconvert'));
  if (goal.outcome.link_required) todo.push(__('The real link to your offer or page', 'wconvert'));
  if (resultLinks > 0) todo.push(sprintf(
    /* translators: %d: how many quiz results need a link chosen before publishing. */
    _n('A link for its result', 'A link for each of its %d results', resultLinks, 'wconvert'), resultLinks));
  if (goal.outcome.audience_channel) todo.push(goal.outcome.audience_channel === 'phone'
    ? __('An SMS service to send to, or keep leads in WConvert', 'wconvert')
    : __('An email service to send to, or keep leads in WConvert', 'wconvert'));
  if (goal.outcome.destination_type) todo.push(__('The file or page to send, and its delivery email', 'wconvert'));
  if (goal.outcome.proof_level === 'captured' && !goal.outcome.audience_channel) todo.push(__('Someone to reply to requests', 'wconvert'));
  if (displayType === 'inline') todo.push(__('A page to place its block or shortcode on', 'wconvert'));
  if (types.has('countdown')) todo.push(__('The real end date', 'wconvert'));
  if (!setup || !vocabulary) todo.push(__('Display rules, reviewed in the editor', 'wconvert'));

  return <div className="wconvert-setup-glance">
    <dl className="wconvert-setup-facts">
      {facts.map(({ icon: Icon, label, text }) => <div key={label}>
        <dt><Icon size={16} aria-hidden="true" />{label}</dt><dd>{text}</dd>
      </div>)}
    </dl>
    {todo.length > 0 && <section aria-labelledby={`have-ready-${playbook.id}`}>
      <h3 id={`have-ready-${playbook.id}`}>{__('Have ready', 'wconvert')}</h3>
      <ul className="wconvert-setup-todo">{todo.map((item) => <li key={item}><CircleDashed size={16} aria-hidden="true" />{item}</li>)}</ul>
    </section>}
  </div>;
}

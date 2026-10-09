import { __, _n, sprintf } from '@wordpress/i18n';
import { displayTypeDescription } from '../displayTypes';
import { questions, summarise, summaryOf } from '../builder/rules/summaries';
import { howOftenSummary } from '../builder/rules/sentence';
import { targetingSummary } from '../builder/rules/targetingSummary';
import { convertingActOf } from '../builder/structure/guards';
import { nodesOf } from '../builder/structure/tree';
import { resultLinksToChoose } from '../builder/structure/journey';
import type { RuleVocabulary } from '../builder/api';
import { Disclosure } from '../shell/Disclosure';
import type { GoalEntry, PlaybookEntry } from './api';
import type { OutcomeContract } from './outcome';

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
 * What a visitor does, in the words the design detail uses. A quiz and an
 * add-to-cart Goal each have their own act; neither is a link.
 */
function visitorAction(action: OutcomeContract['action'] | undefined): string {
  switch (action) {
    case 'submit': return __('Submits a form', 'wconvert');
    case 'click': return __('Follows a link', 'wconvert');
    case 'match': return __('Finishes the quiz', 'wconvert');
    case 'add_to_cart': return __('Adds a product to the cart', 'wconvert');
    default: return __('No conversion action', 'wconvert');
  }
}

/** Facts about the actual Prefill result, never a new Playbook taxonomy. */
export function StartingPointFacts({ playbook, goal, vocabulary, compact = false }: {
  playbook: PlaybookEntry;
  goal: GoalEntry;
  compact?: boolean;
  vocabulary: RuleVocabulary | null;
}) {
  const setup = playbook.setup;
  const action = playbook.template ? convertingActOf(playbook.template.tree)[0] : goal.outcome.action;
  const displayType = startingPointDisplayType(playbook);
  const placement = displayTypeDescription(displayType);
  const facts: { label: string; text: string }[] = [
    { label: __('Counts', 'wconvert'), text: goal.headline_label },
    { label: __('Visitor action', 'wconvert'), text: visitorAction(action) },
    { label: __('Format', 'wconvert'), text: placement },
  ];

  if (setup && vocabulary) {
    const summaries = summarise({ ...setup, targeting: setup.targeting ?? {}, frequency: setup.frequency ?? {}, schedule: {}, priority: 0 }, vocabulary);
    const asked = questions();
    const targeting = setup.targeting ?? {};
    facts.push({ label: asked.where, text: targetingSummary(targeting, vocabulary.targeting, 'compact') });
    if (setup.display_rules.audience.mode !== 'everyone') facts.push({ label: asked.who, text: summaryOf(summaries, 'who').text });
    facts.push({ label: asked.when, text: displayType === 'inline'
      ? __('At its block or shortcode, when page and visitor rules allow it.', 'wconvert')
      : summaryOf(summaries, 'when').text });
    if (setup.frequency && Object.keys(setup.frequency).length) {
      const act = playbook.template ? (convertingActOf(playbook.template.tree)[0] ?? 'submit') : 'submit';
      facts.push({ label: asked['how-often'], text: howOftenSummary(setup.frequency, 0, displayType !== 'inline', act).text });
    }
  }

  const types = playbook.template ? new Set(nodesOf(playbook.template.tree).map((node) => node.type)) : new Set<string>();
  const checklist: string[] = [__('Replace sample copy and review the information you ask visitors for.', 'wconvert')];
  if (types.has('code')) checklist.push(__('Create a valid discount code in your store and enter it on the success screen.', 'wconvert'));
  if (goal.outcome.link_required) checklist.push(__('Set the button to the real offer or article URL and test the link.', 'wconvert'));
  if (goal.outcome.audience_channel) checklist.push(__('Choose a connected service, or choose “Keep in WConvert only” and arrange your own follow-up.', 'wconvert'));
  if (goal.outcome.destination_type) checklist.push(__('Add the resource to a delivery destination and test its email before launch.', 'wconvert'));
  if (goal.outcome.proof_level === 'captured' && !goal.outcome.audience_channel) checklist.push(__('Decide who checks leads and replies. A submitted request is not a booking.', 'wconvert'));
  if (displayType === 'inline') checklist.push(__('Add its block or shortcode to the page where it should appear.', 'wconvert'));
  if (types.has('countdown')) checklist.push(__('Set the real deadline and time zone in Schedule.', 'wconvert'));
  checklist.push(__('Review pages, display rules and frequency, then test the visitor journey.', 'wconvert'));
  const resultLinks = playbook.template ? resultLinksToChoose(playbook.template.tree) : 0;
  return <div className="flex flex-col gap-2 text-note">
    {playbook.template && playbook.template.tree.steps.length > 1 && <Disclosure variant="inline" title={__('Visitor journey', 'wconvert')} open={!compact}><p className="m-0">{playbook.notes || __('Visitors move through the relevant screens, then complete this campaign’s action.', 'wconvert')}</p></Disclosure>}
    <Disclosure variant="inline" title={__('Suggested placement & timing', 'wconvert')} open={!compact}>
    <dl className="wconvert-setup-facts">
      {facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.text}</dd></div>)}
    </dl></Disclosure>
    <Disclosure variant="inline" title={__('What this measures', 'wconvert')} open={!compact}><p className="m-0 text-muted-foreground">{goal.outcome.measurement}</p></Disclosure>
    {(!compact || !playbook.requirements?.includes(goal.outcome.requirement)) && <p className="m-0 text-muted-foreground"><strong>{__('Before publishing', 'wconvert')}: </strong>{goal.outcome.requirement}</p>}
    {resultLinks > 0 && <p className="m-0 text-muted-foreground">{sprintf(
      /* translators: %d: how many quiz results need a link chosen before publishing. */
      _n('You’ll choose a link for %d result.', 'You’ll choose a link for each of the %d results.', resultLinks, 'wconvert'),
      resultLinks,
    )}</p>}
    {(!setup || !vocabulary) && <p className="m-0 text-muted-foreground">{__('Review the display rules in the editor.', 'wconvert')}</p>}
    <Disclosure variant="inline" title={__('Your setup checklist', 'wconvert')}>
      <ul className="m-0 list-disc space-y-1 ps-5">{checklist.map((item) => <li key={item}>{item}</li>)}</ul>
    </Disclosure>
  </div>;
}

import { __, _n, sprintf } from '@wordpress/i18n';
import { displayTypeDescription } from '../displayTypes';
import { questions, summarise, summaryOf } from '../builder/rules/summaries';
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
    : playbook.setup && vocabulary ? summarise({ ...playbook.setup, targeting: playbook.setup.targeting ?? {}, frequency: playbook.setup.frequency ?? {}, schedule: {}, priority: 0 }, vocabulary, true).find(summary => summary.id === 'when')?.text ?? null : null;
  return <p className="m-0 text-note text-muted-foreground">
    <span>{displayTypeDescription(displayType)}</span>{timing && <> · {timing}</>}
  </p>;
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
    { label: __('Visitor action', 'wconvert'), text: action === 'submit'
      ? __('Fill in the form', 'wconvert') : __('Follow the button link', 'wconvert') },
    { label: __('Format', 'wconvert'), text: placement },
  ];

  if (setup && vocabulary) {
    const summaries = summarise({ ...setup, targeting: setup.targeting ?? {}, frequency: setup.frequency ?? {}, schedule: {}, priority: 0 }, vocabulary, displayType !== 'inline');
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
  if (goal.outcome.audience_channel) checklist.push(__('Choose a connected service, or explicitly choose Collect only and arrange your own follow-up.', 'wconvert'));
  if (goal.outcome.destination_type) checklist.push(__('Add the resource to a delivery destination and test its email before launch.', 'wconvert'));
  if (goal.outcome.proof_level === 'captured' && !goal.outcome.audience_channel) checklist.push(__('Decide who checks Leads and replies. A submitted request is not a booking.', 'wconvert'));
  if (displayType === 'inline') checklist.push(__('Add its block or shortcode to the page where it should appear.', 'wconvert'));
  if (types.has('countdown')) checklist.push(__('Set the real deadline and time zone in Schedule.', 'wconvert'));
  checklist.push(__('Review pages, display rules and frequency, then test the visitor journey.', 'wconvert'));
  const resultLinks = playbook.template ? resultLinksToChoose(playbook.template.tree) : 0;
  return <div className="flex flex-col gap-2 text-note">
    {playbook.template && playbook.template.tree.steps.length > 1 && <details open={!compact || undefined}><summary>{__('Visitor journey', 'wconvert')}</summary><p className="m-0">{playbook.notes || __('Visitors move through the relevant screens, then complete this campaign’s action.', 'wconvert')}</p></details>}
    <details open={!compact || undefined}><summary>{__('Suggested placement & timing', 'wconvert')}</summary>
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      {facts.map((fact) => <div key={fact.label} className="contents"><dt className="text-muted-foreground">{fact.label}</dt><dd className="m-0">{fact.text}</dd></div>)}
    </dl></details>
    <details open={!compact || undefined}><summary>{__('What this measures', 'wconvert')}</summary><p className="m-0 text-muted-foreground">{goal.outcome.measurement}</p></details>
    {(!compact || !playbook.requirements?.includes(goal.outcome.requirement)) && <p className="m-0 text-muted-foreground"><strong>{__('Before publishing', 'wconvert')}: </strong>{goal.outcome.requirement}</p>}
    {resultLinks > 0 && <p className="m-0 text-muted-foreground">{sprintf(
      /* translators: %d: how many quiz results need a link chosen before publishing. */
      _n('You’ll choose a link for %d result.', 'You’ll choose a link for each of the %d results.', resultLinks, 'wconvert'),
      resultLinks,
    )}</p>}
    {(!setup || !vocabulary) && <p className="m-0 text-muted-foreground">{__('Review the display rules in the editor.', 'wconvert')}</p>}
    <details>
      <summary className="cursor-pointer">{__('Your setup checklist', 'wconvert')}</summary>
      <ul className="my-2 list-disc space-y-1 ps-5">{checklist.map((item) => <li key={item}>{item}</li>)}</ul>
    </details>
  </div>;
}

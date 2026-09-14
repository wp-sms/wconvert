import { __ } from '@wordpress/i18n';
import { entriesOn } from '../builder/rules/axis';
import { howOftenSummary, whenSummary, whoSummary } from '../builder/rules/sentence';
import { targetingSummary } from '../builder/rules/targetingSummary';
import { convertingActOf } from '../builder/structure/guards';
import type { RuleVocabulary } from '../builder/api';
import type { GoalEntry, PlaybookEntry } from './api';

/** Facts about the actual Prefill result, never a new Playbook taxonomy. */
export function StartingPointFacts({ playbook, goal, vocabulary }: {
  playbook: PlaybookEntry;
  goal: GoalEntry;
  vocabulary: RuleVocabulary | null;
}) {
  const setup = playbook.setup;
  const action = playbook.template ? convertingActOf(playbook.template.tree)[0] : goal.outcome.action;
  const displayType = setup?.display_type ?? playbook.display_type;
  const placement = ({
    popup: __('Popup over the page', 'wconvert'),
    inline: __('Inside the page', 'wconvert'),
    floating_bar: __('Bar at the page edge', 'wconvert'),
    slide_in: __('Panel in a page corner', 'wconvert'),
  } as Record<string, string>)[displayType] ?? displayType;
  const facts: { label: string; text: string }[] = [
    { label: __('Counts', 'wconvert'), text: goal.headline_label },
    { label: __('Visitor action', 'wconvert'), text: action === 'submit'
      ? __('Fill in the form', 'wconvert') : __('Follow the button link', 'wconvert') },
    { label: __('Format', 'wconvert'), text: placement },
  ];

  if (setup && vocabulary) {
    const rules = setup.rules ?? [];
    const targeting = setup.targeting ?? {};
    const types = [...vocabulary.targeting, ...vocabulary.triggers, ...vocabulary.conditions];
    facts.push({ label: __('Pages', 'wconvert'), text: targetingSummary(targeting, vocabulary.targeting, 'compact') });
    const who = entriesOn(rules, vocabulary.conditions);
    if (who.length || targeting.logged_in !== undefined || targeting.roles?.length) {
      facts.push({ label: __('Audience', 'wconvert'), text: whoSummary(who, types, targeting.logged_in, targeting.roles).text });
    }
    facts.push({ label: __('When it appears', 'wconvert'), text: whenSummary(entriesOn(rules, vocabulary.triggers), types).text });
    if (setup.frequency && Object.keys(setup.frequency).length) {
      const act = playbook.template ? (convertingActOf(playbook.template.tree)[0] ?? 'submit') : 'submit';
      facts.push({ label: __('Schedule & frequency', 'wconvert'), text: howOftenSummary(setup.frequency, {}, 0, displayType !== 'inline', act).text });
    }
  }

  const hints = setup?.destination_hint ?? playbook.destination_hint;
  const sendsElsewhere = Array.isArray(hints?.types) && hints.types.length > 0;
  return <div className="flex flex-col gap-2 text-note">
    <p className="m-0 text-muted-foreground">{goal.outcome.measurement}</p>
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      {facts.map((fact) => <div key={fact.label} className="contents"><dt className="text-muted-foreground">{fact.label}</dt><dd className="m-0">{fact.text}</dd></div>)}
    </dl>
    <p className="m-0 text-muted-foreground"><strong>{__('Before publishing', 'wconvert')}: </strong>{goal.outcome.requirement}</p>
    {(!setup || !vocabulary) && <p className="m-0 text-muted-foreground">{__('Review the display rules in the editor.', 'wconvert')}</p>}
    {displayType === 'inline' && <p className="m-0 text-muted-foreground">{__('Add its block or shortcode to the page where it should appear.', 'wconvert')}</p>}
    {goal.outcome.destination_type !== null ? <p className="m-0 text-muted-foreground">{__('Choose a delivery destination and finish its settings before publishing.', 'wconvert')}</p>
      : sendsElsewhere && <p className="m-0 text-muted-foreground">{__('Connect a destination in the editor to send submissions to another service.', 'wconvert')}</p>}
  </div>;
}

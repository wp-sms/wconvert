import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { DisplayRules, type DisplayRulesValue } from '../../resources/admin/src/builder/rules/DisplayRules';
import { ruleTypes } from './support/rule-types';
import { displayPlan } from './support/display-entry';

const initial: DisplayRulesValue = { display_rules: displayPlan([{ type: 'time_on_page', seconds: 20 }, { type: 'scroll_depth', percent: 50 }]), targeting: {}, frequency: { maxPerSession: 1, stopAfterDismiss: false }, schedule: {}, priority: 0 };
const simple: DisplayRulesValue = { ...initial, display_rules: displayPlan([{ type: 'time_on_page', seconds: 15 }]) };
function setup(value = initial, availability = {}, compact = false, props: Partial<Parameters<typeof DisplayRules>[0]> = {}) {
  const changed = vi.fn();
  function Harness() {
    const [draft, setDraft] = useState(value);
    return <>
      <DisplayRules compact={compact} value={draft} vocabulary={ruleTypes(availability)} overlay onChange={patch => { changed(patch); setDraft({ ...draft, ...patch }); }} {...props} />
      <output data-testid="draft">{JSON.stringify(draft)}</output>
      <button type="button" onClick={() => setDraft(value)}>Undo everything</button>
    </>;
  }
  render(<Harness />);
  return changed;
}
const draft = () => JSON.parse(screen.getByTestId('draft').textContent!) as DisplayRulesValue;
const menu = () => screen.getByRole('navigation', { name: 'Display rules' });
const section = async (name: string) => userEvent.click(within(menu()).getByRole('button', { name: new RegExp(name.replace('?', '\\?')) }));
const picks = (question: string) => screen.getByRole('group', { name: question });
const pick = (question: string, name: string | RegExp) => within(picks(question)).getByRole('radio', { name });
const asTier = (installedTier: 'free' | 'basic' | 'pro' | 'elite') => {
  window.wconvertAdmin = { exportUrl: '', installedTier };
  onTestFinished(() => { delete window.wconvertAdmin; });
};

describe('the Display rules tab', () => {
  it('asks five questions, opens on Where, and reads the answers as one sentence', () => {
    setup(simple);
    expect(within(menu()).getAllByRole('button').map(button => button.firstChild?.textContent)).toEqual(['Where does it show?', 'Who sees it?', 'When does it open?', 'How often?', 'Dates']);
    expect(within(menu()).getByRole('button', { name: /Where does it show/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('heading', { name: 'Where does it show?' })).toBeInTheDocument();
    expect(document.querySelector('.wconvert-display-sentence')).toHaveTextContent('Shows on every page to everyone, after 15 seconds, once per visit.');
    expect(screen.queryByText(/Display setup/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Test a visit' })).toBeInTheDocument();
  });

  it('opens a section from its phrase in the sentence', async () => {
    setup(simple);
    await userEvent.click(screen.getByRole('button', { name: 'once per visit' }));
    expect(screen.getByRole('heading', { name: 'How often?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'once per visit' })).toHaveAttribute('aria-current', 'true');
  });

  it('opens on the first section that needs attention, and marks it in the menu and the sentence', () => {
    setup({ ...simple, targeting: { mode: 'selected' } });
    expect(screen.getByRole('heading', { name: 'Where does it show?' })).toBeInTheDocument();
    expect(within(menu()).getByRole('button', { name: /Where does it show/ })).toHaveTextContent('Needs attention');
    expect(screen.getByRole('button', { name: 'pages you haven’t chosen yet' })).toHaveAttribute('data-attention', 'true');
  });

  it('opens the lazy sample tester without changing the draft', async () => {
    const changed = setup(); await userEvent.click(screen.getByRole('button', { name: 'Test a visit' }));
    expect(await screen.findByRole('dialog', { name: 'Test a visit' })).toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
  });

  it('shows a repair step for an older draft, and no Who or When picks until it is replaced', async () => {
    setup({ ...initial, display_rules: undefined });
    expect(screen.getByRole('alert')).toHaveTextContent('older development rule format');
    await section('When does it open?');
    expect(screen.queryByRole('group', { name: 'When does it open?' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Set up display rules' }));
    expect(screen.getByRole('group', { name: 'When does it open?' })).toBeInTheDocument();
  });
});

describe('Where', () => {
  it('keeps an empty Selected pages choice, and the exclusions under every pick', async () => {
    setup(simple);
    expect(screen.getByText('But never on')).toBeInTheDocument();
    await userEvent.click(pick('Where does it show?', 'Selected pages'));
    expect(draft().targeting.mode).toBe('selected');
    expect(screen.getByText('Choose at least one page')).toHaveAttribute('data-attention', 'true');
    await section('Who sees it?'); await section('Where does it show?');
    expect(pick('Where does it show?', 'Selected pages')).toBeChecked();
    expect(screen.getByText('But never on')).toBeInTheDocument();
  });

  it('writes blog posts as one rule and reads it back as its pick', async () => {
    setup(simple);
    await userEvent.click(pick('Where does it show?', 'Blog posts only'));
    expect(draft().targeting).toMatchObject({ mode: 'selected', include: [{ type: 'singular', value: 'post' }] });
    expect(screen.queryByText('Show it on')).toBeNull();
    expect(screen.getByRole('button', { name: 'blog posts' })).toBeInTheDocument();
  });
});

describe('When', () => {
  it('reads a stored single rule as its pick, with its number inline', async () => {
    setup(simple); await section('When does it open?');
    expect(pick('When does it open?', /After 15 seconds/)).toBeChecked();
    expect(screen.getByRole('spinbutton', { name: 'Seconds before it opens' })).toHaveValue(15);
  });

  it('edits the inline number without replacing the rule', async () => {
    setup(simple); await section('When does it open?');
    const before = draft().display_rules!.opening;
    const field = screen.getByRole('spinbutton', { name: 'Seconds before it opens' });
    await userEvent.clear(field);
    await userEvent.type(field, '40');
    const after = draft().display_rules!.opening;
    expect(after).toMatchObject({ mode: 'automatic', rules: [{ type: 'time_on_page', seconds: 40 }] });
    if (before.mode === 'automatic' && after.mode === 'automatic') expect(after.rules[0].id).toBe(before.rules[0].id);
    expect(screen.getByRole('button', { name: 'after 40 seconds' })).toBeInTheDocument();
  });

  it('flags a number out of range and still writes it, so Readiness can block it', async () => {
    setup(simple); await section('When does it open?');
    const field = screen.getByRole('spinbutton', { name: 'Seconds before it opens' });
    await userEvent.clear(field);
    await userEvent.type(field, '5000');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a number from 1 to 3600.');
    expect(within(menu()).getByRole('button', { name: /When does it open/ })).toHaveTextContent('Needs attention');
  });

  it('switches to a pick that stores its number under the same key, carrying the number', async () => {
    setup({ ...simple, display_rules: displayPlan([{ type: 'time_on_page', seconds: 42 }]) }); await section('When does it open?');
    expect(pick('When does it open?', /When they pause for 42 s/)).toBeInTheDocument();
    await userEvent.click(pick('When does it open?', /When they pause/));
    expect(draft().display_rules!.opening).toMatchObject({ rules: [{ type: 'inactivity', seconds: 42 }] });
    await userEvent.click(pick('When does it open?', /Scrolled/));
    expect(draft().display_rules!.opening).toMatchObject({ rules: [{ type: 'scroll_depth', percent: 50 }] });
  });

  it('reads two rules as Custom, and keeps the match across sections', async () => {
    setup(); await section('When does it open?');
    expect(pick('When does it open?', 'Custom…')).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Must match every rule' }));
    await section('Where does it show?'); await section('When does it open?');
    expect(screen.getByRole('radio', { name: 'Must match every rule' })).toBeChecked();
    expect(draft().display_rules!.opening).toMatchObject({ match: 'all', rules: [{ type: 'time_on_page', seconds: 20 }, { type: 'scroll_depth', percent: 50 }] });
  });

  it('keeps automatic rules when Custom briefly switches to Right away', async () => {
    setup(); await section('When does it open?');
    await userEvent.click(within(screen.getByRole('group', { name: 'Opens' })).getByRole('radio', { name: 'Right away' }));
    expect(draft().display_rules!.opening).toEqual({ mode: 'immediate' });
    // Custom is still chosen while the section is open, even though the value now matches a pick.
    await userEvent.click(within(screen.getByRole('group', { name: 'Opens' })).getByRole('radio', { name: 'After something they do' }));
    expect(draft().display_rules!.opening).toEqual(initial.display_rules!.opening);
  });

  it('never offers automatic rules in click mode', async () => {
    setup(); await section('When does it open?');
    await userEvent.click(within(screen.getByRole('group', { name: 'Opens' })).getByRole('radio', { name: 'When they click' }));
    expect(screen.getByText(/Point to the button or link with an ID, class, tag or attribute selector/)).toBeVisible();
    expect(document.querySelector('.wconvert-display-editor details:not(.wconvert-disclosure)')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Add a rule' }));
    const picker = screen.getByRole('dialog', { name: 'Choose a rule' });
    expect(within(picker).getByRole('button', { name: 'click_element' })).toBeInTheDocument();
    expect(within(picker).queryByText('time_on_page')).toBeNull();
  });

  it('writes a click selector from inside its chip', async () => {
    setup(simple); await section('When does it open?');
    await userEvent.click(pick('When does it open?', /On a button click/));
    expect(screen.getByText(/Choose the button or link they click/)).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'CSS selector of the button or link' }), '.offer');
    expect(draft().display_rules!.opening).toMatchObject({ mode: 'click', rules: [{ type: 'click_element', selector: '.offer' }] });
  });

  it('hides the Pro picks on a free install', async () => {
    asTier('free');
    setup(simple, { pro: 'locked', elite: 'locked' }); await section('When does it open?');
    expect(within(picks('When does it open?')).queryByRole('radio', { name: /try to leave/ })).toBeNull();
    expect(within(picks('When does it open?')).queryByRole('radio', { name: /click/ })).toBeNull();
    expect(screen.queryByText('Pro')).toBeNull();
  });

  it('draws a locked pick on a lower tier, and refuses it with a reason', async () => {
    asTier('basic');
    const changed = setup(simple, { pro: 'locked' }); await section('When does it open?');
    const leave = pick('When does it open?', /When they try to leave/);
    expect(leave).toHaveAttribute('aria-disabled', 'true');
    expect(leave.closest('label')).toHaveTextContent('Pro');
    await userEvent.click(leave);
    expect(changed).not.toHaveBeenCalled();
    expect(pick('When does it open?', /After 15 seconds/)).toBeChecked();
    expect(document.querySelector('.wconvert-quick-picks__reason')).toHaveTextContent('“When they try to leave” is part of WConvert Pro. Compare plans');
    expect(screen.getByRole('link', { name: 'Compare plans' })).toHaveAttribute('href', 'https://wconvert.io/pro/');
    expect(leave).toHaveAccessibleDescription('“When they try to leave” is part of WConvert Pro. Compare plans');
  });

  it('reads a stored rule this tier cannot run as Custom, so its row explains it', async () => {
    asTier('basic');
    setup({ ...simple, display_rules: displayPlan([{ type: 'exit_intent' }]) }, { pro: 'locked' }); await section('When does it open?');
    expect(pick('When does it open?', 'Custom…')).toBeChecked();
  });

  it('explains missing premium capability in the rule picker without offering a disabled rule', async () => {
    asTier('basic');
    setup(initial, { pro: 'locked' }); await section('When does it open?');
    await userEvent.click(screen.getByRole('button', { name: 'Add a rule' }));
    const picker = screen.getByRole('dialog', { name: 'Choose a rule' });
    expect(within(picker).getByText('exit_intent')).toBeInTheDocument();
    expect(within(picker).queryByRole('button', { name: 'exit_intent' })).toBeNull();
  });
});

describe('When, beside automatic placement or a content lock', () => {
  const rightAway: DisplayRulesValue = { ...simple, display_rules: displayPlan([{ type: 'page_load' }]) };
  const placed = { placement: { summary: 'Automatically after content', controls: null, opensRightAway: true } };
  const reason = /opens right away\./;

  it('holds Right away: every other pick is refused before the click, with the reason', async () => {
    const changed = setup(rightAway, {}, false, placed); await section('When does it open?');
    expect(pick('When does it open?', 'Right away')).toBeChecked();
    expect(pick('When does it open?', 'Right away')).not.toHaveAttribute('aria-disabled');
    expect(screen.getByText(reason)).toBeVisible();
    for (const other of [/After 15 seconds/, /Scrolled/, /When they try to leave/, 'Custom…']) {
      expect(pick('When does it open?', other)).toHaveAttribute('aria-disabled', 'true');
      expect(pick('When does it open?', other)).toHaveAccessibleDescription(reason);
    }
    await userEvent.click(pick('When does it open?', /After 15 seconds/));
    await userEvent.click(pick('When does it open?', 'Custom…'));
    expect(changed).not.toHaveBeenCalled();
    expect(pick('When does it open?', 'Right away')).toBeChecked();
    expect(screen.queryByRole('group', { name: 'Opens' })).toBeNull();
  });

  it('still lets a draft that opens later return to Right away, as a normal undoable edit', async () => {
    const changed = setup(simple, {}, false, placed); await section('When does it open?');
    expect(pick('When does it open?', /After 15 seconds/)).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(pick('When does it open?', 'Right away'));
    expect(changed).toHaveBeenCalledWith({ display_rules: expect.objectContaining({ opening: { mode: 'immediate' } }) });
    await userEvent.click(screen.getByRole('button', { name: 'Undo everything' }));
    expect(draft().display_rules!.opening).toEqual(simple.display_rules!.opening);
  });

  it('refuses the other modes under Custom too, pointing at the same reason', async () => {
    const changed = setup(initial, {}, false, placed); await section('When does it open?');
    const modes = screen.getByRole('group', { name: 'Opens' });
    for (const mode of ['After something they do', 'When they click']) {
      expect(within(modes).getByRole('radio', { name: mode })).toHaveAttribute('aria-disabled', 'true');
      expect(within(modes).getByRole('radio', { name: mode })).toHaveAccessibleDescription(reason);
    }
    await userEvent.click(within(modes).getByRole('radio', { name: 'Right away' }));
    expect(draft().display_rules!.opening).toEqual({ mode: 'immediate' });
    changed.mockClear();
    await userEvent.click(within(screen.getByRole('group', { name: 'Opens' })).getByRole('radio', { name: 'After something they do' }));
    expect(changed).not.toHaveBeenCalled();
    expect(draft().display_rules!.opening).toEqual({ mode: 'immediate' });
  });

  it('holds nothing for manual placement', async () => {
    setup(simple, {}, false, { placement: { summary: 'Manual', controls: null } }); await section('When does it open?');
    expect(pick('When does it open?', /When they try to leave/)).not.toHaveAttribute('aria-disabled');
    expect(screen.queryByText(reason)).toBeNull();
  });
});

describe('the rule rows', () => {
  it('names what each Remove takes away, and keeps the sentence out of a live region', async () => {
    setup(); await section('When does it open?');
    expect(screen.getByRole('button', { name: 'Remove time_on_page' })).toHaveTextContent('Remove');
    expect(screen.getByRole('button', { name: 'Remove scroll_depth' })).toBeInTheDocument();
    expect(document.querySelector('.wconvert-display-sentence')).not.toHaveAttribute('aria-live');
  });
});

describe('Who', () => {
  it('writes a pick as one group, and opens it in Custom', async () => {
    setup(simple); await section('Who sees it?');
    await userEvent.click(pick('Who sees it?', 'Phones only'));
    expect(draft().display_rules!.audience).toMatchObject({ mode: 'groups', groups: [{ match: 'all', rules: [{ type: 'device', in: ['mobile'], id: expect.any(String) }] }] });
    await userEvent.click(pick('Who sees it?', 'Custom…'));
    expect(screen.getByRole('heading', { name: 'Visitors who…' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'device' })).toBeInTheDocument();
  });

  it('adds a different group of visitors on demand, joined by “or”', async () => {
    setup(simple); await section('Who sees it?');
    await userEvent.click(pick('Who sees it?', 'Custom…'));
    expect(draft().display_rules!.audience).toMatchObject({ mode: 'groups', groups: [{ rules: [] }] });
    await userEvent.click(screen.getByRole('button', { name: '+ Or a different group of visitors' }));
    const audience = draft().display_rules!.audience;
    expect(audience.mode === 'groups' && audience.groups.length).toBe(2);
    expect(screen.getByText('or')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Visitors who…' })).toHaveLength(2);
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
    expect(screen.getAllByRole('heading', { name: 'Visitors who…' })).toHaveLength(1);
  });

  it('offers account facts in the same audience rule picker as browser facts', async () => {
    setup(simple); await section('Who sees it?'); await userEvent.click(pick('Who sees it?', 'Custom…'));
    await userEvent.click(screen.getByRole('button', { name: 'Add a rule' }));
    const picker = screen.getByRole('dialog', { name: 'Choose a rule' });
    expect(within(picker).getByRole('button', { name: 'role' })).toBeInTheDocument();
    await userEvent.click(within(picker).getByRole('button', { name: 'logged_in' }));
    expect(draft().targeting).toEqual({});
    expect(draft().display_rules!.audience).toMatchObject({ mode: 'groups', groups: [{ rules: [{ type: 'logged_in', id: expect.any(String) }] }] });
  });

  it('keeps a UTM shortcut selected while filling its values', async () => {
    setup(simple); await section('Who sees it?'); await userEvent.click(pick('Who sees it?', 'Custom…'));
    await userEvent.click(screen.getByRole('button', { name: 'Add a rule' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Choose a rule' })).getByRole('button', { name: 'utm_campaign' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Add a value for value' }), 'newsletter');
    expect(screen.getByRole('combobox', { name: 'query_param' })).toHaveValue('utm_campaign');
    expect(draft().display_rules!.audience).toMatchObject({ groups: [{ rules: [{ type: 'query_param', key: 'utm_campaign', value: ['newsletter'] }] }] });
  });

  it('names WooCommerce when the cart pick cannot run here', async () => {
    asTier('elite');
    const changed = setup(simple, { elite: 'unavailable' }); await section('Who sees it?');
    const cart = pick('Who sees it?', /Shoppers with items in their cart/);
    expect(cart.closest('label')).toHaveTextContent('Needs WooCommerce');
    await userEvent.click(cart);
    expect(changed).not.toHaveBeenCalled();
    expect(screen.getByText('“Shoppers with items in their cart” needs the WooCommerce plugin on this site.')).toBeInTheDocument();
  });

  it('keeps the goal’s audience requirement above the picks', async () => {
    setup(simple, {}, false, { audienceRequirement: 'This goal needs shoppers.' }); await section('Who sees it?');
    expect(screen.getByRole('note')).toHaveTextContent('This goal needs shoppers.');
  });
});

describe('How often', () => {
  it('changes only the pacing, never the stops or the total', async () => {
    setup({ ...initial, frequency: { maxPerSession: 3, cooldownDays: 4, maxImpressions: 9, stopAfterDismiss: false, stopAfterConversion: false } });
    await section('How often?');
    expect(pick('How often?', 'Custom…')).toBeChecked();
    expect(screen.getByRole('spinbutton', { name: 'Times per visit' })).toHaveValue(3);
    await userEvent.click(pick('How often?', /Once every/));
    expect(draft().frequency).toEqual({ cooldownDays: 7, maxImpressions: 9, stopAfterDismiss: false, stopAfterConversion: false });
    const days = screen.getByRole('spinbutton', { name: 'Days between showings' });
    await userEvent.clear(days);
    await userEvent.type(days, '12');
    expect(draft().frequency.cooldownDays).toBe(12);
    await userEvent.click(pick('How often?', /^Once per visit/));
    expect(draft().frequency).toEqual({ maxPerSession: 1, maxImpressions: 9, stopAfterDismiss: false, stopAfterConversion: false });
    expect(screen.getByText('A visit ends when they close the tab.')).toBeInTheDocument();
  });

  it('keeps Custom chosen while its fields match a pick, until the section is opened again', async () => {
    setup({ ...initial, frequency: {} }); await section('How often?');
    await userEvent.click(pick('How often?', 'Custom…'));
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Times per visit' }), '1');
    expect(pick('How often?', 'Custom…')).toBeChecked();
    await section('Dates'); await section('How often?');
    expect(pick('How often?', /^Once per visit/)).toBeChecked();
  });

  it('re-derives the pick when the value changes from outside, as an undo does', async () => {
    setup({ ...initial, frequency: {} }); await section('How often?');
    await userEvent.click(pick('How often?', 'Custom…'));
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Times per visit' }), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Undo everything' }));
    expect(pick('How often?', 'Every page they see')).toBeChecked();
  });

  it('draws the stops as one card and says when closing outlasts the visit', async () => {
    setup(); await section('How often?');
    const stops = screen.getByRole('group', { name: 'Stop showing it…' });
    await userEvent.click(within(stops).getByRole('checkbox', { name: 'after they close it' }));
    expect(screen.getByText('Closing it stops it for good, not just for this visit.')).toBeInTheDocument();
    await userEvent.click(within(stops).getByRole('checkbox', { name: /after it has shown/ }));
    expect(draft().frequency).toMatchObject({ maxPerSession: 1, maxImpressions: 3 });
  });

  it('reads the stop as the main button for a click design', async () => {
    setup(initial, {}, false, { act: 'click' }); await section('How often?');
    expect(screen.getByRole('checkbox', { name: 'after they click the main button' })).toBeChecked();
  });

  it('keeps priority in a card that names its value while closed', async () => {
    setup({ ...initial, priority: 4 }); await section('How often?');
    expect(screen.getByText('If several popups are ready at once').closest('summary')).toHaveTextContent('Priority 4');
  });
});

describe('Dates', () => {
  it('reveals saved dates without changing them during navigation', async () => {
    const schedule = { starts_at: '2027-05-01 09:00', ends_at: '2027-05-07 18:00' };
    const changed = setup({ ...initial, schedule });
    await section('Dates');
    expect(pick('Dates', 'Between two dates')).toBeChecked();
    expect(screen.getByLabelText('Start showing it on')).toHaveValue('2027-05-01T09:00');
    await section('Where does it show?'); await section('Dates');
    expect(draft().schedule).toEqual(schedule);
    expect(changed).not.toHaveBeenCalled();
    await userEvent.click(pick('Dates', 'Until you unpublish it'));
    expect(draft().schedule).toEqual({});
  });

  it('opens Between two dates with the end field focused when a reveal asks for it', async () => {
    setup(initial, {}, false, { reveal: { id: 'dates', focus: 'wconvert-ends-at' } });
    expect(pick('Dates', 'Between two dates')).toBeChecked();
    await vi.waitFor(() => expect(screen.getByLabelText('Stop showing it on')).toHaveFocus());
  });
});

// HTTP WordPress installs expose getRandomValues, but not secure-context-only randomUUID.
describe('display editing without crypto.randomUUID', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('creates a pick’s group and a second group with distinct ids', async () => {
    setup(simple); await section('Who sees it?');
    await userEvent.click(pick('Who sees it?', 'Signed-in visitors'));
    await userEvent.click(pick('Who sees it?', 'Custom…'));
    await userEvent.click(screen.getByRole('button', { name: '+ Or a different group of visitors' }));
    const audience = draft().display_rules!.audience;
    if (audience.mode !== 'groups') throw new Error('Expected groups');
    expect(audience.groups).toHaveLength(2);
    expect(new Set(audience.groups.map(group => group.id)).size).toBe(2);
  });

  it('adds a custom opening rule with a stable ID and closes the picker', async () => {
    setup(); await section('When does it open?');
    await userEvent.click(screen.getByRole('button', { name: 'Add a rule' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Choose a rule' })).getByRole('button', { name: 'exit_intent' }));
    expect(screen.queryByRole('dialog', { name: 'Choose a rule' })).toBeNull();
    const opening = draft().display_rules!.opening;
    if (opening.mode === 'immediate') throw new Error('Expected automatic opening');
    expect(opening.rules).toHaveLength(3);
    expect(opening.rules[2]).toMatchObject({ type: 'exit_intent', id: expect.any(String) });
    expect(new Set(opening.rules.map(rule => rule.id)).size).toBe(3);
    await section('Where does it show?'); await section('When does it open?');
    expect(draft().display_rules!.opening).toEqual(opening);
  });
});

it('uses the same editors in the journey panel, with a select for the five questions', async () => {
  setup(initial, {}, true);
  const user = userEvent.setup();
  expect(screen.queryByRole('navigation', { name: 'Display rules' })).not.toBeInTheDocument();
  expect(within(screen.getByRole('combobox', { name: 'Display setting' })).getAllByRole('option')).toHaveLength(5);
  expect(screen.getByRole('button', { name: 'Test a visit' })).toBeInTheDocument();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Display setting' }), 'when');
  await user.click(screen.getByRole('radio', { name: 'Must match every rule' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Display setting' }), 'where');
  await user.click(screen.getByRole('radio', { name: 'Selected pages' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Display setting' }), 'when');
  expect(screen.getByRole('radio', { name: 'Must match every rule' })).toBeChecked();
  expect(draft().targeting.mode).toBe('selected');
  expect(draft().display_rules!.opening).toMatchObject({ match: 'all', rules: [{ type: 'time_on_page', seconds: 20 }, { type: 'scroll_depth', percent: 50 }] });
});

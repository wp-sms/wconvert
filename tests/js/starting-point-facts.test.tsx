import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TemplateTree } from '@renderer/types';
import { treeFixture } from './support/journey';
import { CLICK_OUTCOME } from './support/outcomes';
import { StartingPointFacts } from '../../resources/admin/src/goals/StartingPointFacts';
import { resultLinksToChoose } from '../../resources/admin/src/builder/structure/journey';
import type { GoalEntry, PlaybookEntry } from '../../resources/admin/src/goals/api';

/**
 * Pro quiz setups ship result buttons with no link on purpose (ADRs 0081,
 * 0082, 0106). The chooser says so before one is picked, not at Publish.
 */
const GOAL: GoalEntry = {
  id: 'promote_offer', label: 'Promote an offer', description: '', outcome: CLICK_OUTCOME,
  headline_kind: 'conversion', headline_label: 'Offer clicks', tier: 'free', availability: 'ready',
};

function quiz(results: { link_label?: string; href?: string }[]): TemplateTree {
  const tree = treeFixture({ steps: [
    { type: 'stack', children: [{ type: 'heading', role: 'headline', text: 'Find a gift' }] },
    { type: 'stack', children: [{ type: 'heading', role: 'headline', text: 'Your pick' }] },
  ] });
  return { ...tree, steps: tree.steps.map((screen, at) => at === 1
    ? { ...screen, kind: 'result', results: results.map((result, i) => ({ id: `r${i}`, heading: `Result ${i}`, ...result })) }
    : screen) };
}

function playbook(tree: TemplateTree): PlaybookEntry {
  return { id: 'gift', name: 'Gift finder', goal: 'promote_offer', template_id: 'gift-edit', display_type: 'popup',
    rules: [], targeting: {}, destination_hint: {}, notes: '', template: { tokens: {}, tree } } as PlaybookEntry;
}

describe('result links still to choose', () => {
  it('counts results with a link label and no address', () => {
    expect(resultLinksToChoose(quiz([
      { link_label: 'Shop', href: '' }, { link_label: 'Shop' }, { link_label: 'Shop', href: '/gifts/' }, {}, { link_label: ' ', href: '' },
    ]))).toBe(2);
  });

  it('warns on a quiz setup before it is picked', () => {
    render(<StartingPointFacts goal={GOAL} vocabulary={null}
      playbook={playbook(quiz(Array.from({ length: 5 }, () => ({ link_label: 'Shop these', href: '' }))))} />);
    expect(screen.getByText('A link for each of its 5 results')).toBeInTheDocument();
  });

  it('says nothing on a setup without result screens', () => {
    render(<StartingPointFacts goal={GOAL} vocabulary={null} playbook={playbook(treeFixture({ steps: [
      { type: 'stack', children: [{ type: 'button', role: 'cta_label', label: 'Shop', action: 'link', href: '' }] },
    ] }))} />);
    expect(screen.queryByText(/A link for/)).toBeNull();
  });
});

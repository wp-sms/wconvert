import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Template } from '@renderer/types';
import { treeFixture } from './support/journey';
import { CLICK_OUTCOME } from './support/outcomes';
import { countsNothing, fitsOutcome, outcomeDesignIssue, type OutcomeContract } from '../../resources/admin/src/goals/outcome';
import { removalRefusal } from '../../resources/admin/src/builder/structure/guards';
import { problemsIn } from '../../resources/admin/src/builder/structure/problems';
import { howOftenSummary } from '../../resources/admin/src/builder/rules/sentence';
import { factAct } from '../../resources/admin/src/optins/campaignFacts';
import { rowResultOf, shownLine } from '../../resources/admin/src/optins/rowResult';
import type { GoalReport, OptinReport } from '../../resources/admin/src/stats/api';

/** Show a message: one content screen offering no act, reporting appearances only (ADR 0163). */
const MESSAGE: OutcomeContract = {
  action: 'none', capture_any_of: [], requirement: 'Shows a message. Remove the form and any counted button, or choose Promote an offer.',
  measurement: 'Counts appearances only.', proof_level: 'shown', destination_type: null, link_required: false, audience_channel: null,
};

const design = (id: string): Template => JSON.parse(readFileSync(resolve(import.meta.dirname, `../../resources/templates/library/${id}.json`), 'utf8'));
const words = { type: 'heading', text: 'Free shipping all weekend' };
const link = { type: 'button', action: 'link', label: 'Shop now', href: 'https://example.org/shop' };
const notice = (...children: unknown[]): Template => ({ tokens: {}, tree: treeFixture({ steps: [{ type: 'stack', children }] }) } as unknown as Template);

describe('a message under its Goal', () => {
  it('fits one content screen with nothing to count, and nothing else', () => {
    expect(outcomeDesignIssue(MESSAGE, notice(words))).toBeNull();
    expect(outcomeDesignIssue(MESSAGE, notice(words, link))).toBe(MESSAGE.requirement);
    expect(outcomeDesignIssue(MESSAGE, design('stacked-signup'))).toBe(MESSAGE.requirement);
    expect(outcomeDesignIssue(CLICK_OUTCOME, notice(words))).toBe(CLICK_OUTCOME.requirement);
    expect(fitsOutcome(MESSAGE, { act: null, captures: [] })).toBe(true);
    expect(fitsOutcome(MESSAGE, { act: 'click', captures: [] })).toBe(false);
  });

  it('lets the counted link go without calling it a hole, but only under that Goal', () => {
    const tree = notice(words, link).tree;
    const button = [0, 'children', 1] as const;
    expect(removalRefusal(tree, [...button])?.short).toBe('It counts the conversion');
    expect(removalRefusal(tree, [...button], true)).toBeNull();
    const bare = notice(words);
    expect(problemsIn(bare, undefined).map(problem => problem.check)).toContain('converts');
    expect(problemsIn(bare, undefined, true).map(problem => problem.check)).not.toContain('converts');
  });

  it('says what a visitor does, and never that a visitor can stop it by converting', () => {
    expect(factAct(notice(words), MESSAGE)).toBe('none');
    expect(factAct(notice(words), CLICK_OUTCOME)).toBeUndefined();
    expect(factAct(notice(words, link), MESSAGE)).toBe('click');
    expect(howOftenSummary({}, 0, true, null).text).toBe('Every time, until they close it');
    expect(countsNothing(MESSAGE)).toBe(true);
    expect(countsNothing(CLICK_OUTCOME)).toBe(false);
    expect(countsNothing(undefined)).toBe(false);
  });

  it('reports its appearances with no rate', () => {
    const row = { id: 'm', impressions: 400, conversions: 0, conversion_rate: null } as unknown as OptinReport;
    const message = rowResultOf({ action: 'none', result_label: 'Appearances' } as GoalReport, row);
    expect(message).toMatchObject({ count: 400, shown: 400, rate: null, counted: false, capture: false });
    expect(shownLine(message)).toBe('Rate not counted');
    const offer = rowResultOf({ action: 'click', result_label: 'Link clicks' } as GoalReport, { ...row, conversions: 20, conversion_rate: 0.05 });
    expect(offer).toMatchObject({ count: 20, counted: true });
    expect(shownLine(offer)).toBe('5% of 400 shown');
  });
});

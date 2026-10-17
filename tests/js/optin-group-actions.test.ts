import { describe, expect, it } from 'vitest';
import type { OptinSummary } from '../../resources/admin/src/optins/api';
import { groupConfirmCopy, plan, reduceResult, resultSentence, startResult } from '../../resources/admin/src/optins/groupActions';

/**
 * Which ticked campaigns a group action runs on, and the one line that says
 * what happened (#278). The server refuses none of these skips, so this is
 * where they are decided.
 */
const row = (name: string, extra: Partial<OptinSummary> = {}): OptinSummary => ({
  id: `01JQ0000000000000000000${name.slice(0, 3).toUpperCase()}`,
  name,
  goal: 'grow_email_list',
  parent_id: null,
  published_at: null,
  has_unpublished_changes: false,
  deleted_at: null,
  suspended: null,
  arms: [],
  ...extra,
} as OptinSummary);

const draft = row('Draft');
const live = row('Live', { published_at: '2026-10-01 00:00:00' });
const edited = row('Edited', { published_at: '2026-10-01 00:00:00', has_unpublished_changes: true });
const suspended = row('Suspended', { published_at: '2026-10-01 00:00:00', suspended: 'Needs WooCommerce' });
const test = row('Test', { arms: [row('Arm', { parent_id: '01JQ0000000000000000000TES' })] });
const variant = row('Variant', { parent_id: '01JQ0000000000000000000TES' });
const bare = row('Bare');
const noDesign = (r: OptinSummary) => r === bare;

const names = (rows: readonly OptinSummary[]) => rows.map((r) => r.name);
const reasons = (p: ReturnType<typeof plan>) => p.skipped.map(({ row: r, reason }) => [r.name, reason]);

describe('plan', () => {
  it('publishes drafts and unpublished edits, and nothing already current', () => {
    const p = plan('publish', [draft, live, edited, suspended, test, variant, bare], noDesign);
    expect(names(p.run)).toEqual(['Draft', 'Edited']);
    expect(reasons(p)).toEqual([
      ['Live', 'current'], ['Suspended', 'suspended'], ['Test', 'test'], ['Variant', 'variant'], ['Bare', 'no_design'],
    ]);
  });

  it('unpublishes what is published, suspended included, and leaves drafts and tests', () => {
    const p = plan('pause', [draft, live, suspended, test, variant], noDesign);
    expect(names(p.run)).toEqual(['Live', 'Suspended']);
    expect(reasons(p)).toEqual([['Draft', 'draft'], ['Test', 'test'], ['Variant', 'variant']]);
  });

  it('duplicates any campaign, a test parent and one with no design included, but never a variant', () => {
    const p = plan('duplicate', [draft, test, bare, variant], noDesign);
    expect(names(p.run)).toEqual(['Draft', 'Test', 'Bare']);
    expect(reasons(p)).toEqual([['Variant', 'variant']]);
  });

  it('deletes any campaign whatever its status or design, but leaves tests and variants', () => {
    const p = plan('delete', [draft, live, suspended, bare, test, variant], noDesign);
    expect(names(p.run)).toEqual(['Draft', 'Live', 'Suspended', 'Bare']);
    expect(reasons(p)).toEqual([['Test', 'test'], ['Variant', 'variant']]);
  });
});

describe('group delete', () => {
  it('asks counted, says what survives and names what is left alone', () => {
    const words = groupConfirmCopy('delete', plan('delete', [draft, live, test], noDesign));
    expect(words.title).toBe('Delete 2 campaigns?');
    expect(words.description).toBe('They stop showing and leave this list. Their leads and results are kept. 1 will be skipped (A/B test: Test).');
    expect(words.confirmLabel).toBe('Delete 2 campaigns');
  });

  it('says how many went', () => {
    expect(resultSentence(reduceResult(startResult('delete', []), { type: 'done', row: draft }))).toBe('Deleted 1.');
  });
});

describe('the result', () => {
  it('counts what ran, names what was skipped and counts what failed', () => {
    const p = plan('publish', [draft, edited, suspended, test], noDesign);
    let result = startResult('publish', p.skipped);
    result = reduceResult(result, { type: 'done', row: draft });
    result = reduceResult(result, { type: 'failed', row: edited, message: 'Server busy' });

    expect(result.done).toEqual([draft]);
    expect(result.failed).toEqual([{ row: edited, message: 'Server busy' }]);
    expect(resultSentence(result)).toBe('Published 1. Skipped 2 (Suspended: Suspended; A/B test: Test). 1 failed.');
  });

  it('groups the skipped rows by reason', () => {
    const other = row('Other', { published_at: '2026-10-01 00:00:00', suspended: 'Needs WooCommerce' });
    const result = startResult('publish', plan('publish', [suspended, other], noDesign).skipped);
    expect(resultSentence(result)).toBe('Published 0. Skipped 2 (Suspended: Suspended, Other).');
  });

  it('says only what happened when nothing was skipped or failed', () => {
    const result = reduceResult(startResult('pause', []), { type: 'done', row: live });
    expect(resultSentence(result)).toBe('Unpublished 1.');
    expect(resultSentence(reduceResult(startResult('duplicate', []), { type: 'done', row: draft }))).toBe('Copied 1 as a draft.');
  });
});

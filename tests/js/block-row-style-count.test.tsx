import { render } from '@testing-library/react';
import LABELS_FIXTURE from '../fixtures/template-labels.json';
import { describe, expect, it, vi } from 'vitest';
import { BlockRow } from '../../resources/admin/src/builder/BlockRow';
import type { Block } from '../../resources/admin/src/builder/structure/tree';
import type { TemplateLabels } from '../../resources/admin/src/templates/api';

/** The chip's tooltip counts a block's style settings in real words, never "style(s)". */
function tooltipFor(sets: number, setsNarrow: number): string | null {
  const block = {
    path: [0, 'children', 0],
    type: 'stack',
    leaf: false,
    level: 2,
    position: 1,
    setSize: 1,
    pane: 'children',
    role: null,
    captures: null,
    at: 1,
    action: null,
    hidden: false,
    sets,
    setsNarrow,
    says: null,
    holds: 0,
    holder: false,
  } as unknown as Block;
  const { container } = render(
    <div role="treegrid">
      <BlockRow
        block={block}
        labels={LABELS_FIXTURE as unknown as TemplateLabels}
        focused={null}
        takeFocus={false}
        selected={false}
        expanded={null}
        onExpand={vi.fn()}
        onSelect={vi.fn()}
        onFocusControl={vi.fn()}
      />
    </div>,
  );
  return container.querySelector('.wconvert-block__chip--sets')?.getAttribute('title') ?? null;
}

describe('the style count on a block row', () => {
  it('reads as one style', () => {
    expect(tooltipFor(1, 0)).toBe('1 style for this block and its contents.');
  });

  it('reads as several styles', () => {
    expect(tooltipFor(2, 0)).toBe('2 styles for this block and its contents.');
  });

  it('adds the narrow styles and still counts the first number', () => {
    expect(tooltipFor(1, 1)).toBe('1 style for this block and its contents, plus 1 when narrow.');
    expect(tooltipFor(2, 1)).toBe('2 styles for this block and its contents, plus 1 when narrow.');
  });

  it('shows no chip when the block sets nothing', () => {
    expect(tooltipFor(0, 0)).toBeNull();
  });
});

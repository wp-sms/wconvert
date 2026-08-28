import { __ } from '@wordpress/i18n';
import { Blocks } from 'lucide-react';
import { EmptyState } from '../shell/EmptyState';
import { BlockTree } from './BlockTree';
import type { Path } from './panel';
import type { SlotKey } from './slots';
import type { TemplateLabels } from '../templates/api';
import type { Template } from '@renderer/types';

/**
 * The **Structure** tab: what this design is made of, and where each part sits.
 *
 * ============================================================================
 * IT IS A SECOND VIEW OF ONE DOCUMENT, NOT A SECOND DOCUMENT.
 * ============================================================================
 * Content and Structure edit the same `template`. Content answers *what does
 * this say*; Structure answers *what is here and in what order*. Splitting them
 * is what keeps the Content tab a readable column of words rather than a column
 * of words interleaved with move buttons — and it is why both stay: a merchant
 * fixing a typo should never have to walk past an arrangement control to reach
 * the sentence.
 *
 * They therefore coexist permanently. Structure is not a mode Content is
 * eventually replaced by.
 *
 * ============================================================================
 * THE PREVIEW IS NOT IN HERE. IT IS THE SCREEN'S (ADR 0040).
 * ============================================================================
 * It is pinned beside every tab, which is exactly the mistake the settings
 * panel made before #69 and exactly the one this must not repeat: a second
 * preview drawn inside this tab would be a second render of the same tree,
 * disagreeing with the first one the moment either got a keystroke ahead.
 *
 * Selection travels between the two on the same one string ADR 0040 built —
 * `role:headline`, `captures:email` — so clicking a block here outlines it over
 * there, and clicking it over there highlights the row here.
 */

export interface StructureViewProps {
  readonly template: Template;
  readonly labels: TemplateLabels;
  readonly selected: SlotKey | null;
  readonly onSelect: (key: SlotKey | null, path: Path) => void;
}

export function StructureView({ template, labels, selected, onSelect }: StructureViewProps) {
  if (template.tree.steps.length === 0) {
    return (
      <EmptyState icon={Blocks} title={__('This design has nothing in it yet.', 'wconvert')}>
        {__('Pick a design on the Design tab and its blocks will be listed here.', 'wconvert')}
      </EmptyState>
    );
  }

  return (
    <div className="wconvert-structure">
      {/*
        **One sentence, above the tree rather than inside it.** The keys are
        the ones Gutenberg's List View already uses, so this is a reminder for
        a merchant who has met them rather than an instruction manual for one
        who has not — and it is visible text rather than a `title`, which no
        keyboard reaches.
      */}
      <p className="m-0 text-pretty text-muted-foreground">
        {__(
          'Click a block to see it highlighted in the preview. Use the arrow keys to move through the list.',
          'wconvert',
        )}
      </p>

      <BlockTree tree={template.tree} labels={labels} selected={selected} onSelect={onSelect} />
    </div>
  );
}

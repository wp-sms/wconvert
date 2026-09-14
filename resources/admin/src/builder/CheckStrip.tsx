import { __ } from '@wordpress/i18n';
import { Check, TriangleAlert } from 'lucide-react';
import { CHECKS, CHECK_SOURCES, type CheckId, type Problem } from './structure/problems';
import type { Path } from './panel';

/**
 * What was checked, and which of it passed — beside the design being changed.
 *
 * ============================================================================
 * THE VERDICT SAYS WHAT IS WRONG. THIS SAYS WHAT WAS LOOKED AT.
 * ============================================================================
 * {@see ReadinessPanel} reads out the problems, above the tab strip, which is
 * the right shape for a merchant about to publish. It is the wrong shape while
 * somebody is RESTYLING: a screen that says nothing has either checked six
 * things and liked them or checked nothing, and those are indistinguishable —
 * which is ADR 0042 rule 3 read backwards, and it is exactly the state a scoped
 * token bag puts a merchant in. A box repainted in one press can fail AA for a
 * visitor without moving a single number on the Design panel.
 *
 * So the strip names its own sources: one chip per check, drawn whether it
 * passed or not, and the failing one carries the sentence `problemsIn` already
 * computed. **Nothing new is derived here** — the same six checks, the same
 * words, the same route to the block. What is new is that they are countable,
 * so silence is legible as *six checks pass* rather than as nothing happening.
 *
 * A failing chip is a button and goes to the block, exactly as the verdict's
 * sentence does; a passing one is not, because there is nothing to go to.
 */
export function CheckStrip({
  problems,
  onGoTo,
}: {
  problems: readonly Problem[];
  /** Open the block a check is about — the verdict's own route, shared. */
  onGoTo: (path: Path) => void;
}) {
  return (
    <ul className="wconvert-checks" aria-label={__('Checks on this design', 'wconvert')}>
      {CHECKS.map((check) => {
        const failed = problems.find((problem) => problem.check === check);
        const Icon = failed === undefined ? Check : TriangleAlert;
        const name = checkName(check);

        return (
          <li key={check}>
            {failed === undefined || failed.path === null ? (
              /*
                Not a button. A passing check has nothing to open, and a
                failing one about the whole design — a contrast pair, a missing
                converting act — has no block to open either. The words are the
                whole of what either can offer, so `title` carries the sentence
                and the chip stays a chip (ADR 0054 rule 1).
              */
              <span
                className="wconvert-checks__chip"
                data-state={failed === undefined ? 'pass' : 'fail'}
                title={said(check, failed?.said)}
              >
                <Icon aria-hidden="true" />
                {name}
                <span className="wconvert-checks__source">{CHECK_SOURCES[check].at}</span>
              </span>
            ) : (
              <button
                type="button"
                className="wconvert-checks__chip"
                data-state="fail"
                title={said(check, failed.said)}
                onClick={() => onGoTo(failed.path as Path)}
              >
                <Icon aria-hidden="true" />
                {name}
                <span className="wconvert-checks__source">{CHECK_SOURCES[check].at}</span>
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The tooltip: what is wrong where something is, and what enforces it always.
 *
 * **The source is in the `title` as well as on the chip**, because the chip
 * shows it small and a merchant reading a failing check wants both sentences in
 * one place. It is the only text on this strip a translator does not touch —
 * see {@link CHECK_SOURCES}.
 */
function said(check: CheckId, wrong: string | undefined): string {
  const { at, how } = CHECK_SOURCES[check];
  const source = `${at} — ${how}`;

  return wrong === undefined ? source : `${wrong}\n\n${source}`;
}

/**
 * What each check is CALLED, in the merchant's words.
 *
 * In the bundle rather than in `TemplateLabels`, which is the same line the
 * token groups are drawn on: a check is a way of arranging one panel — chrome —
 * while a token name or a Slot Role is vocabulary two runtimes agree on. The
 * server computes none of these.
 *
 * Named for what is TRUE when the check passes, so a strip of six ticks reads
 * as six statements rather than as six topics.
 */
function checkName(check: CheckId): string {
  switch (check) {
    case 'converts':
      return __('Counts something', 'wconvert');
    case 'captures':
      return __('The form works', 'wconvert');
    case 'countdown':
      return __('The clock has a date', 'wconvert');
    case 'words':
      return __('Words survive a switch', 'wconvert');
    case 'readable':
      return __('Readable', 'wconvert');
  }
}

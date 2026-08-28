import { __, _n, sprintf } from '@wordpress/i18n';
import { Check, Redo2, TriangleAlert, Undo2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Button } from '../components/ui/button';
import { Toolbar } from '../shell/Toolbar';
import { problemsIn, type Problem } from './structure/problems';
import type { ConvertingAct } from './structure/catalogue';
import type { Path } from './panel';
import type { Template } from '@renderer/types';

/**
 * Undo, Redo and whether this design will actually work — on **both** tabs that
 * edit the design.
 *
 * ============================================================================
 * IT WAS THE CONTENT TAB'S TOOLBAR, AND ITS SCOPE WAS NEVER THE CONTENT TAB.
 * ============================================================================
 * ADR 0039's placement rule is that a control's SCOPE decides where it goes,
 * and all three of these act on the whole draft. {@see OptinBuilder}'s history
 * watches `template`, so a token changed on Design is a full undo entry and so
 * is picking a design — but Undo lived in {@see StructureView}, which is to say
 * on another tab. A merchant who applied a preset and wanted it back had no
 * Undo, because Undo was somewhere else.
 *
 * The verdict has the same mismatch in reverse: the contrast failures it
 * reports are caused by colours chosen on **Design**, and it was only readable
 * from Content.
 *
 * So it is one toolbar whose scope is the design, rendered on the two tabs that
 * edit the design. That is not a new concept — it is the rule applied honestly.
 * It stays out of the page-header band, which ADR 0039 caps at two actions and
 * reserves for what acts on the whole Optin: Save and the name.
 *
 * *(The mismatch predates the Content/Structure merge — Undo shipped on
 * Structure while the tokens were on Content — but the merge moved the tokens
 * to Design and made it the common case.)*
 *
 * **Display rules and Destinations do not get it**, and that is the scope test
 * again rather than an omission: neither edits the design, so neither can
 * produce an entry for Undo to step or a problem for the verdict to report.
 */
export function DesignToolbar({
  template,
  act,
  history,
  onGoTo,
}: {
  readonly template: Template;
  readonly act: ConvertingAct;
  /** Undo and redo, held by the screen because they move the whole draft. */
  readonly history: {
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly undo: () => void;
    readonly redo: () => void;
  };
  /**
   * Open the block a problem is about.
   *
   * The screen owns this rather than the tree, because from the Design tab it
   * also has to CHANGE TABS — a sentence pointing at a block is useless if
   * following it lands on a list the merchant is not looking at.
   */
  readonly onGoTo: (path: Path) => void;
}) {
  return (
    <Toolbar>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!history.canUndo}
        onClick={history.undo}
      >
        <Undo2 aria-hidden="true" />
        {__('Undo', 'wconvert')}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!history.canRedo}
        onClick={history.redo}
      >
        <Redo2 aria-hidden="true" />
        {__('Redo', 'wconvert')}
      </Button>

      <Verdict problems={problemsIn(template, act)} onGoTo={onGoTo} />
    </Toolbar>
  );
}

/**
 * Whether this design will actually work, and what to do about it if not.
 *
 * ============================================================================
 * THE SAVE ALREADY KNOWS. IT JUST TELLS THE MERCHANT TOO LATE.
 * ============================================================================
 * `OptinController` refuses a design with no converting act and one whose act
 * its [[Goal]] cannot report, and it is right to — *"a screen is not an
 * enforcement mechanism"* (ADR 0026). But the merchant meets that refusal as a
 * red bar over an editor that had let them get there, having already done the
 * work. This is the same knowledge, said while it is still cheap to act on.
 *
 * Two of what it reports are not refusals at all and never will be: a block
 * that will lose its words at the next design switch, and a colour pair a
 * visitor cannot read. Both save happily. Nothing else in the product would
 * ever mention either.
 *
 * **In the toolbar, because it is about the whole design** — which is exactly
 * the scope test ADR 0039 gives — and beside Undo, because both are things a
 * merchant reaches for after doing something rather than while doing it.
 */
function Verdict({
  problems,
  onGoTo,
}: {
  problems: readonly Problem[];
  onGoTo: (path: Path) => void;
}) {
  if (problems.length === 0) {
    return (
      <p className="wconvert-verdict wconvert-verdict--good">
        <Check aria-hidden="true" />
        {__('This will work', 'wconvert')}
      </p>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="wconvert-verdict--bad">
          <TriangleAlert aria-hidden="true" />
          {sprintf(
            /* translators: %d: how many things are wrong with the design. */
            _n('%d thing to fix', '%d things to fix', problems.length, 'wconvert'),
            problems.length,
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-w-sm">
        <ul className="wconvert-verdict__list">
          {problems.map((problem) => (
            <li key={problem.said}>
              {/*
                **A sentence, and a way to the block it is about.** A problem
                the merchant cannot navigate to is a problem they have to hunt
                for, and the tree is right there — so where it names a block,
                the sentence is the button that selects it.
              */}
              {problem.path === null ? (
                problem.said
              ) : (
                <button
                  type="button"
                  className="wconvert-verdict__go"
                  onClick={() => onGoTo(problem.path as Path)}
                >
                  {problem.said}
                </button>
              )}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

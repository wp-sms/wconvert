import { __, _n, sprintf } from '@wordpress/i18n';
import { AA_NORMAL, contrastOf } from '../contrast';
import { TOKENS, type Path } from '../panel';
import { formStep, losesWordsOnSwitch, type ConvertingAct } from './catalogue';
import { convertingActOf } from './guards';
import { nodesOf } from './tree';
import type { Template } from '@renderer/types';

/**
 * What is wrong with this design **right now**, as sentences a merchant can act
 * on.
 *
 * ============================================================================
 * THE GUARDS REFUSE ONE ACT. THIS READS THE WHOLE DOCUMENT.
 * ============================================================================
 * `guards.ts` answers *"may I delete this?"* at the moment a merchant reaches
 * for Delete, which is the right question there and the wrong one for a design
 * that arrived broken. Three of the four problems below cannot be reached
 * through the editor at all — a design picked for the wrong [[Goal]], a form
 * on a step that does not submit, a colour pair a preset never produced — and
 * a merchant meets every one of them as a red bar on Save, or as a customer
 * who could not read the popup.
 *
 * ============================================================================
 * IT IS NOT A VALIDATOR. THE SERVER IS.
 * ============================================================================
 * `OptinController` refuses a design that cannot convert and one whose act its
 * Goal cannot report, and it does so because *"a screen is not an enforcement
 * mechanism"* (ADR 0026) — `PUT /wconvert/v1/optins/{id}` takes a whole config
 * and is scriptable by anyone holding `manage_options`. This is the near side
 * of that net, and it exists to make the far side something a merchant never
 * meets rather than to replace it.
 *
 * Two of the four are not refusals at all: a block that will lose its words and
 * a colour pair below AA both save happily and cost the merchant later. They
 * belong here precisely because nothing else will ever mention them.
 */

/** One thing to fix, and where it is if it is somewhere. */
export interface Problem {
  /** What to do about it, in the merchant's words. */
  readonly said: string;
  /** The block it is about, where it is about one. */
  readonly path: Path | null;
}

/**
 * Everything wrong with this design, worst first.
 *
 * Ordered by what it costs: a design that cannot save at all, then one that
 * would report nothing, then one that will quietly lose words, then one a
 * visitor may not be able to read. That is also the order a merchant can act
 * in — there is no point choosing colours for a design the save refuses.
 */
export function problemsIn(template: Template, act: ConvertingAct): Problem[] {
  return [
    ...whatCannotConvert(template, act),
    ...whatCapturesNothing(template),
    ...whatLosesWords(template),
    ...whatCannotBeRead(template),
  ];
}

/**
 * The converting act, from both ends.
 *
 * **None** is ADR 0020's exact failure — an Optin that renders, publishes and
 * reports zero forever, looking broken while being right. **The wrong one**
 * fails the whole save through `refuseAMetricItCannotReport`, and it is the one
 * state the ⇄ control cannot fix from here: a submit button on a click-metered
 * Goal is a design picked for a different job, and the answer is the gallery or
 * the Goal rather than a param.
 */
function whatCannotConvert(template: Template, act: ConvertingAct): Problem[] {
  const offered = convertingActOf(template.tree);

  if (offered.length === 0) {
    return [
      {
        said: __(
          'Nothing on this design counts as a conversion, so it would report zero forever. Add a button.',
          'wconvert',
        ),
        path: null,
      },
    ];
  }

  if (offered.length === 1 && offered[0] === act) {
    return [];
  }

  return [
    {
      /*
        **It names a door that is on this screen.** Both sentences ended "…or
        change the goal", and there is no control in the builder that changes a
        Goal — it is chosen at creation. An instruction pointing at something
        the merchant cannot find is worse than no instruction, because they go
        looking. The gallery is the door, and it now marks which designs fit
        before the click rather than refusing after it ({@see Gallery}).
      */
      said:
        act === 'submit'
          ? __(
              'Your goal counts form submissions and this design converts on a click, so saving it will be refused. Pick one of the designs on the Design tab that submits.',
              'wconvert',
            )
          : __(
              'Your goal counts click-throughs and this design converts on a submission, so saving it will be refused. Pick one of the designs on the Design tab that links away.',
              'wconvert',
            ),
      path: convertingBlockIn(template),
    },
  ];
}

/**
 * A form that captures nothing anybody reads.
 *
 * `render.ts` makes the step holding a non-`link` button the `<form>`, and that
 * follows from the tree rather than from a flag — so a field on any other step
 * is an input inside a `<div>`: it draws, it takes typing, and nothing on earth
 * reads it. The editor refuses to ADD one there; a design can still arrive with
 * one, and a merchant who deleted the button leaves every field behind.
 */
function whatCapturesNothing(template: Template): Problem[] {
  const form = formStep(template.tree);
  const stranded = nodesOf(template.tree).filter(
    (block) => block.captures !== null && block.path[0] !== form,
  );

  if (stranded.length === 0) {
    return [];
  }

  return stranded.map((block) => ({
    said:
      form === null
        ? __(
            'This design captures something but has no button that submits, so what a visitor types goes nowhere.',
            'wconvert',
          )
        : __(
            'This field is not on the step that submits, so it draws and is read by nothing. Move it onto the form.',
            'wconvert',
          ),
    path: block.path,
  }));
}

/**
 * Blocks whose words a design switch would throw away.
 *
 * Not a refusal and never will be — the design saves, renders and works. It
 * costs the merchant the next time they pick a design, which is far enough
 * away that nothing else would ever connect the two.
 */
function whatLosesWords(template: Template): Problem[] {
  const at = nodesOf(template.tree).filter(losesWordsOnSwitch);

  if (at.length === 0) {
    return [];
  }

  return [
    {
      said: sprintf(
        /* translators: %d: how many blocks have no Slot Role of their own. */
        _n(
          '%d block has no name of its own, so what you typed in it is lost if you switch design.',
          '%d blocks have no name of their own, so what you typed in them is lost if you switch design.',
          at.length,
          'wconvert',
        ),
        at.length,
      ),
      path: at[0].path,
    },
  ];
}

/**
 * Colour pairs a visitor may not be able to read.
 *
 * The three places the renderer paints words on a surface, against AA for body
 * text. `backdrop` is deliberately absent: it sits behind the popup rather than
 * behind text. A pair {@see contrastOf} cannot read is not reported — a
 * translucent colour has no ratio of its own, and a guess here would be a
 * warning about nothing or a silence about something.
 */
function whatCannotBeRead(template: Template): Problem[] {
  const value = (name: string) =>
    template.tokens[name] ?? TOKENS.find((token) => token.name === name)?.fallback ?? '';

  return PAIRS.flatMap(([fg, bg, said]) => {
    const ratio = contrastOf(value(fg), value(bg));

    return ratio === null || ratio >= AA_NORMAL ? [] : [{ said: said(), path: null }];
  });
}

const PAIRS: readonly (readonly [string, string, () => string])[] = [
  [
    'fg',
    'bg',
    () =>
      __('The text colour is too close to the background to be readable. Change one of them.', 'wconvert'),
  ],
  [
    'muted',
    'bg',
    () => __('The quiet text is too close to the background to be readable.', 'wconvert'),
  ],
  [
    'accent-fg',
    'accent',
    () => __('The button’s label is too close to the button to be readable.', 'wconvert'),
  ],
];

/** Where the block that converts is, so the chip can point at it. */
function convertingBlockIn(template: Template): Path | null {
  return nodesOf(template.tree).find((block) => block.type === 'button')?.path ?? null;
}

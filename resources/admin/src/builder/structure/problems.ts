import { __, _n, sprintf } from '@wordpress/i18n';
import { AA_NORMAL, contrastOf } from '../contrast';
import { TOKENS, type Path } from '../panel';
import { formStep, losesWordsOnSwitch } from './catalogue';
import { convertingActOf } from './guards';
import { capturesTaken, nodesOf } from './tree';
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
 * that arrived broken. Most of the problems below cannot be reached through the
 * editor at all — a design with nothing to deliver to, a form on a step that
 * does not submit, a colour pair a preset never produced — and a merchant meets
 * every one of them as a red bar on Save, or as a customer who could not read
 * the popup.
 *
 * ============================================================================
 * IT IS NOT A VALIDATOR. THE SERVER IS.
 * ============================================================================
 * `OptinController` refuses a design that cannot convert and one that captures
 * nothing where this Optin needs a capture, and it does so because *"a screen
 * is not an enforcement mechanism"* (ADR 0026) — `PUT
 * /wconvert/v1/optins/{id}` takes a whole config and is scriptable by anyone
 * holding `manage_options`. This is the near side of that net, and it exists to
 * make the far side something a merchant never meets rather than to replace it.
 *
 * ============================================================================
 * TWO OF THEM WERE ABOUT THE [[GOAL]]'S ACT, AND BOTH HAVE GONE.
 * ============================================================================
 * They said *"Your goal counts form submissions and this design converts on a
 * click, so saving it will be refused"*, and they were true while a Goal
 * declared an act. It does not (ADR 0059): the act is read off this very
 * template, so a design that disagrees with itself is not a state anything can
 * reach. What replaces them is one Goal-shaped note about what a design
 * CAPTURES, which is the only thing a Goal can still fail a design for.
 *
 * Two of the rest are not refusals at all: a block that will lose its words and
 * a colour pair below AA both save happily and cost the merchant later. They
 * belong here precisely because nothing else will ever mention them.
 */

/** One thing to fix, and where it is if it is somewhere. */
export interface Problem {
  /** What to do about it, in the merchant's words. */
  readonly said: string;
  /** The block it is about, where it is about one. */
  readonly path: Path | null;
  /**
   * Where the fix is, when it is not a block on the Content tab.
   *
   * ==========================================================================
   * A SECOND DESTINATION SHAPE, BECAUSE ONE OF THESE IS NOT ABOUT A BLOCK.
   * ==========================================================================
   * `whatCountsDownToNothing` names a `countdown` and its fix is an `ends_at`
   * on the **Rules** tab. It carried the block's `path`, so pressing the
   * sentence took the merchant to the Content tab and selected the clock —
   * *away* from the thing to change — with the route carried entirely by the
   * words *"under 'How often' on the Rules tab"*. A door that opens onto the
   * wrong room is worse than no door (ADR 0042 rule 4).
   *
   * A discriminator rather than a second field of paths, because the two
   * destinations are not the same kind of thing: one is an address in a tree
   * and the other is a named place on a screen.
   */
  readonly go?: 'schedule';
}

/**
 * Everything wrong with this design, worst first.
 *
 * Ordered by what it costs: a design that cannot save at all, then one that
 * would report nothing, then one that will quietly lose words, then one a
 * visitor may not be able to read. That is also the order a merchant can act
 * in — there is no point choosing colours for a design the save refuses.
 */
export function problemsIn(
  template: Template,
  /**
   * Whether this Optin's [[Goal]] reads its headline from deliveries, so a
   * design capturing nothing has no address to deliver to.
   *
   * **It replaces the converting act this used to take**, which is the shape
   * of the whole change: the act is derivable from the `template` argument
   * beside it and was therefore a second copy of it, while what a Goal
   * declares is not derivable from a design at all (ADR 0059).
   */
  needsACapture: boolean,
  /**
   * When the Optin stops running, as the merchant typed it — or undefined.
   *
   * Passed in rather than read off the template, because it is not the
   * template's: a `countdown` node carries no deadline and counts to the
   * Optin's own `ends_at` (ADR 0052). Required rather than optional so a caller
   * that has a schedule cannot forget to hand it over and quietly lose the
   * check.
   */
  endsAt: string | undefined,
): Problem[] {
  return [
    ...whatCannotConvert(template),
    ...whatHasNothingToDeliver(template, needsACapture),
    ...whatCapturesNothing(template),
    ...whatCountsDownToNothing(template, endsAt),
    ...whatLosesWords(template),
    ...whatCannotBeRead(template),
  ];
}

/**
 * A design with nothing on it that counts.
 *
 * ============================================================================
 * IT ASKED THE ACT FROM BOTH ENDS, AND ONE END HAS GONE.
 * ============================================================================
 * **None** is ADR 0020's exact failure — an Optin that renders, publishes and
 * reports zero forever, looking broken while being right — and that arm is
 * unchanged, because it is a fact about the document alone.
 *
 * The other arm said *"your goal counts form submissions and this design
 * converts on a click, so saving it will be refused"*, and it is deleted. A
 * Goal declares no act (ADR 0059), so the act this design offers IS this
 * Optin's act and there is nothing left for it to disagree with. Its sentences
 * also ended *"…or change the goal"* against a builder that had no such
 * control, which is the door ADR 0042 rule 4 forbids naming — there is one
 * now, and nothing here needs to point at it.
 */
function whatCannotConvert(template: Template): Problem[] {
  if (convertingActOf(template.tree).length > 0) {
    return [];
  }

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

/**
 * A [[Goal]] read from deliveries, on a design that asks for nothing.
 *
 * ============================================================================
 * THE ONE GOAL-SHAPED PROBLEM LEFT, AND IT IS ABOUT CAPTURE RATHER THAN ACT.
 * ============================================================================
 * The delivery kind is written when a push to the lead-magnet [[Destination]]
 * succeeds, and there is nothing to push unless the visitor gave an address.
 * So this design reports **zero forever** under this Goal — the same failure
 * as an Optin with no button, arrived at from the other side — and the save
 * refuses it (ADR 0059).
 *
 * **A note here and never a filter in the gallery.** Pre-pressing a captures
 * chip for a Goal would be a Goal facet in a captures chip's clothes, which
 * ADR 0043 forbids outright. *Which* detail to ask for stays silent for the
 * same reason and a stronger one: an email against a phone number is the
 * merchant's own judgement and nothing enforces it.
 *
 * **`path: null`, because the fix is not a block.** It is a design with a
 * field on it, from the Design tab — and adding one to a design that converts
 * on a click is refused by the editor for its own reasons (`catalogue.ts`), so
 * pointing at a block would point at work the merchant cannot do.
 */
function whatHasNothingToDeliver(template: Template, needsACapture: boolean): Problem[] {
  if (!needsACapture || capturesTaken(template.tree).length > 0) {
    return [];
  }

  return [
    {
      said: __(
        'Your goal counts deliveries and this design asks the visitor for nothing, so there is no address to deliver to. Pick a design with a field on it.',
        'wconvert',
      ),
      path: null,
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
 * A clock with nothing to count to.
 *
 * ============================================================================
 * IT IS A BUILDER PROBLEM RATHER THAN A CRASH, AND THAT IS THE WHOLE POINT OF
 * BINDING THE DEADLINE TO THE SCHEDULE.
 * ============================================================================
 * A `countdown` counts to the Optin's `ends_at` and to nothing else
 * (ADR 0052), which is what makes a timer that disagrees with its own schedule
 * inexpressible — the zombie countdown that keeps running after the offer ends
 * is not a setting somebody can misconfigure here.
 *
 * What that leaves is one state: a design carrying a clock on an Optin with no
 * end. It renders, saves and publishes; the clock is simply empty. Nothing else
 * in the product will ever mention it, and the fix is on a different tab from
 * the design — so the sentence has to name the tab.
 */
function whatCountsDownToNothing(template: Template, endsAt: string | undefined): Problem[] {
  if (typeof endsAt === 'string' && endsAt !== '') {
    return [];
  }

  const clocks = nodesOf(template.tree).filter((block) => block.type === 'countdown' && !block.hidden);

  if (clocks.length === 0) {
    return [];
  }

  return [
    {
      /*
        **The words no longer carry the route, because the button does.** They
        said *"under 'How often' on the Rules tab"* and then took the merchant
        to the Content tab, which is the failure ADR 0042 rule 4 names read
        backwards: an instruction pointing somewhere the control is not. What
        is left is the fact and what to do about it.
      */
      said: __(
        'This design shows a countdown, and nothing says when this Optin stops running. Set an end date, or the clock stays empty.',
        'wconvert',
      ),
      path: null,
      go: 'schedule',
    },
  ];
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

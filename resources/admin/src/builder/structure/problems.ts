import { __, _n, sprintf } from '@wordpress/i18n';
import { AA_NORMAL, READABLE_PAIRS, contrastOf, pairKey } from '../contrast';
import { resolvedToken, type Path } from '../panel';
import { formStep, losesWordsOnSwitch } from './catalogue';
import { convertingActOf } from './guards';
import { capturesTaken, nodesOf, nodeAt } from './tree';
import { validInterestOptions } from '../InterestOptions';
import type { FieldNode } from '@renderer/types';
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
  /**
   * WHICH check produced this, so a strip can name its own source.
   *
   * ==========================================================================
   * A LIST OF SENTENCES CANNOT SAY WHAT IT LOOKED AT.
   * ==========================================================================
   * The readiness verdict reads out what is wrong, which is the right shape for
   * a merchant about to publish. It is the wrong shape while somebody is
   * RESTYLING: a design tab that says nothing is a design tab that either
   * checked six things and liked them, or checked nothing — and those look
   * identical (ADR 0042 rule 3, a control that says nothing must not be
   * mistakable for one that is off).
   *
   * So each problem names its check, the design pane draws one chip per check
   * whether it passed or not, and the chip that failed carries the sentence
   * that was already being computed. Nothing new is derived; what is new is
   * that the checks are countable.
   *
   * **Optional, and the absence is meaningful.** The readiness verdict also
   * carries problems that are not about the DESIGN — an unreachable Destination
   * is one — and those name no check because the design pane's strip is not
   * about them. A problem with no check is reported in the verdict and drawn on
   * no chip.
   */
  readonly check?: CheckId;
  readonly blocksPublish?: boolean;
}

/**
 * The six checks, in the order {@see problemsIn} runs them — worst first.
 *
 * Exported so the strip can draw one chip per check without a second list of
 * them, which is the fifth cross-cutting list this codebase keeps refusing
 * (ADR 0019). A seventh check added below arrives on screen with no component
 * edited.
 */
export const CHECKS = [
  'converts',
  'collects',
  'captures',
  'countdown',
  'words',
  'readable',
] as const;

export type CheckId = (typeof CHECKS)[number];

/**
 * What ENFORCES each check, named where the merchant can see it.
 *
 * ============================================================================
 * A WARNING NOBODY CAN TRACE IS A WARNING PEOPLE LEARN TO DISMISS.
 * ============================================================================
 * The strip draws six chips and the failing one carries a sentence. What it
 * could not say is *who says so* — and the six are not one kind of thing: two
 * are refusals the server makes at the write, two are rules the vocabulary or
 * the renderer imposes, and two are nothing but this file's own opinion about
 * what will cost the merchant later.
 *
 * That difference is exactly what a merchant needs in order to decide whether
 * to act. *The save will refuse this* and *nothing will ever mention this
 * again* are the two ends of it, and a chip that looks identical for both
 * teaches them to ignore both (ADR 0042 rule 2).
 *
 * **Per CHECK and not per problem**, which is the shape the plan asked for the
 * other way round. A passing chip has a source too — *six checks pass* is only
 * legible if a reader can see what was doing the checking — and a field on
 * `Problem` could cite one only while something was wrong. It would also be the
 * same string repeated by every producer of the same check.
 *
 * **Two strings, because the chip and the tooltip want different lengths.**
 * `at` is one short token — six chips fit one line at 1680 and two at 1280 —
 * and `how` is the sentence a merchant reads once while deciding. Spelling only
 * the long form put `OptinController::refuseADesignThatCapturesNothing()` on
 * screen six times across two lines in a monospace register, which reads as
 * debug output rather than as *six checks pass*.
 *
 * Not translated, and that is deliberate: these are file names and ADR
 * numbers. A translator has nothing to do with `OptinController` and a
 * localised class name is a class name nobody can grep for.
 */
export const CHECK_SOURCES: Readonly<Record<CheckId, { at: string; how: string }>> = {
  converts: { at: 'OptinController', how: 'refuseADesignThatCannotConvert() refuses the write' },
  collects: { at: 'OptinController', how: 'refuseADesignThatCapturesNothing() refuses the write' },
  captures: { at: 'render.ts', how: 'the step that holds the submit button IS the form' },
  countdown: { at: 'ADR 0052', how: 'a countdown counts to the Optin’s own end date and nothing else' },
  words: { at: 'SlotRoles', how: 'bind() writes a Playbook’s words back only where a Role binds' },
  readable: { at: 'ADR 0038', how: 'AA on small text' },
};

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
   * Whether this Optin's [[Goal]]'s product is a captured contact.
   *
   * **It replaces the converting act this used to take**, which is the shape
   * of the whole change: the act is derivable from the `template` argument
   * beside it and was therefore a second copy of it, while what a Goal
   * declares is not derivable from a design at all (ADR 0059).
   *
   * The looser of the Goal's two capture facts, deliberately. The stricter one
   * — a Goal whose headline is read from deliveries — is a refusal, said on
   * the gallery card and enforced at the write; this is the one that is only
   * ever a sentence.
   */
  growsAList: boolean,
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
    ...whatCollectsNothing(template, growsAList),
    ...whatCapturesNothing(template),
    ...whatHasIncompleteFields(template),
    ...whatCountsDownToNothing(template, endsAt),
    ...whatLosesWords(template),
    ...whatCannotBeRead(template),
  ];
}

function whatHasIncompleteFields(template: Template): Problem[] {
  const step = formStep(template.tree);
  if (step === null) return [];
  const fields = nodesOf(template.tree).filter((node) => node.type === 'field' && node.path[0] === step);
  const issues: Problem[] = [];
  if (!fields.some((field) => field.captures === 'email' || field.captures === 'phone')) {
    issues.push({ said: __('Add an email or phone field so this form can capture a lead.', 'wconvert'), path: null, check: 'captures', blocksPublish: true });
  }
  for (const field of fields.filter((field) => field.captures === 'interest')) {
    if (!validInterestOptions((nodeAt(template.tree, field.path) as FieldNode | null)?.options)) {
      issues.push({ said: __('Set up the interest choices: every choice needs a label and a unique valid sent value.', 'wconvert'), path: field.path, check: 'captures', blocksPublish: true });
    }
  }
  return issues;
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
      check: 'converts',
    },
  ];
}

/**
 * A [[Goal]] whose product is a contact, on a design that asks for nothing.
 *
 * ============================================================================
 * THE ONE PROBLEM ADR 0059 CREATED, RATHER THAN INHERITED.
 * ============================================================================
 * Every other entry in this file reports something that was already possible.
 * This one exists because deleting `Goal::convertingAct()` made a new pairing
 * reachable: *"grow my email list"* over a design whose only button links
 * away. That used to be refused outright — the gallery greyed the card and the
 * save rejected it — and it is now allowed.
 *
 * **And allowed is right; silent is not.** The Optin saves, publishes, shows,
 * and honestly counts click-throughs. Nothing is broken. What is wrong is that
 * the merchant asked for a list and will never get one, and no other surface
 * in the product will ever mention it — which is exactly the bar the two
 * non-refusal problems in this file already meet.
 *
 * **A sentence, never a refusal and never a gallery filter.** Pre-pressing a
 * captures chip for a Goal is a Goal facet in a captures chip's clothes, which
 * ADR 0043 forbids; and refusing the save would put back the wall this ticket
 * removed, one predicate over.
 *
 * **It asks whether the design captures ANYTHING, never what.** Email against
 * phone is the merchant's own judgement and nothing enforces it — an SMS list
 * grown from an email capture is still a list they grew.
 *
 * **`path: null`, because the fix is not a block.** It is a design with a
 * field on it, from the Design tab — and adding one to a design that converts
 * on a click is refused by the editor for its own reasons (`catalogue.ts`), so
 * pointing at a block would point at work the merchant cannot do.
 */
function whatCollectsNothing(template: Template, growsAList: boolean): Problem[] {
  if (!growsAList || capturesTaken(template.tree).length > 0) {
    return [];
  }

  return [
    {
      said: __(
        'This goal collects contacts and this design asks the visitor for nothing, so it will never collect any. Pick a design with a field on it.',
        'wconvert',
      ),
      path: null,
      check: 'collects',
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
    check: 'captures',
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
      check: 'countdown',
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
      check: 'words',
    },
  ];
}

/**
 * Colour pairs a visitor may not be able to read.
 *
 * The four places the renderer paints words on a surface, against AA for body
 * text. `backdrop` is deliberately absent: it sits behind the popup rather than
 * behind text. A pair {@see contrastOf} cannot read is not reported — a
 * translucent colour has no ratio of its own, and a guess here would be a
 * warning about nothing or a silence about something.
 */
function whatCannotBeRead(template: Template): Problem[] {
  const value = (name: string) => resolvedToken(template.tokens, name);

  return READABLE_PAIRS.flatMap(([fg, bg]) => {
    const ratio = contrastOf(value(fg), value(bg));
    const said = SAID[pairKey(fg, bg)];

    return ratio === null || ratio >= AA_NORMAL || said === undefined
      ? []
      : [{ said: said(), path: null, check: 'readable' as const }];
  });
}

/**
 * What each pair SAYS in the verdict, keyed by the pair {@see READABLE_PAIRS}
 * declares.
 *
 * The pairs are shared and the sentences are this screen's, which is the split
 * that stopped three copies of the list drifting: a pair added there arrives
 * here unnamed and reports nothing, and the test below fails rather than the
 * check silently narrowing.
 */
const SAID: Readonly<Record<string, () => string>> = {
  'fg/bg': () =>
    __('The text colour is too close to the background to be readable. Change one of them.', 'wconvert'),
  'muted/bg': () => __('The quiet text is too close to the background to be readable.', 'wconvert'),
  'accent-fg/accent': () =>
    __('The button’s label is too close to the button to be readable.', 'wconvert'),
  'fg/input-bg': () =>
    __('The text in the form fields is too close to their background to be readable.', 'wconvert'),
};

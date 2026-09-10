import vocabulary from '../../../templates/manifest.json';
import { isBareNumber, isColour, isFontStack, measuresOf } from './themes';
import type { TemplateNode, TemplateTree, Tokens } from '@renderer/types';

/**
 * The model of a design a merchant EDITS: tokens, slot content and slot
 * visibility, over a tree it never restructures.
 *
 * ============================================================================
 * THIS FILE STILL OFFERS NO WAY TO CHANGE ARRANGEMENT. `structure/` DOES.
 * ============================================================================
 * Every function here takes a tree and returns one with the SAME shape — same
 * node types, same order, same nesting. What changes is what a node says and
 * whether it is shown.
 *
 * That is a division of labour rather than a ceiling on the product. The two
 * halves meet on one screen now: {@see BlockTree} lists the blocks and moves
 * them, and {@see BlockInspector} under it writes what the selected one says
 * through the functions below. Keeping them in separate files is what stops a
 * change to the words being able to change the shape by accident.
 *
 * That is ADR 0010's own escape clause collected rather than a hole in it:
 * *"a canvas lands later as an editor over a tree that already exists, with no
 * migration"*, and the tree it edits is the tree that was always stored.
 *
 * The ceiling did not move with it. `structure/catalogue.ts` reads the same
 * manifest this file does and can express nothing outside it, so the editor
 * arranges what the vocabulary offers and cannot invent design variety. The
 * gallery is still where a design comes from.
 *
 * **The vocabulary is imported rather than fetched.** It is a static file with
 * nothing per-install to resolve — unlike the rule vocabulary, whose
 * [[Availability]] is a fact about this install and therefore the server's to
 * answer. A REST route for it would be a second copy of a file both sides
 * already read, and the admin bundle has no byte budget to protect (the
 * loader's is what `bin/check-loader.mjs` guards, and it must never import
 * this).
 */

export interface LeafDeclaration {
  readonly content: readonly string[];
  readonly style_tokens?: readonly string[];
  readonly copy: readonly string[];
  readonly params: readonly string[];
  /**
   * The [[Slot Role]]s this node type may carry, or none where it carries no
   * `role` key at all.
   *
   * `image` has none because it holds no words, and `field` has none because
   * its Roles are DERIVED from what it captures rather than declared
   * (CONTEXT.md, Slot Role). Everything else names the Roles that suit it, so
   * {@see structure/catalogue} can hand a newly added block a Role that is
   * actually free without a mapping of its own — the same property `TOKENS`
   * gives the token list.
   */
  readonly roles: readonly string[];
  /**
   * What the editor OFFERS for each of this leaf's own settings.
   *
   * ==========================================================================
   * `choices` IS WHAT SAYS "THIS PARAM HAS A CONTROL". `params` IS NOT.
   * ==========================================================================
   * `params` also holds `hidden`, which the *Show this* switch draws, and
   * `name` and `action`, which the ⇄ menu draws — each already has words of
   * its own, and a second control for either would be two ways to ask one
   * question. What was left over was `heading.level`, `image.fit` and
   * `field.required`: three settings the renderer reads, one of which the
   * CAPTURE endpoint enforces, and none of which any control in this admin
   * ever reached.
   *
   * So the manifest declares the offer, exactly as {@link LAYOUTS} does one
   * level up, and this bundle names no param and no value.
   *
   * **A suggestion and never a limit**, the same bargain a token's `choices`
   * make: `TemplateVocabulary` does not read this section, so a design
   * shipping a value nothing here offers keeps it and the control simply shows
   * nothing checked.
   */
  readonly choices?: Readonly<Record<string, readonly string[]>>;
  /**
   * What the RENDERER does with each of those params when the key is absent.
   *
   * ==========================================================================
   * AN ABSENT VALUE IS NOT AN UNKNOWN ONE, AND THE CONTROL HAD CONFLATED THEM.
   * ==========================================================================
   * `split.ratio` shows nothing checked on a design carrying `0.4`, and the
   * reason is sound: the vocabulary does not validate a param's value, so the
   * panel must not claim a design is something it is not. That argument is
   * about an OFF-LIST value and was being applied to an ABSENT one — and no
   * shipped [[Template]] carries a `level` at all, so every heading in the
   * library offered *Main heading* and *Sub-heading* with neither ticked while
   * the renderer drew an unambiguous `h2`.
   *
   * The default cannot be spelled in this bundle: `render.ts` decides it, and
   * a copy here would be the cross-language list ADR 0019 has refused five
   * times. So the manifest declares it and
   * `tests/js/renderer-manifest-parity.test.ts` asserts that a node with the
   * key absent renders identically to one carrying the declared default —
   * behaviour rather than a list against a list.
   */
  readonly defaults?: Readonly<Record<string, string>>;
}

/**
 * The vocabulary's leaves and layouts, as the structure editor reads them.
 *
 * **Exported for `structure/`, and that is the whole reason they are not
 * private any more.** The editor decides what may be added where by reading
 * this manifest, so a node type added to
 * `resources/templates/manifest.json` costs the editor nothing — no list to
 * extend, no switch to widen. A second copy of these two objects under
 * `structure/` would be the fifth hand-maintained cross-cutting list this
 * project has refused (ADR 0019).
 */
export const LEAVES = vocabulary.nodes as Readonly<Record<string, LeafDeclaration>>;
export const LAYOUTS = vocabulary.layouts as Readonly<
  Record<
    string,
    {
      readonly children: string;
      readonly style_tokens?: readonly string[];
      /** Its own settings — `split`'s `ratio` is the one the vocabulary declares. */
      readonly params?: readonly string[];
      /**
       * What the editor OFFERS for each of those settings.
       *
       * A suggestion and never a limit, exactly like a token's `choices`: the
       * renderer takes any fraction for `ratio`, so a design shipping `0.4`
       * keeps it and the control shows nothing checked.
       */
      readonly choices?: Readonly<Record<string, readonly string[]>>;
      /** What the renderer draws where the key is absent. {@see LeafDeclaration.defaults}. */
      readonly defaults?: Readonly<Record<string, string>>;
    }
  >
>;

/** Where a layout keeps its children. `split` is the one with two. */
export const PANES = ['start', 'end'] as const;

/**
 * A manifest choice as the tree actually stores it.
 *
 * ============================================================================
 * DECIDED BY THE VALUE'S SHAPE, SO NOTHING NAMES A PARAM.
 * ============================================================================
 * The manifest spells every offered value as a string — JSON has one place to
 * put a list of them — and the tree stores three different types: `ratio` is a
 * number, `level` is a number, `fit` is a string and `required` is a boolean.
 * A control writing the string would store `"true"` for a flag the renderer
 * tests with `=== true`, and `"2"` for a rank it tests with `=== 2`: both save,
 * both normalise, and both silently stop doing anything.
 *
 * `LayoutParams` had half of this as a bare `Number(choice)` with a comment
 * about `0.50`, which is right for the one param that existed and wrong for
 * every param since. Reading the SHAPE is what makes it total —
 * {@see groupOf} decides a token's group the same way and for the same reason.
 *
 * The empty string is left alone rather than becoming `0`: {@see withValue}
 * reads it as "clear this key", and a choice that coerced to a number would
 * take that meaning away.
 */
export function valueOfChoice(choice: string): unknown {
  if (choice === 'true' || choice === 'false') {
    return choice === 'true';
  }

  return choice !== '' && Number.isFinite(Number(choice)) ? Number(choice) : choice;
}

/**
 * Is this what the node already holds — or, where it holds nothing, what the
 * renderer will draw?
 *
 * ============================================================================
 * ABSENT IS AN ANSWER. OFF-LIST IS NOT.
 * ============================================================================
 * Compared as the VALUES they become rather than as strings, which is what
 * makes `0.5` and `"0.50"` the same split — the comparison `LayoutParams`
 * already made, now made the same way for every param.
 *
 * `fallback` is the manifest's declared default and is what closes the case
 * the control used to get wrong. A design carrying `ratio: 0.4` still shows
 * nothing checked, because the panel must not claim a design is something it
 * is not; a design carrying no `level` shows *Main heading*, because that is
 * what a visitor will actually see. The two were one branch and are two facts.
 */
export const isChoiceHeld = (held: unknown, choice: string, fallback?: string): boolean =>
  held === undefined
    ? fallback !== undefined && fallback === choice
    : held === valueOfChoice(choice);

/** Every Slot Role the vocabulary declares, in the order it declares them. */
export const ROLES = vocabulary.roles as readonly string[];

/**
 * The Roles a [[Playbook]] may **not** fill — the merchant's own to type.
 *
 * ============================================================================
 * THE ADMIN READS THIS BECAUSE IT MUST NOT HAND ONE OUT BY DEFAULT.
 * ============================================================================
 * `code_value` holds a coupon that exists in one merchant's shop; `wordmark`
 * holds their name. PHP reads this list to refuse a Playbook that fills one
 * ({@see \WConvert\Template\TemplateVocabulary::authoredRoles()}); the editor
 * reads it for the mirror-image reason — `freeRoleFor` walks a kind's declared
 * Roles and takes the first unclaimed one, and an authored Role is unclaimed on
 * most designs. Without this, adding a heading to a design that already has its
 * headline handed the merchant a block called *Your name*.
 *
 * A default is a guess and these are the two Roles nobody can guess. They stay
 * OFFERED — the ⇄ menu still lists them — because a masthead is a real thing a
 * merchant adds; what they are not is what a new block silently becomes.
 */
export const AUTHORED_ROLES = vocabulary.authored_roles as readonly string[];

/** What a `field` may capture. Closed, because the capture path canonicalises per kind. */
export const FIELDS = vocabulary.fields as readonly string[];

/**
 * The key a leaf carries to name itself, for a translator — `id`.
 *
 * **The editor never mints one.** They are minted on the way in by
 * `WConvert\Template\NodeIdentities`, because a save replaces `config` with
 * what came back and an admin-invented key would survive exactly until then
 * (see `structure/tree.ts`). What the editor has to do is the opposite: STRIP
 * it from a duplicated block, so the copy is given a fresh one rather than
 * sharing the original's translation.
 *
 * Read from the manifest rather than written here, for the reason every other
 * member of the vocabulary is: one spelling, on both sides of the boundary.
 */
export const IDENTITY = vocabulary.identity as string;

/**
 * Every token the vocabulary declares, with the value it falls back to.
 *
 * The Design tab draws one control per entry, so a token added to the manifest
 * appears there without anything else being edited — and an unconsumed one
 * cannot hide, because `tests/js/renderer-manifest-parity.test.ts` fails the
 * day the stylesheet stops reading it.
 */
export interface TokenDeclaration {
  readonly name: string;
  readonly fallback: string;
  readonly control?: string;
}

export const TOKENS: readonly TokenDeclaration[] = Object.entries(
  vocabulary.tokens as Readonly<Record<string, string>>,
).map(([name, fallback]) => ({ name, fallback, control: (vocabulary.token_controls as Record<string, string>)[name] }));

/**
 * The two tokens whose absence resolves to ANOTHER token rather than to a
 * literal.
 *
 * ============================================================================
 * A MANIFEST DEFAULT CANNOT SAY "WHATEVER `bg` IS", SO THIS SAYS IT.
 * ============================================================================
 * `.wc-input` reads `var(--wc-input-bg,var(--wc-bg,#fff))` and `.wc-heading`
 * reads `var(--wc-heading-font,var(--wc-font,…))` — both added with the scoped
 * bag, both deliberately chained so that every design shipped before them
 * renders identically. The manifest declares one string per token, and no
 * string expresses *the design's own ground*.
 *
 * That gap is not cosmetic. {@see resolvedToken} feeds the AA contrast check,
 * and the manifest's `#ffffff` for `input-bg` would have reported a dark
 * design's near-white text as unreadable on a white field the visitor never
 * sees — a warning about a surface that does not exist, on precisely the
 * designs a scoped bag is for.
 *
 * **It is a second spelling of two CSS declarations and there is no way for it
 * not to be**, so it is two entries in one place rather than a `??` in each
 * consumer, and the comment above each rule in `css.ts` names it.
 */
const FALLS_BACK_TO: Readonly<Record<string, string>> = {
  'input-bg': 'bg',
  'heading-font': 'font',
};

/**
 * What the renderer will actually resolve a token to, given a design.
 *
 * The design's own value, else the token it chains to, else the manifest's
 * literal. This is what a check must read: a ratio computed from an empty
 * control is a verdict on a colour nobody chose.
 */
export function resolvedToken(tokens: Readonly<Record<string, string>>, name: string): string {
  const held = tokens[name];

  if (held !== undefined && held !== '') {
    return held;
  }

  const chained = FALLS_BACK_TO[name];

  return chained === undefined
    ? (TOKENS.find((token) => token.name === name)?.fallback ?? '')
    : resolvedToken(tokens, chained);
}

/**
 * What the Design panel OFFERS for a token, where offering a list is the only
 * usable control.
 *
 * ============================================================================
 * A CONTROL THAT ENUMERATES READS ITS ENUMERATION FROM THE MANIFEST.
 * ============================================================================
 * A control that INFERS reads the value — which is how a colour gets a picker
 * and a length gets a slider, with nothing in this bundle naming either token.
 * But two shapes say nothing about themselves: `align` is a three-value enum
 * that looks like the word `start`, and `font` is a curated choice that looks
 * like any other string. Both were text boxes, and *"type `center` into this
 * box"* is the defect this whole panel exists to remove.
 *
 * A table in `Tokens.tsx` mapping `align → segmented` would be the "second
 * spelling" this codebase refuses everywhere else. So the manifest says, in a
 * **sibling section** rather than by `tokens` becoming objects: every reader of
 * `tokens` today takes `array_keys`/`Object.keys` of it —
 * `TemplateVocabulary`, `TemplateLabelParityTest`, `renderer-manifest-parity`,
 * `builder-panel` — except `builder-themes.test.ts`, which types it
 * `Record<string, string>` and uses the values as strings four more times. A
 * sibling section breaks none of them.
 *
 * **It is never what is ALLOWED.** Token values stay unvalidated on both sides
 * of the boundary — `TemplateVocabulary` does not read this — which is what
 * keeps `clamp(20rem, 50vw, 30rem)` typeable, and every choice control keeps a
 * text box beside it. So a token this bundle has never heard of still gets the
 * control its VALUE earns it, which is ADR 0010's promise unchanged.
 */
export const CHOICES = vocabulary.choices as Readonly<Record<string, readonly string[]>>;

/**
 * The four groups the Design panel draws, in order.
 *
 * `other` is the trailing one and is the whole point: a token added to the
 * manifest that this bundle recognises nothing about **lands there wearing a
 * text box**, rather than vanishing from a panel that only knows three groups.
 * That is ADR 0010's *"a token added to the manifest appears in the editor with
 * no change to this bundle"*, kept literally.
 */
export const TOKEN_GROUPS = ['colour', 'type', 'space', 'other'] as const;

export type TokenGroupId = (typeof TOKEN_GROUPS)[number];

/**
 * Which group a token belongs to.
 *
 * **Decided by the token's FALLBACK — the design's own value, else the
 * manifest's — and never by what the merchant has typed.** The control is
 * dispatched on the resolved value (see `Tokens.tsx`), because a merchant who
 * typed `var(--brand)` must not keep a hex picker that would overwrite it on
 * the first drag. But a token that changed GROUP as they typed would jump
 * across the panel mid-edit, so grouping reads the value that does not move.
 *
 * Every arm is a shape rather than a name, so this file names no token.
 */
export function groupOf(token: TokenDeclaration): TokenGroupId {
  const declared = Object.entries(vocabulary.token_groups).find(([, names]) => (names as readonly string[]).includes(token.name));
  if (declared !== undefined) return declared[0] as TokenGroupId;

  if (isColour(token.fallback)) {
    return 'colour';
  }

  // A font stack, or a bare number — the two typographic shapes. A weight and
  // a line-height are unitless where every length in this vocabulary is not,
  // so this arm is a shape like the others and still names no token
  // ({@see isBareNumber}).
  if (isFontStack(token.fallback) || isBareNumber(token.fallback)) {
    return 'type';
  }

  // A length, or a keyword the manifest offers a list for — `align` is the
  // second, and it is the reason this arm is not `measuresOf` alone. `shadow`
  // is the third and it arrived the same way — a `choices` entry and nothing
  // else, so it moved out of *Other settings* with no arm added here.
  if (measuresOf(token.fallback) !== null || CHOICES[token.name] !== undefined) {
    return 'space';
  }

  return 'other';
}

/**
 * Every token the manifest declares, in groups, in the panel's own order.
 *
 * Groups with nothing in them are dropped, so the trailing group costs an empty
 * install nothing and appears the moment something lands in it.
 */
export function groupsOf(
  tokens: readonly TokenDeclaration[] = TOKENS,
): readonly { readonly id: TokenGroupId; readonly tokens: readonly TokenDeclaration[] }[] {
  return TOKEN_GROUPS.map((id) => ({
    id,
    tokens: tokens.filter((token) => groupOf(token) === id),
  })).filter((group) => group.tokens.length > 0);
}

/**
 * Where a node sits, as the keys and indices that reach it.
 *
 * An address rather than a reference, because every edit returns a NEW tree —
 * React compares by identity, and a mutated node would leave the preview
 * showing the previous render.
 */
export type Path = readonly (string | number)[];

export interface Slot {
  readonly path: Path;
  readonly type: string;
  /**
   * The [[Slot Role]] it fills, or null where it has none. A `field`'s Roles
   * are derived from what it captures rather than declared, so it carries no
   * `role` key of its own (CONTEXT.md, Slot Role).
   */
  readonly role: string | null;
  /**
   * What a `field` captures, or null for anything else.
   *
   * A field's Roles are DERIVED from this rather than declared — a field
   * capturing an email offers `email_label` and cannot offer the phone's — so
   * this is what the panel heads it with, and it is a param rather than
   * content because the field kind is part of the DESIGN (CONTEXT.md, Slot
   * Role).
   */
  readonly captures: string | null;
  /** What the merchant may fill in — the node type's content keys, in order. */
  readonly keys: readonly string[];
  /** What is in them now. */
  readonly values: Readonly<Record<string, unknown>>;
  /**
   * Whether the merchant may switch it off.
   *
   * False for `button` and `field`, and not by omission: hiding the button
   * that converts leaves an Optin with no countable act, and hiding a required
   * field leaves a form the capture endpoint refuses every submission of.
   * Neither declares `hidden` in the manifest, so PHP drops the key on the way
   * in — the state is inexpressible rather than merely disallowed.
   */
  readonly hideable: boolean;
  readonly hidden: boolean;
  /**
   * Which of the slots sharing this one's name it is, within its step.
   *
   * ==========================================================================
   * ROLES REPEAT NOW, SO A NAME NO LONGER IDENTIFIES A SLOT ON ITS OWN.
   * ==========================================================================
   * A design may claim `body` three times (ADR 0051), and the preview and the
   * editor agree on a slot by NAME ({@see slots.SlotKey}) — so without an
   * ordinal, clicking the third benefit line in the preview would select the
   * first, and selecting any of them would outline all three.
   *
   * **Counted over the slots the renderer actually DRAWS, and per step.** The
   * preview renders one step at a time and skips hidden nodes, so a count that
   * spanned the tree or included hidden slots would be an ordinal the DOM side
   * cannot reproduce — and a mismatch there is silent: clicking a slot simply
   * does nothing, forever, which is the failure `tests/js/builder-slots.test.ts`
   * exists for. A hidden slot therefore takes no ordinal and gets no key at
   * all; it is not in the preview, so there is nothing for the preview to
   * outline.
   */
  readonly at: number;
  /**
   * The leaf's own settings the merchant may choose from a closed list, in the
   * order the manifest offers them.
   *
   * **Not the same set as the node type's `params`**, and the difference is
   * {@see LeafDeclaration.choices}: `hidden` is the switch below these
   * controls and `name` and `action` are the ⇄ menu above them, so what
   * reaches here is what nothing else already draws.
   *
   * Empty for a leaf with no such setting, which is `text`, `button` and
   * `consent` — so the panel draws nothing rather than an empty group.
   */
  readonly settings: readonly Setting[];
}

/** One closed-list setting of a leaf, and what it holds now. */
export interface Setting {
  readonly param: string;
  /** What the manifest offers, as it spells it. {@see valueOfChoice}. */
  readonly offered: readonly string[];
  /** What the node holds, which may be nothing and may be off the list. */
  readonly held: unknown;
  /** What the renderer draws where it holds nothing. {@see isChoiceHeld}. */
  readonly fallback: string | undefined;
}

/**
 * Every slot in a design, in tree order.
 *
 * The walk covers both of a `split`'s panes, which is exactly where a second
 * reader forgets to look — the same argument `ConvertingAct::offeredIn()`
 * makes on the other side of the boundary.
 *
 * Leaves only, which is the difference from `nodesOf`: a slot is something with
 * words in it, and a `row` has none. The inspector asks this what the selected
 * block may say and gets nothing back for a layout, which is why it says so
 * rather than drawing an empty box.
 */
export function slotsOf(tree: TemplateTree): Slot[] {
  const slots: Slot[] = [];

  tree.steps.forEach((step, index) => collect(step, [index], slots));

  return numbered(slots);
}

/**
 * What {@link numbered} needs of a walked node: where it is, what it is called,
 * and whether the renderer will draw it.
 *
 * A shape rather than a type, because two walks produce it — {@link slotsOf}
 * here and `structure/tree.ts`'s `nodesOf`, which also lists layouts — and the
 * numbering must come out identical from both. A second implementation of it is
 * a preview whose clicks reach the wrong block, silently.
 */
export interface Numberable {
  readonly path: Path;
  readonly role: string | null;
  readonly captures: string | null;
  readonly hidden: boolean;
  readonly at: number;
}

/**
 * The same nodes, each carrying which of its same-named siblings it is.
 *
 * ============================================================================
 * COUNTED PER STEP, AND ONLY OVER WHAT THE RENDERER DRAWS.
 * ============================================================================
 * The preview renders ONE step at a time and skips hidden nodes, so those are
 * the two things the DOM side can reproduce and the only two this may use. A
 * count that spanned the tree, or that included a hidden node, would put the
 * two sides one apart for every slot after it — and a mismatch there does not
 * throw: clicking a slot simply does nothing, forever
 * (`tests/js/builder-slots.test.ts`).
 *
 * The step is `path[0]`, which both walks agree on because both address a node
 * by the same path.
 */
export function numbered<T extends Numberable>(nodes: readonly T[]): T[] {
  const drawn = new Map<string, number>();

  return nodes.map((node) => {
    const name = node.role ?? node.captures;

    if (name === null || node.hidden) {
      return node;
    }

    const key = `${String(node.path[0])}/${name}`;
    const at = drawn.get(key) ?? 0;

    drawn.set(key, at + 1);

    return { ...node, at };
  });
}

function collect(node: TemplateNode, path: Path, slots: Slot[]): void {
  const leaf = LEAVES[node.type];

  if (leaf !== undefined) {
    const values: Record<string, unknown> = {};

    for (const key of leaf.content) {
      values[key] = (node as Record<string, unknown>)[key];
    }

    const role = (node as { role?: string }).role;
    const captures = (node as { name?: string }).name;

    slots.push({
      path,
      type: node.type,
      role: typeof role === 'string' ? role : null,
      captures: node.type === 'field' && typeof captures === 'string' ? captures : null,
      keys: leaf.content,
      values,
      hideable: leaf.params.includes('hidden'),
      hidden: (node as { hidden?: boolean }).hidden === true,
      // Filled in by {@link numbered} once the whole tree is collected, because
      // the count restarts per step and this walk is recursive.
      at: 0,
      /*
       * Read off `choices` and intersected with `params`, so a choice for a
       * setting the node does not declare draws no control — the vocabulary
       * would drop the key on the way in, and a control whose value is thrown
       * away at the boundary is worse than no control.
       * `TemplateLabelParityTest` fails on that pairing anyway; this is what
       * keeps the screen honest if it ever ships.
       */
      settings: Object.entries(leaf.choices ?? {})
        .filter(([param]) => leaf.params.includes(param))
        .map(([param, offered]) => ({
          param,
          offered,
          held: (node as Record<string, unknown>)[param],
          fallback: leaf.defaults?.[param],
        })),
    });

    return;
  }

  for (const key of childKeysOf(node.type)) {
    const children = (node as Record<string, unknown>)[key];

    if (Array.isArray(children)) {
      children.forEach((child, index) => collect(child as TemplateNode, [...path, key, index], slots));
    }
  }
}

/**
 * Where a node of this type keeps its children, or nothing where it keeps
 * none.
 *
 * The one answer to "can this hold anything", asked by the slot walk above and
 * by every function in `structure/`. `split` is the one with two, and it is
 * exactly the case a second copy of this would forget.
 */
export function childKeysOf(type: string): readonly string[] {
  const shape = LAYOUTS[type]?.children;

  if (shape === 'panes') {
    return PANES;
  }

  return shape === 'list' ? ['children'] : [];
}

/**
 * The same design with one slot changed.
 *
 * `undefined` clears the key rather than writing the word "undefined" — a
 * merchant who empties the alt text of a decorative image means it has none,
 * and the renderer already draws `alt=""` for exactly that.
 */
export function withValue(tree: TemplateTree, path: Path, key: string, value: unknown): TemplateTree {
  return editNode(tree, path, (node) => {
    const next = { ...node } as Record<string, unknown>;

    if (value === undefined || value === '') {
      delete next[key];
    } else {
      next[key] = value;
    }

    return next as TemplateNode;
  });
}

/** The same design with one slot switched on or off. */
export function withHidden(tree: TemplateTree, path: Path, hidden: boolean): TemplateTree {
  return editNode(tree, path, (node) => {
    const next = { ...node } as Record<string, unknown>;

    // Absent rather than `false`, because absent is what "shown" already
    // means — and a snapshot that carries `hidden: false` on every slot pays
    // for the flag on every page view of an Optin nobody hid anything on.
    if (hidden) {
      next.hidden = true;
    } else {
      delete next.hidden;
    }

    return next as TemplateNode;
  });
}

/**
 * The boxes a block sits inside, outermost first, ending with the block itself.
 *
 * ============================================================================
 * A SCOPE CHAIN IS WHAT MAKES "WHERE DOES THIS COLOUR COME FROM" ANSWERABLE.
 * ============================================================================
 * Since ADR 0062 any layout carries a `tokens` bag that applies to itself and
 * everything inside it, and custom properties inherit — so the value a leaf is
 * actually drawn with is the nearest bag above it that names the token, and
 * that is a walk the browser does for free and the editor cannot. A panel that
 * showed the design's value on a block sitting inside a cream box would be a
 * control naming a colour the visitor never sees.
 *
 * A path is `[step, key, index, key, index, …]`, so the ancestors are exactly
 * its odd-length prefixes. Only nodes that CAN carry a bag are returned: a
 * leaf's `tokens` is dropped on the way in, so a leaf in the chain would be a
 * scope nothing can ever be written to.
 */
export interface Scope {
  readonly path: Path;
  readonly type: string;
  readonly tokens: Tokens;
  /** The same bag again, for the narrow width (ADR 0064). */
  readonly narrow: Tokens;
}

/**
 * Which of a box's two bags is being read or written.
 *
 * ============================================================================
 * IT IS THE SAME CONTROLS AT A SECOND WIDTH, AND THAT IS WHY IT IS A MODE.
 * ============================================================================
 * A box carries `tokens` and, since ADR 0064, `narrow`. Twenty-four more
 * controls beside the twenty-four is a panel nobody can read; the same
 * twenty-four with a switch above them is one panel and one question — *which
 * width am I setting this for?*
 *
 * The switch is the preview's own width control, which is what makes the mode
 * legible: the merchant is looking at the narrow render while they edit the
 * narrow bag. Before this it moved the preview and changed nothing about what
 * was edited, so the two halves of the same question sat on one screen
 * pretending to be one.
 */
export type WidthBag = 'tokens' | 'narrow';

export function scopeChainOf(tree: TemplateTree, path: Path): Scope[] {
  const chain: Scope[] = [];

  for (let at = 1; at <= path.length; at += 2) {
    const here = path.slice(0, at);
    const node = nodeOf(tree, here);

    if (node !== null && (LAYOUTS[node.type] !== undefined || LEAVES[node.type] !== undefined)) {
      chain.push({
        path: here,
        type: node.type,
        tokens: node.tokens ?? {},
        narrow: (node as { narrow?: Tokens }).narrow ?? {},
      });
    }
  }

  return chain;
}

/**
 * What one box says about a token at one width.
 *
 * At the design's own width that is its `tokens` and nothing else. At narrow it
 * is `narrow` where the box names it there and `tokens` otherwise — the same
 * merge the renderer mirrors (ADR 0064), so the panel answers what a visitor
 * on a phone actually sees rather than what the narrow bag happens to spell.
 */
const heldBy = (scope: Scope, name: string, width: WidthBag): string | undefined =>
  width === 'narrow' && scope.narrow[name] !== undefined && scope.narrow[name] !== ''
    ? scope.narrow[name]
    : scope.tokens[name];

/**
 * The node one path names, or null.
 *
 * **`structure/tree.ts` has this too, and it is not imported.** That module
 * imports THIS one for the vocabulary, so reaching back would be a cycle
 * between the two files every other module in the editor depends on. Six lines
 * against an import cycle is the right trade, and the walk is the path's own
 * shape rather than a rule either file invented.
 */
function nodeOf(tree: TemplateTree, path: Path): (TemplateNode & { tokens?: Tokens }) | null {
  const [step, ...rest] = path;
  let node = (typeof step === 'number' ? tree.steps[step] : undefined) ?? null;

  for (let at = 0; at < rest.length && node !== null; at += 2) {
    const children = typeof rest[at] === 'string' ? (node as Record<string, unknown>)[rest[at]] : null;
    const index = rest[at + 1];

    node = Array.isArray(children) && typeof index === 'number'
      ? ((children[index] as TemplateNode | undefined) ?? null)
      : null;
  }

  return node;
}

/**
 * Where a token's value comes from at one place in the tree.
 *
 * `here` is this block's own bag, `scope` is the nearest box above it that
 * names the token, `design` is the Optin's own token map, and `default` is what
 * the manifest declares. The four are the whole answer, and the panel prints
 * the middle two because those are the ones a merchant cannot see.
 */
export interface TokenSource {
  /**
   * Where the value came from.
   *
   * `here` is this block's own bag at the design's own width, `narrow` is its
   * own bag at the narrow one, `scope` is the nearest box above it that names
   * the token, `design` is the Optin's own token map, and `default` is what the
   * manifest declares.
   *
   * **`narrow` and `here` are told apart on purpose**, and only one of them can
   * be reached at a time: at the design's own width there is no narrow value to
   * report, and at narrow a value inherited from the box's OWN wide bag is
   * still *set here* — just not for this width, which is a different sentence
   * and a different reset.
   */
  readonly from: 'here' | 'narrow' | 'scope' | 'design' | 'default';
  readonly value: string;
  /** The box it came from, where `from` is `scope`. */
  readonly scope?: Scope;
}

export function sourceOfToken(
  chain: readonly Scope[],
  tokens: Readonly<Record<string, string>>,
  name: string,
  width: WidthBag = 'tokens',
): TokenSource {
  for (let at = chain.length - 1; at >= 0; at -= 1) {
    const scope = chain[at];
    const held = scope === undefined ? undefined : heldBy(scope, name, width);

    if (held !== undefined && held !== '') {
      if (at < chain.length - 1) {
        return { from: 'scope', value: held, scope };
      }

      const narrow = width === 'narrow' && scope?.narrow[name] !== undefined && scope.narrow[name] !== '';

      return { from: narrow ? 'narrow' : 'here', value: held };
    }
  }

  const design = tokens[name];

  return design !== undefined && design !== ''
    ? { from: 'design', value: design }
    : { from: 'default', value: resolvedToken(tokens, name) };
}

/**
 * The same design with one token set on ONE BOX, or cleared back to whatever it
 * sits inside.
 *
 * **An emptied bag leaves no key**, which is the same rule
 * {@see \WConvert\Template\TemplateVocabulary} applies on the way in: a design
 * whose bag kept nothing is byte-identical to one that carries none, so undoing
 * every scoped edit gets the merchant back to exactly the tree they started
 * with rather than to one carrying `"tokens": {}` on three boxes.
 */
/**
 * The same design with one box's WHOLE bag replaced.
 *
 * What *Paste this look* writes. It replaces rather than merges for the reason
 * a design switch takes a fresh snapshot rather than reconciling two: a merge
 * leaves whatever the target already set and produces a box that is neither
 * what was copied nor what was there, which is a state nothing on screen can
 * explain. Undo pays for the bluntness, the same bargain a block delete makes.
 *
 * An empty bag clears the key, exactly as {@see withScopeToken} does.
 */
export function withScopeBag(
  tree: TemplateTree,
  path: Path,
  tokens: Tokens,
  width: WidthBag = 'tokens',
): TemplateTree {
  return withValue(tree, path, width, Object.keys(tokens).length === 0 ? undefined : { ...tokens });
}

export function withScopeToken(
  tree: TemplateTree,
  path: Path,
  name: string,
  value: string,
  width: WidthBag = 'tokens',
): TemplateTree {
  const node = nodeOf(tree, path) as { tokens?: Tokens; narrow?: Tokens } | null;
  const bag = withToken((width === 'narrow' ? node?.narrow : node?.tokens) ?? {}, name, value);

  return withValue(tree, path, width, Object.keys(bag).length === 0 ? undefined : bag);
}

/** The same design with one token set, or cleared back to the template's own. */
export function withToken(tokens: Tokens, name: string, value: string): Tokens {
  const next = { ...tokens };

  if (value === '') {
    delete next[name];
  } else {
    next[name] = value;
  }

  return next;
}

/**
 * Rebuild the tree down one path, replacing the node at the end of it.
 *
 * Structural sharing everywhere else: React re-renders the preview from the
 * tree, and a wholesale copy would make every slot look changed on every
 * keystroke.
 */
function editNode(tree: TemplateTree, path: Path, edit: (node: TemplateNode) => TemplateNode): TemplateTree {
  const [index, ...rest] = path;

  if (typeof index !== 'number') {
    return tree;
  }

  return {
    steps: tree.steps.map((step, at) => (at === index ? replace(step, rest, edit) : step)),
  };
}

function replace(node: TemplateNode, path: Path, edit: (node: TemplateNode) => TemplateNode): TemplateNode {
  const [key, index, ...rest] = path;

  if (typeof key !== 'string' || typeof index !== 'number') {
    return edit(node);
  }

  const children = (node as Record<string, unknown>)[key];

  if (!Array.isArray(children)) {
    return node;
  }

  return {
    ...node,
    [key]: children.map((child, at) => (at === index ? replace(child as TemplateNode, rest, edit) : child)),
  } as TemplateNode;
}

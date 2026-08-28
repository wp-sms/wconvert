/**
 * The template vocabulary, as types.
 *
 * A Template is **configuration, not a document** (ADR 0010): a JSON node tree
 * plus a token set, carrying no HTML and no CSS. Nothing in here can express
 * markup, which is what makes "content, never capability" a shape rather than
 * a rule enforced at a boundary — there is nothing for `wp_kses` to sanitise.
 *
 * The vocabulary is CLOSED and its members are duplicated in
 * `resources/templates/manifest.json`, which PHP reads to validate a tree on
 * the way in. The loader does NOT import that manifest — a whole-manifest
 * import inlines it into the byte budget for a lookup the renderer does not
 * need, since an unrecognised node is skipped structurally. `tests/js/
 * renderer-manifest-parity.test.ts` is what stops the two drifting, the same
 * arrangement the rule manifest has.
 */

/**
 * The semantic name of a slot, unique across a Template's whole tree
 * (CONTEXT.md, Slot Role). It is the seam a Playbook binds copy to, so the
 * words survive switching Template.
 */
export type SlotRole =
  | 'headline'
  | 'body'
  | 'fine_print'
  | 'cta_label'
  | 'consent_text'
  | 'success_headline'
  | 'success_body'
  | 'email_label'
  | 'email_placeholder'
  | 'name_label'
  | 'name_placeholder'
  | 'phone_label'
  | 'phone_placeholder';

/** What a `field` captures. Closed, because the capture path canonicalises per kind. */
export type FieldName = 'email' | 'name' | 'phone';

/**
 * A link inside a sentence, expressed as STRUCTURE rather than markup
 * (ADR 0013). The renderer splits the text on `%s` and constructs the `<a>`
 * itself, so no code path ever reaches `innerHTML`.
 *
 * `href` is optional because the privacy-policy link is resolved by the site
 * rather than carried by the template: with no policy configured the link
 * renders nothing, never a dead `#` (ADR 0032).
 */
export interface SlotLink {
  readonly label: string;
  readonly href?: string | null;
}

interface BaseNode {
  readonly type: string;
  readonly role?: SlotRole;
}

/**
 * A slot the settings panel may switch off.
 *
 * ============================================================================
 * HIDING AND REMOVING ARE TWO ACTS, AND `hidden` IS THE REVERSIBLE ONE.
 * ============================================================================
 * This was once the reason the admin needed no way to add or remove a node at
 * all: the settings panel edits words, visibility and tokens and never
 * arrangement (ADR 0010), so a merchant who did not want the fine print hid it.
 * The structure editor changed that — it collects ADR 0010's own escape clause,
 * landing as an editor over a tree that already exists — and `hidden` did not
 * become redundant when it did.
 *
 * Hidden is undone by the merchant on the Content tab, at any time, and the node
 * still rides the payload. Removed is undone by Undo while the screen is open,
 * and the node is gone from what the site serves. A `consent` node still ships
 * hidden, which is how ADR 0032's "off by default" survives an editor that could
 * otherwise have been expected to make the merchant add one.
 *
 * **`button` and `field` do NOT extend this, deliberately.** Hiding the button
 * that converts leaves an Optin with no countable act, which is exactly what
 * `TemplateLibrary` refuses at registration; hiding a required field leaves a
 * form the capture endpoint refuses every submission of. Neither declares
 * `hidden` in `resources/templates/manifest.json` either, so PHP drops the key
 * on the way in and the state is not merely disallowed but inexpressible —
 * enforcement by non-registration, one layer down from where ADR 0015 puts it.
 *
 * **That non-registration was also the whole of the enforcement, and a Delete
 * key reaches what `hidden` could not express.** So the same refusal is now
 * asked at the write, by
 * `WConvert\Rest\OptinController::refuseADesignThatCannotConvert()`, and
 * prevented on the screen by `builder/structure/guards.ts`.
 */
interface HideableNode extends BaseNode {
  /** Absent and `false` are the same thing: shown. */
  readonly hidden?: boolean;
}

export interface HeadingNode extends HideableNode {
  readonly type: 'heading';
  readonly text?: string;
  /** Heading rank inside the Optin, 1 or 2. Not a size — size is a token. */
  readonly level?: 1 | 2;
}

export interface TextNode extends HideableNode {
  readonly type: 'text';
  readonly text?: string;
  readonly link?: SlotLink;
}

export interface ImageNode extends HideableNode {
  readonly type: 'image';
  readonly src?: string;
  readonly alt?: string;
  readonly fit?: 'cover' | 'contain';
}

export interface FieldNode extends BaseNode {
  readonly type: 'field';
  readonly name?: FieldName;
  readonly label?: string;
  readonly placeholder?: string;
  readonly required?: boolean;
}

export interface ButtonNode extends BaseNode {
  readonly type: 'button';
  readonly label?: string;
  /**
   * The converting act. One Optin has exactly one, and a Template offering
   * both a `submit` and a `link` is rejected at registration rather than
   * disambiguated at runtime (CONTEXT.md, Conversion).
   */
  readonly action?: 'submit' | 'link';
  readonly href?: string | null;
}

/**
 * The opt-in consent checkbox — a node in the vocabulary rather than a field
 * the merchant remembers to add, because one the merchant remembers to add is
 * one the merchant forgets (ADR 0032). Off by default, required once present,
 * and enforced server-side, which lands with capture.
 */
export interface ConsentNode extends HideableNode {
  readonly type: 'consent';
  readonly text?: string;
  readonly link?: SlotLink;
}

export type LeafNode = HeadingNode | TextNode | ImageNode | FieldNode | ButtonNode | ConsentNode;

export interface StackNode {
  readonly type: 'stack';
  readonly children?: readonly TemplateNode[];
}

export interface RowNode {
  readonly type: 'row';
  readonly children?: readonly TemplateNode[];
}

/**
 * Two panes side by side, each holding its own children, stacking below a
 * narrow width. This is the layout `image` needs to be a differentiator rather
 * than decoration — twelve text-only designs read as one design twelve times
 * (ADR 0010).
 */
export interface SplitNode {
  readonly type: 'split';
  readonly start?: readonly TemplateNode[];
  readonly end?: readonly TemplateNode[];
  /** How much of the inline axis the first pane takes, as a fraction. */
  readonly ratio?: number;
}

export interface GridNode {
  readonly type: 'grid';
  readonly children?: readonly TemplateNode[];
  readonly columns?: 2 | 3;
}

export type LayoutNode = StackNode | RowNode | SplitNode | GridNode;

/**
 * Any node. `{ type: string }` is deliberately part of the union: a snapshot
 * taken before a vocabulary change carries node types this build has never
 * heard of, and the renderer SKIPS them rather than throwing — which is what
 * lets a snapshot outlive the vocabulary it was drawn from (ADR 0010).
 */
export type TemplateNode = LayoutNode | LeafNode | { readonly type: string };

/**
 * A template's whole tree.
 *
 * `steps[]`, and how many follows from the metric: a **submit-metered**
 * template has two, the post-submit success state being a terminal step; a
 * **click-metered** one has one, because the click navigates the visitor away
 * and an interstitial is worse than the navigation it delays (ADR 0025).
 *
 * Terminal is structural — it is the last step — rather than a flag, so there
 * is no second spelling of the same fact to keep in step.
 */
export interface TemplateTree {
  readonly steps: readonly TemplateNode[];
}

/**
 * A template's token values, keyed by token name.
 *
 * They ride the payload and land as custom properties on the first element
 * INSIDE the shadow host, at roughly 80 bytes gzipped each — which is what
 * makes configuration cheap where a document-model template's own stylesheet
 * was not (ADR 0010).
 */
export type Tokens = Readonly<Record<string, string>>;

/** A whole design: the snapshot an Optin takes of its Template. */
export interface Template {
  readonly tree: TemplateTree;
  readonly tokens: Tokens;
}

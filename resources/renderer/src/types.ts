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

/** The four closed layouts. Anything else in a tree is skipped, not thrown on. */
export type LayoutType = 'stack' | 'row' | 'split' | 'grid';

/** The six leaf nodes. */
export type LeafType = 'heading' | 'text' | 'image' | 'field' | 'button' | 'consent';

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

export interface HeadingNode extends BaseNode {
  readonly type: 'heading';
  readonly text?: string;
  /** Heading rank inside the Optin, 1 or 2. Not a size — size is a token. */
  readonly level?: 1 | 2;
}

export interface TextNode extends BaseNode {
  readonly type: 'text';
  readonly text?: string;
  readonly link?: SlotLink;
}

export interface ImageNode extends BaseNode {
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
export interface ConsentNode extends BaseNode {
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

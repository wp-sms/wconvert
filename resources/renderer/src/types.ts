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
 * The semantic name of a slot (CONTEXT.md, Slot Role). It is the seam a
 * Playbook binds copy to, so the words survive switching Template.
 *
 * **Closed, and no longer unique** (ADR 0051). A design may claim `body` three
 * times and a Playbook fills them in tree order; what stays closed is the list
 * of names, because binding is BY NAME and that is the whole guarantee. The
 * uniqueness that used to be here was enforced by a silent key-drop on the way
 * in, and what it cost was an empty `<p>` in front of a visitor for every slot
 * past the first.
 */
export type SlotRole =
  | 'headline'
  | 'body'
  | 'fine_print'
  | 'eyebrow'
  | 'badge'
  | 'rating_text'
  | 'cta_label'
  | 'consent_text'
  | 'success_headline'
  | 'success_body'
  | 'code_value'
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
  /**
   * A name for this node's words, stable across every rearrangement.
   *
   * ==========================================================================
   * NOTHING IN THE RENDERER READS THIS, AND IT IS ON THE PAYLOAD ANYWAY.
   * ==========================================================================
   * It exists for translation. WPML and Polylang both register a string by a
   * NAME — `wpml_register_single_string(context, name, value)` — and a string
   * named by its position in `steps[]` moves the moment the merchant reorders
   * their design, attaching the French headline to the fine print. So a leaf
   * carries `n1`, `n2`, and the name becomes `optin-01HA/n3.text`.
   *
   * That translation happens in PHP, before the payload is built, so the loader
   * genuinely never needs it. It rides along because stripping it would mean a
   * second walk of every tree on every page build to save bytes the budget has
   * (`tests/unit/Frontend/PayloadBudgetTest.php`), and because the id is what a
   * later feature — an inspector naming a block, a per-block override — would
   * address a node by from the browser.
   *
   * **The renderer must never mint one, and neither may the admin.** They are
   * minted on the way in by `WConvert\Template\NodeIdentities`, which is what
   * makes them unique across the whole tree and stable across a save (ADR 0010, amended).
   * Layouts carry none: an id names a string, and a `stack` says nothing.
   */
  readonly id?: string;
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

/**
 * The small line above a heading — *LIMITED TIME*, *NEW IN*.
 *
 * A node of its own rather than a `text` with a token on it, because what makes
 * it an eyebrow is the TYPOGRAPHY: small, spaced, upper case, quiet. A merchant
 * cannot express that by typing, and a design that wanted one had to spend its
 * one `body` slot on a word.
 */
export interface EyebrowNode extends HideableNode {
  readonly type: 'eyebrow';
  readonly text?: string;
}

/**
 * A short word on a coloured chip — *50% OFF*, *BESTSELLER*.
 *
 * The eyebrow's louder sibling, and the distinction is worth keeping: an
 * eyebrow is a label ABOVE something, a badge is a thing stuck ON something.
 * Both are one short string, and neither can be drawn out of the six leaves
 * this vocabulary had.
 */
export interface BadgeNode extends HideableNode {
  readonly type: 'badge';
  readonly text?: string;
  /**
   * Where it sits: in the flow, or pinned to the panel's own corner.
   *
   * ==========================================================================
   * THE ONE PLACEMENT NO TOKEN CAN REACH, AT ANY SCOPE, AND IT IS ONE VALUE.
   * ==========================================================================
   * A design's look is a closed set of token NAMES, and since ADR 0062 any
   * layout may re-declare them for what is inside it. Scoping answered *where a value
   * applies*; it does not add a value that pins a node to a corner, because
   * no token spells position — and the corner flash (*"50% OFF"* over the
   * top edge of an offer panel) is the single most recognisable element in this
   * genre. `inline` is what a badge has always done and stays the default, so
   * every shipped design renders byte-identically without it.
   *
   * `corner` positions against `.wc-root`, which is already `position:
   * relative`. It is the block-start/inline-end corner in LOGICAL properties,
   * so an `fa_IR` site gets the corner that side of the page actually has
   * (ADR 0009) with no second spelling.
   */
  readonly place?: 'inline' | 'corner';
}

/**
 * A rule between two parts of a design.
 *
 * The one leaf with nothing to say, which is why it carries no copy key and no
 * [[Slot Role]]. It exists because `gap` is the only separation the vocabulary
 * had, and a design that wants a line has no way to ask for one.
 */
export interface DividerNode extends HideableNode {
  readonly type: 'divider';
}

/**
 * Stars, and optionally what they are for — *"from 2,000 reviews"*.
 *
 * **Whole stars only, and never a number the merchant types.** Half stars need
 * a clip path and buy a design nothing; and a rating a template could set to
 * any value is a claim about a business this plugin cannot check. Three, four
 * or five is a design choice about a shape, and the words beside it are the
 * merchant's to make true.
 */
export interface RatingNode extends HideableNode {
  readonly type: 'rating';
  /** How many of the five are filled. Absent is five. */
  readonly value?: 3 | 4 | 5;
  readonly text?: string;
}

/**
 * The time left, counting down to the Optin's own schedule end.
 *
 * ============================================================================
 * IT CARRIES NO DEADLINE, AND THAT IS THE ENTIRE DESIGN.
 * ============================================================================
 * A countdown node has no `until`, no `minutes` and no `evergreen` flag,
 * because the deadline it counts to is the [[Optin]]'s `ends_at` and nothing
 * else (ADR 0052). The merchant authors one wall time on the Rules tab, the
 * server resolves it once against `wp_timezone()`, and the payload carries one
 * absolute instant in milliseconds — which is exactly a cache-proof target, and
 * the reason the classic bug in this genre (a seconds-remaining value baked
 * into a cached page and wrong for every visitor after the first) is not
 * expressible here.
 *
 * Binding it also gives the deadline a CONSEQUENCE for free: at `ends_at` the
 * Optin leaves its window, shows nothing and records no Impression. *"A
 * deadline with no consequence is just a clock"*, and a timer that a merchant
 * can set independently of the schedule is how an offer keeps working after
 * zero.
 *
 * **A tree is still pure.** The renderer draws the shape and no time at all;
 * the tick lives in `mount()`'s `shell()`, which every container shares and
 * which dies with the mount — so a preview rebuilt on every keystroke leaks
 * nothing and `render()` stays a function of (tree, tokens).
 */
export interface CountdownNode extends HideableNode {
  readonly type: 'countdown';
}

/**
 * The static shared code the offer pays out in — *"WELCOME10"*.
 *
 * ============================================================================
 * ONE CODE, THE SAME FOR EVERY VISITOR, WHICH IS THE ONLY KIND THAT EXISTS.
 * ============================================================================
 * [ADR 0025](../../../docs/adr/0025-cart-recovery-captures-nothing.md) settles
 * what a code may be here, and it settles it in favour of this node:
 *
 * > *only a static shared code can ever appear, and a static code the merchant
 * > already created in WooCommerce is just words they type into the copy.*
 *
 * The payload is baked into HTML the full-page cache serves **byte-identically
 * to every visitor**, so a per-visitor code is impossible in this delivery
 * model rather than merely unwise. This node is the shape that fact leaves
 * behind: one string, drawn identically for everyone, minted by nobody. It
 * therefore does NOT reopen
 * [ADR 0053](../../../docs/adr/0053-the-spin-to-win-card-is-withdrawn.md) —
 * the wheel was withdrawn because a prize wheel needs a code PER VISITOR, and
 * this is the opposite of one.
 *
 * **Why it is a node and not a `text`.** A code has to look like a code — a
 * boxed, letter-spaced, selectable string a visitor can read off a phone
 * screen and retype — and the only lever `text` has is `--wc-font`, which is
 * global and would set the whole design in monospace to box one word. Before
 * this, the success step had nowhere to put the payout except inside
 * `success_body` prose, which is where a code is least readable and least
 * copyable.
 *
 * **It is deliberately not a button, and there is no copy-to-clipboard.**
 * `navigator.clipboard` is capability, and this vocabulary's whole claim is
 * that it expresses content and never capability (ADR 0010). The element is
 * `user-select: all` instead, so one tap or click selects the whole code —
 * which is the affordance a visitor actually reaches for, and it costs the
 * renderer no event handler and the loader no bytes.
 *
 * **A Playbook cannot fill this**, and that is correct rather than a gap. A
 * coupon code names a row on one particular site, and a Playbook can express
 * nothing site-local (ADR 0013) — so the code arrives the way the cart URL and
 * the privacy link do: the design ships a placeholder, and the merchant types
 * theirs into the settings panel.
 */
export interface CodeNode extends HideableNode {
  readonly type: 'code';
  readonly text?: string;
}

/**
 * One glyph from a closed set of six.
 *
 * ============================================================================
 * CLOSED, BECAUSE AN OPEN ICON SLOT IS A MARKUP SLOT WEARING A HAT.
 * ============================================================================
 * The obvious alternative is an `src` like `image` has, and it is the wrong
 * shape twice: an SVG from off-site is exactly the remote asset ADR 0013 keeps
 * out of the payload, and an inline one is markup in a vocabulary whose whole
 * claim is that it cannot express any (ADR 0010). A closed set is drawn by the
 * renderer from paths it owns, so there is nothing to sanitise and nothing to
 * fetch.
 *
 * Six is what a lead-capture design actually reaches for: a tick for a benefit
 * list, a star for proof, a bolt for speed, a gift for an offer, a clock for a
 * deadline, a van for delivery.
 */
export interface IconNode extends HideableNode {
  readonly type: 'icon';
  readonly name?: 'check' | 'star' | 'bolt' | 'gift' | 'clock' | 'truck';
}

export interface ImageNode extends HideableNode {
  readonly type: 'image';
  readonly src?: string;
  readonly alt?: string;
  readonly fit?: 'cover' | 'contain';
  /**
   * A rectangle, or a circle.
   *
   * ==========================================================================
   * `radius` IS GLOBAL, SO AN AVATAR WAS NOT EXPRESSIBLE AT ANY VALUE OF IT.
   * ==========================================================================
   * `.wc-image` takes `border-radius: var(--wc-radius)` — the design's ONE
   * corner, shared with the panel, the button and every input. So the round
   * portrait beside a testimonial could only be had by rounding the popup, the
   * button and the email box to match, which is a different design rather than
   * the same design with an avatar in it.
   *
   * A `shape` param is the narrow fix: one value, on the one node it is about,
   * changing nothing else. `rect` is what an image has always been and stays
   * the default.
   *
   * **It is not `border-radius: 50%` with a free value.** A circle is a shape a
   * design either wants or does not; a number here would be a second corner
   * token in the wrong place, arguing with `radius` about the same picture.
   */
  readonly shape?: 'rect' | 'circle';
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

export type LeafNode =
  | HeadingNode
  | TextNode
  | EyebrowNode
  | BadgeNode
  | DividerNode
  | CountdownNode
  | CodeNode
  | RatingNode
  | IconNode
  | ImageNode
  | FieldNode
  | ButtonNode
  | ConsentNode;

export interface StackNode {
  readonly type: 'stack';
  readonly children?: readonly TemplateNode[];
  /**
   * Tokens re-declared for this box and everything inside it.
   *
   * The names are the same ones the design sets; what a bag adds is an answer
   * to WHERE. Custom properties inherit, so a `stack` carrying `{"bg":"#fff4df"}`
   * paints its own ground and its children's and leaves the rest of the design
   * alone — which is how one design holds a cream panel beside a dark one
   * without a second stylesheet (ADR 0062).
   *
   * Closed at both scopes by one `TemplateVocabulary::tokens()`, so an
   * undeclared name never reaches `style.setProperty`.
   */
  readonly tokens?: Tokens;
}

export interface RowNode {
  readonly type: 'row';
  readonly children?: readonly TemplateNode[];
  /**
   * Tokens re-declared for this box and everything inside it.
   *
   * The names are the same ones the design sets; what a bag adds is an answer
   * to WHERE. Custom properties inherit, so a `stack` carrying `{"bg":"#fff4df"}`
   * paints its own ground and its children's and leaves the rest of the design
   * alone — which is how one design holds a cream panel beside a dark one
   * without a second stylesheet (ADR 0062).
   *
   * Closed at both scopes by one `TemplateVocabulary::tokens()`, so an
   * undeclared name never reaches `style.setProperty`.
   */
  readonly tokens?: Tokens;
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
  /**
   * Tokens re-declared for this box and everything inside it.
   *
   * The names are the same ones the design sets; what a bag adds is an answer
   * to WHERE. Custom properties inherit, so a `stack` carrying `{"bg":"#fff4df"}`
   * paints its own ground and its children's and leaves the rest of the design
   * alone — which is how one design holds a cream panel beside a dark one
   * without a second stylesheet (ADR 0062).
   *
   * Closed at both scopes by one `TemplateVocabulary::tokens()`, so an
   * undeclared name never reaches `style.setProperty`.
   */
  readonly tokens?: Tokens;
}

/**
 * As many equal columns as fit, wrapping by construction.
 *
 * ============================================================================
 * IT CAME BACK WITH THE SHAPE THAT GOT IT DELETED TAKEN OUT OF IT.
 * ============================================================================
 * The `grid` this replaces declared `repeat(columns, 1fr)` — equal tracks,
 * always N across — which is the wrong shape for the surface this vocabulary
 * draws on: a popup is `min(28rem, 100%)` wide, so a two-column grid stayed two
 * columns at 320px and handed a phone two 140px columns of prose. It also had a
 * `columns` param no control in the admin ever reached, so no merchant could
 * have made it a three-column anything, and no shipped design used it. A layout
 * that cannot be configured and is demonstrated by nothing is a word in a menu.
 *
 * `repeat(auto-fit, minmax(8rem, 1fr))` is the same idea with the failure
 * removed. Three across on a desktop, one per line on a phone, **no media query
 * and no param to misconfigure** — the browser counts the columns from the
 * space it actually has. So the param that was the problem is gone rather than
 * fixed, which is why this is a different layout wearing the old name.
 *
 * It earns its place beside `split`, which is hard-coded to exactly two panes:
 * a three-up of benefits is not expressible any other way, and three benefits
 * is what a benefit list has.
 */
export interface GridNode {
  readonly type: 'grid';
  readonly children?: readonly TemplateNode[];
  /**
   * Tokens re-declared for this box and everything inside it.
   *
   * The names are the same ones the design sets; what a bag adds is an answer
   * to WHERE. Custom properties inherit, so a `stack` carrying `{"bg":"#fff4df"}`
   * paints its own ground and its children's and leaves the rest of the design
   * alone — which is how one design holds a cream panel beside a dark one
   * without a second stylesheet (ADR 0062).
   *
   * Closed at both scopes by one `TemplateVocabulary::tokens()`, so an
   * undeclared name never reaches `style.setProperty`.
   */
  readonly tokens?: Tokens;
}

/**
 * A stack that PAINTS — the box a scoped bag is visible in.
 *
 * ============================================================================
 * THE OTHER FOUR ARRANGE. THIS ONE IS A SURFACE.
 * ============================================================================
 * A `stack` with `{"bg":"#fff4df"}` re-declares the token for everything
 * inside it, and nothing draws it: `.wc-stack` paints no background, so the
 * cream is inherited by children that happen to read `--wc-bg` and by nothing
 * else. A `panel` reads the properties in scope and draws the box — ground,
 * picture, padding, corner, edge — which is what a scoped bag was for
 * (ADR 0062).
 *
 * **`media` is not a second member, and that is deliberate.** A photo pane is
 * a `panel` carrying `bg-image`, `overlay` and `min`. A second layout would
 * have added a child-key shape to four files and a branch to a hardcoded test;
 * what it buys is content spread top-and-bottom rather than stacked, which is
 * a `spread` param the day a design needs it.
 */
export interface PanelNode {
  readonly type: 'panel';
  readonly children?: readonly TemplateNode[];
  /**
   * Tokens re-declared for this box and everything inside it — and, on a
   * panel, the ones it DRAWS.
   *
   * {@see StackNode.tokens} for what a bag is. The difference here is only
   * that something reads them: `.wc-panel` paints `bg`, `bg-image`, `overlay`,
   * `pad`, `radius` and `fg`, so the bag is visible on the box rather than only
   * on what is inside it.
   */
  readonly tokens?: Tokens;
  /**
   * A rule above, an outline all round, or neither.
   *
   * A modifier attribute rather than a custom property, exactly as
   * `badge.place` is a modifier class: the stylesheet may read no `--wc-*` name
   * outside the tokens and the declared layout params, and three states is not
   * a scale. `none` writes no attribute, so absent renders identically to
   * declared.
   */
  readonly edges?: 'none' | 'block-start' | 'all';
  /**
   * A floor under the panel's height, so a photo pane does not collapse to its
   * content. On a scale, so it IS a custom property — the same shape
   * `split.ratio` has.
   */
  readonly min?: string | number;
}

export type LayoutNode = StackNode | RowNode | SplitNode | GridNode | PanelNode;

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
  /**
   * Which vocabulary wrote this tree.
   *
   * ==========================================================================
   * NOTHING IN THE RENDERER READS THIS EITHER, AND FOR A DIFFERENT REASON.
   * ==========================================================================
   * `id` rides along because stripping it would cost a second walk; this rides
   * along because it is the whole point. A snapshot outlives the vocabulary it
   * was drawn from, and until now had no way to say WHICH one — which is fine
   * while the vocabulary only ever widens, and is unrecoverable the first time
   * something is renamed or a choice list is tightened.
   *
   * Optional in the type because a tree written before the key existed is
   * still a tree, and the renderer's whole posture toward an unrecognised
   * anything is to carry on. It is minted in PHP by
   * `WConvert\Template\TemplateTree::stamped()`, on every path that builds a
   * tree, and **the renderer and the admin must never mint one** — the same
   * rule `id` has, for the same reason.
   */
  readonly v?: number;
}

/**
 * A template's token values, keyed by token name.
 *
 * They ride the payload and land as custom properties on the first element
 * INSIDE the shadow host, at roughly 80 bytes gzipped each — which is what
 * makes configuration cheap where a document-model template's own stylesheet
 * was not (ADR 0010).
 *
 * The same type is what a LAYOUT carries in its own `tokens` bag. There is one
 * set of names and one closure over it; the only difference between the design
 * bag and a node's is which element the properties land on, and inheritance
 * does the rest (ADR 0062).
 */
export type Tokens = Readonly<Record<string, string>>;

/** A whole design: the snapshot an Optin takes of its Template. */
export interface Template {
  readonly tree: TemplateTree;
  readonly tokens: Tokens;
}

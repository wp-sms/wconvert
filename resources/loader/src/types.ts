/**
 * The loader's vocabulary.
 *
 * Two shapes carry the whole design. A LOADER MODULE is a build-time unit of
 * loader behaviour — one rule type, its declared manifest fields, and a factory
 * that instantiates it for one page view. A RULE EVALUATOR is what that factory
 * returns: `holds()` answers for RIGHT NOW, and `stop()` detaches whatever the
 * module attached.
 *
 * A module is deliberately NOT a runtime registration seam: ADR 0014 rejected
 * `registerRule` and every shape like it, because a second script that must
 * register before the first evaluates is exactly the silent failure ADR 0004
 * catalogued. Composition happens where the bundler can see it, in an entry
 * file, and the page never has two scripts to reorder.
 *
 * WHY A FACTORY RATHER THAN A PURE `holds(rule, signals)`. Three properties
 * fall out of it that a shared signals object has to be engineered for:
 *
 * - **Lazy subscription.** Only modules whose type appears in this page's
 *   payload are instantiated, so the scroll listener and the timer are never
 *   attached on a page whose Optins do not need them.
 * - **Instant semantics.** `holds()` reads live, so a Condition is answered at
 *   the moment a Trigger fires and can never be evaluated ahead and held.
 * - **The free/Pro boundary.** Pro's `exit_intent` brings its own listener and
 *   its own state without free's types naming a signal free does not produce.
 *   A shared `Signals` interface in free's tree would have to (ADR 0028).
 */

import type { Template } from '@renderer/types';

/** WHEN it fires, or WHETHER the visitor is eligible. Fixed per type (ADR 0005). */
export type RuleKind = 'trigger' | 'condition';

/** The WP Consent API's five categories, adopted verbatim (CONTEXT.md, Storage Consent). */
export type ConsentCategory =
  | 'functional'
  | 'statistics-anonymous'
  | 'statistics'
  | 'preferences'
  | 'marketing';

/**
 * One `{type, scalar}` entry. Flat, closed, never nested — the real OR cases
 * are set-valued scalars like `{"type":"device","in":["mobile","tablet"]}`
 * (ADR 0005).
 */
export interface Rule {
  readonly type: string;
  readonly [param: string]: unknown;
}

/** One rule type, live for one page view. */
export interface RuleEvaluator {
  /** Does this rule hold RIGHT NOW? Never a cached answer. */
  holds(rule: Rule): boolean;
  /** Detach anything `create` attached. Absent when there was nothing to attach. */
  stop?(): void;
}

export interface LoaderModule {
  /** The rule type. Matches its manifest key, and is unique across free's modules and Pro's. */
  readonly id: string;
  /** Duplicated from the manifest; `tests/js/manifest-parity.test.ts` asserts they agree. */
  readonly kind: RuleKind;
  /** Null means this rule neither reads nor writes the visitor's device. */
  readonly consentCategory: ConsentCategory | null;
  /**
   * Instantiate for one page view. `changed` asks the shell to decide again —
   * call it when this module's own signal moves, never on a timer of the
   * shell's choosing.
   */
  create(changed: () => void): RuleEvaluator;
}

/** A composed loader: the module set an entry point assembled. */
export interface Loader {
  readonly modules: readonly LoaderModule[];
}

/**
 * The allowance, checked before any rule (issue #3). A fourth top-level field
 * rather than a rule, because it is not a question about this page view.
 */
export interface Frequency {
  readonly maxImpressions?: number;
  readonly cooldownDays?: number;
  readonly stopAfterDismiss?: boolean;
  /** Defaults to TRUE. Converting is the strongest "stop showing me this" there is. */
  readonly stopAfterConversion?: boolean;
}

/**
 * One Optin as it reaches the browser: already narrowed to this page by
 * Targeting on the server, already partitioned into its two client axes at
 * publish time (ADR 0005).
 */
export interface PayloadEntry {
  readonly id: string;
  readonly display_type?: string;
  /**
   * The Optin's COPY of its Template — tree and tokens, snapshotted when the
   * Template was picked. The renderer and the vocabulary stay a live
   * reference, so an accessibility or RTL fix reaches every existing Optin and
   * a restyle reaches none (ADR 0010).
   */
  readonly template?: Template | null;
  readonly priority?: number;
  readonly triggers?: readonly Rule[];
  readonly conditions?: readonly Rule[];
  readonly frequency?: Frequency;
  /**
   * The window the merchant scheduled, as **absolute instants in
   * milliseconds** — never the local date and time they typed.
   *
   * Resolved once, on the server, against the site's timezone
   * ({@link ../../../src/Optin/Schedule.php}), because the visitor's clock is
   * not the site's clock: a payload carrying a wall time would mean a
   * different moment in every browser that read it. `schedule.ts` compares
   * these to `Date.now()` and the loader names no timezone anywhere.
   *
   * Absent means unbounded on that side. A start with no end and an end with
   * no start are both things merchants mean.
   */
  readonly starts_at?: number;
  readonly ends_at?: number;
  /**
   * Where an `inline` Optin renders, when that is **not its own id**.
   *
   * `inline` is the one Display Type that needs somewhere on the page to go,
   * and `present.ts` finds it by querying the anchor attribute for the Optin's
   * id. Absent — which is every ordinary Optin — that id is the answer.
   *
   * It is present on an arm of an A/B test, where the merchant placed one
   * block naming the campaign and the arm has an id of its own that no block
   * mentions. Free neither writes this nor knows what wrote it; what it needs
   * is the sentence above, and this is that sentence
   * ({@link ../../../src/Optin/PublishedProjection.php}).
   */
  readonly anchor?: string;
}

/**
 * What this device remembers about one Optin.
 *
 * **The record itself, never a key to one** (ADR 0017). WConvert mints no
 * visitor identifier, so there is nothing here to point at a record held
 * elsewhere — these four fields ARE the record. Short names and a day number
 * rather than a timestamp, because this may travel in a cookie: `l` is whole
 * days since the epoch, which is all `cooldownDays` can ask about and is a good
 * deal less identifying than a millisecond.
 */
export interface OptinRecord {
  /** Impressions. */
  i?: number;
  /** Day of the last impression. */
  l?: number;
  /** Dismissed. */
  d?: 1;
  /** Converted. */
  c?: 1;
}

/** Every record this device holds, keyed by Optin id. */
export type VisitorState = Record<string, OptinRecord>;

/**
 * What a shown Optin reports back. Rendering is the next ticket's; this is its
 * seam.
 *
 * All THREE events are the presenter's to report, including the Impression,
 * because an Impression has two moments and only a renderer can tell them
 * apart: for the three overlays it is the moment it is shown, because they
 * render in the top layer and being rendered IS being on screen; for `inline`
 * it is the moment it ENTERS THE VIEWPORT, since an inline Optin renders where
 * it was embedded and may sit far below the fold (CONTEXT.md, Impression).
 *
 * A presenter that never calls `impression()` never spends the Optin's
 * allowance, so it shows again on the next page view. That is the safe
 * direction — an Optin nobody saw has not been seen — but it is a real
 * obligation on whatever replaces the stub.
 */
export interface OptinControls {
  impression(): void;
  dismiss(): void;
  convert(): void;
}

/** Whatever turns a decision into something on screen. */
export interface Presenter {
  show(entry: PayloadEntry, controls: OptinControls): void;
}

import apiFetch from '@wordpress/api-fetch';
import type { Template } from '@renderer/types';
import type { Availability } from '../goals/availability';

export type PreparedTemplate = Template & { transfer?: { unplaced: number; unverified: number } };

/** A read-only preparation step using the server's existing copy carry rules. */
export const prepareTemplate = (id: string, template: Template, source?: string) =>
  apiFetch<PreparedTemplate>({
    path: '/wconvert/v1/templates/snapshot',
    method: 'POST',
    data: { id, template, source },
  });

/**
 * What a Template IS, derived from its own tree on the server.
 *
 * ============================================================================
 * DERIVED, NOT AUTHORED — WHICH IS WHY THERE IS NO GOAL FACET AND NEVER WILL BE.
 * ============================================================================
 * A [[Template]] is the design of an Optin **with no words in it** (CONTEXT.md,
 * Template), so the facets a competitor filters by — Goal, Industry, Season —
 * describe something these files do not contain. What a tree CAN answer is what
 * it captures, how it is arranged and whether it has a picture, and every one of
 * these is read off it by `WConvert\Template\TemplateFacets` rather than typed
 * into a JSON file somebody then has to keep true.
 *
 * **Computed on the server even though this bundle could do it.** The client has
 * `convertingActOf` and the tree walk beside it — but {@link listTemplates}
 * deliberately withholds trees, so there would be nothing here to read. That is
 * the whole index/tree split, seen from this end.
 */
export interface TemplateFacets {
  /**
   * `submit` or `click` — the one act this design converts on, singular by
   * construction because an entry offering two or none is refused at
   * registration (ADR 0020).
   *
   * An optional merchant-chosen gallery filter, never preselected from a Goal
   * (ADR 0069). Goals do not refuse an act; a change still warns about reporting
   * history, and A/B siblings must agree (ADR 0059). Null on a locked card,
   * whose design is not available for inspection or compatibility checks.
   */
  act: 'submit' | 'click' | null;
  /** What a visitor is asked for, in manifest order. Gallery selections require every chosen field. */
  captures: string[];
  /** Step 0's root layout, from the manifest's layout vocabulary. */
  shape: string | null;
  /** Image nodes or image URLs in painted backgrounds; decorative gradients do not count. */
  has_image: boolean;
  /** Shown as a detail-preview fact, rather than a gallery filter. */
  asks_consent: boolean;
}

/**
 * One CARD of the library — everything the grid needs, and no design.
 *
 * ============================================================================
 * NO `tree`, NO `tokens`, AND THAT IS THE TICKET.
 * ============================================================================
 * `GET /templates` used to return every tree on every request, which is free at
 * three entries and is the picker's whole cost at forty — paid before the
 * merchant has read a card and paid again on every builder load. The trees for
 * the cards actually near the viewport come from {@link getTemplateTrees}, and
 * `Preview` mounts against an `IntersectionObserver` from the other end
 * (ADR 0043).
 *
 * **Three places move together or a new field vanishes in silence**:
 * `TemplateLibrary::read()`'s whitelist, this interface, and `exportEntry()`.
 */
export interface TemplateIndexEntry {
  id: string;
  name: string;
  display_type: string;
  /** The registry's tier id. The one AUTHORED facet of an entry. */
  tier: string;
  /**
   * `ready` or `locked`, resolved on the server, and never `unavailable`: no
   * site capability makes a *design* absent (ADR 0026). The surface renders it
   * through `renderingFor`, which is the doctrine this admin already has —
   * there is no second rule for templates.
   */
  availability: Availability;
  facets: TemplateFacets;
  /**
   * Where *"See this design"* goes, on a card whose design this install did not
   * get. Bundled beside the name, never fetched — a free wp.org plugin phoning
   * home for advertising copy is a different conversation with the review team
   * (ADR 0015).
   */
  preview_url?: string;
}

/**
 * One entry WITH its design — what a card actually renders, and what the
 * builder holds.
 *
 * The full shape, kept as it was: `Preview` takes a `Template` and the dev-only
 * export writes one back out as the library entry it would ship as.
 */
export interface TemplateEntry extends Template {
  id: string;
  name: string;
  display_type: string;
  /** Present on an entry the builder assembled from an index card. */
  tier?: string;
}

/** One design, as `GET /templates/trees` hands it back. */
export interface TemplateDesign extends Template {
  id: string;
}

/**
 * The template vocabulary's words, keyed by what they name.
 *
 * They come from the server rather than from this bundle for the reason
 * ADR 0013 gives about [[Playbook]]s: `wp i18n make-pot` cannot see a string
 * inside JSON, and the vocabulary is JSON because both runtimes read it. So a
 * [[Slot Role]] that used to be a key two programs agreed on acquires a
 * translatable name at the moment it becomes the heading over a control.
 */
export interface TemplateLabels {
  roles: Record<string, string>;
  nodes: Record<string, string>;
  /**
   * What each layout is called.
   *
   * Needed only since arrangement became visible: the settings panel walks
   * leaves and flattens them, so `stack` never reached a merchant's eyes. The
   * block tree cannot flatten them — a merchant moving the email field is
   * moving it within the `row` — so each acquires a name the way a Slot Role
   * did.
   */
  layouts: Record<string, string>;
  /**
   * What each layout DOES, in one line with an example.
   *
   * **A name is not an explanation.** The Add menu offered *Column*, *Row*,
   * *Side by side* and *Grid* as four bare words, and two of them are genuinely
   * hard to tell apart from their names — a Row lays blocks along one line, a
   * Side by side gives each pane its own stack. A merchant found out which was
   * which by adding one, looking at the preview and deleting it again.
   */
  layoutNotes: Record<string, string>;
  /**
   * What a layout's own setting is called, keyed `"{layout}.{param}"`.
   *
   * **A layout has settings and the editor never offered them.** `split`
   * declares `ratio`, the renderer reads it, and no control reached it — so a
   * Side by side was a fixed 50/50 and the manifest described a capability
   * nobody had.
   */
  layoutParams: Record<string, string>;
  /**
   * What each offered value of one is called, keyed
   * `"{layout}.{param}.{value}"` — because `0.35` is not a thing to put in
   * front of a merchant.
   */
  layoutParamValues: Record<string, string>;
  /**
   * What a LEAF's own setting is called, keyed `"{node}.{param}"`.
   *
   * **Three of them had no control at all**: `heading.level` decides whether a
   * headline is the Optin's `h2` or an `h3` under it, `image.fit` decides
   * whether a picture is cropped or letterboxed, and `field.required` is read
   * by the capture endpoint, which refuses a submission that left one empty.
   * All three are declared in the manifest and honoured at both ends, and the
   * only way to set any of them was to author a [[Template]] by hand.
   *
   * Keyed on the manifest's per-node `choices` rather than on its `params`,
   * because `hidden`, `name` and `action` are drawn by controls that already
   * have their own words — the *Show this* switch and the ⇄ menu.
   */
  nodeParams: Record<string, string>;
  /**
   * What each offered value of one is called, keyed
   * `"{node}.{param}.{value}"` — because `contain` and `true` are not words
   * anybody writes on a form, the same reason `0.35` needed *"Narrow left"*.
   */
  nodeParamValues: Record<string, string>;
  fields: Record<string, string>;
  /**
   * The example wording a field of each kind ships with.
   *
   * A default to COMPARE against as much as one to write: the ⇄ control
   * rewrites a field's placeholder only where the old kind's was still there,
   * which is how a merchant's own wording survives a swap.
   */
  placeholders: Record<string, string>;
  keys: Record<string, string>;
  /**
   * What each choosable PARAM VALUE is called — today, a `button`'s two
   * actions.
   *
   * Its own map rather than an entry in `keys`, which is pinned to exactly the
   * leaves' `content` keys by `TemplateLabelParityTest`: a label for `action`
   * in there would be a control the editor must not offer as words. A row says
   * *"Send my code · sends the form"* and the ⇄ menu offers the other one, and
   * neither may say `submit` to a merchant.
   */
  params: Record<string, string>;
  tokens: Record<string, string>;
  /**
   * What each OFFERED TOKEN VALUE is called, keyed `"{token}.{value}"`.
   *
   * The Design panel's segmented controls read this: `align.center` is
   * *"Centre"* and a font stack is *"Serif"*. Keyed by the VALUE because the
   * value is the identity — `align` holds the CSS keyword the renderer reads,
   * and a font token holds the stack itself — so there is no id to keep in step
   * with anything.
   *
   * Its own map rather than an entry in `tokens`, which
   * `TemplateLabelParityTest` pins to exactly the token NAMES.
   *
   * **It says what is offered, never what is allowed.** A merchant may still
   * type a value nothing here names, and the panel keeps a text box beside
   * every choice control precisely so they can.
   */
  tokenValues: Record<string, string>;
}

/**
 * What each FACET the picker filters by is called, and what each value is.
 *
 * `facetValues` is keyed `"{facet}.{value}"`, the same shape `tokenValues` and
 * `layoutParamValues` take — because the value IS the identity and an id would
 * be a second spelling of something the manifest already spells once.
 *
 * Shape and capture choices borrow words the admin already says: a `shape` chip and a
 * row in the structure editor name the same layout, composed from one string on
 * the server so a translator has one to get right rather than two that must
 * agree.
 */
export interface TemplateLabelsWithFacets extends TemplateLabels {
  facets: Record<string, string>;
  facetValues: Record<string, string>;
}

/**
 * What `GET /wconvert/v1/templates` returns: the library as an INDEX, its
 * words, and the facet vocabulary the chip strip enumerates.
 *
 * The vocabulary comes from `resources/templates/manifest.json` rather than
 * from this bundle, which is ADR 0010's rule read literally: a control that
 * ENUMERATES reads its enumeration from the manifest. The picker presents
 * relevant values for the current Display Type and keeps secondary choices in
 * More filters; it does not need every preview tree to derive the controls.
 */
export interface TemplateIndex {
  templates: TemplateIndexEntry[];
  labels: TemplateLabelsWithFacets;
  /** `{ shape: [...], captures: [...], has_image: ['true'] }`, in vocabulary order. */
  facets: Record<string, string[]>;
}

export const listTemplates = () => apiFetch<TemplateIndex>({ path: '/wconvert/v1/templates' });

/**
 * The designs behind a handful of cards — the ones on screen.
 *
 * Nearby cards are batched into requests of at most 24 ids, matching the server
 * cap. One fetch per card would create a request storm when scrolling. The cap
 * also means a hand-written URL
 * cannot ask for the whole library back through the route built to avoid
 * sending it.
 *
 * An id with no design behind it — a locked card, an entry this install no
 * longer ships — is simply absent from the answer rather than an error. An
 * absent requested preview is a local load failure with explicit Retry in the
 * picker, as is a rejected request; viewport re-entry does not retry it forever.
 */
export const getTemplateTrees = (ids: readonly string[]) =>
  apiFetch<{ templates: TemplateDesign[] }>({
    path: `/wconvert/v1/templates/trees?ids=${encodeURIComponent(ids.join(','))}`,
  });

/**
 * One label, or the key itself where nothing names it.
 *
 * The same fallback `WConvert\Rules\RuleLabels` takes on the other side of
 * the boundary, and for the same reason: a build whose vocabulary is ahead of
 * its translations shows a merchant `success_headline` rather than an empty
 * control. `tests/unit/Template/TemplateLabelParityTest.php` is what keeps
 * that from becoming the normal case.
 */
export const nameOf = (labels: Record<string, string>, key: string): string => labels[key] ?? key;

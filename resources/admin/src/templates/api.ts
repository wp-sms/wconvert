import apiFetch from '@wordpress/api-fetch';
import type { Template } from '@renderer/types';

/** One entry of the shipped gallery. */
export interface TemplateEntry extends Template {
  id: string;
  name: string;
  display_type: string;
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

/** What `GET /wconvert/v1/templates` returns: the gallery, and its words. */
export interface Gallery {
  templates: TemplateEntry[];
  labels: TemplateLabels;
}

export const listTemplates = () => apiFetch<Gallery>({ path: '/wconvert/v1/templates' });

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

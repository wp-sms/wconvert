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
  fields: Record<string, string>;
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

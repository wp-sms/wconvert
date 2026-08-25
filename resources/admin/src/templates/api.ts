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
  fields: Record<string, string>;
  keys: Record<string, string>;
  tokens: Record<string, string>;
}

/** What `GET /wconvert/v1/templates` returns: the gallery, and its words. */
export interface Gallery {
  templates: TemplateEntry[];
  labels: TemplateLabels;
}

export const listTemplates = () => apiFetch<Gallery>({ path: '/wconvert/v1/templates' });

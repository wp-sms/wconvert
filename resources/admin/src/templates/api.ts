import apiFetch from '@wordpress/api-fetch';
import type { Template } from '@renderer/types';

/** One entry of the shipped gallery, as `GET /wconvert/v1/templates` returns it. */
export interface TemplateEntry extends Template {
  id: string;
  name: string;
  display_type: string;
}

export const listTemplates = () => apiFetch<TemplateEntry[]>({ path: '/wconvert/v1/templates' });

import apiFetch from '@wordpress/api-fetch';
import type { TemplateEntry } from './api';

/**
 * The hosted template library (ADR 0156), through the plugin's own routes.
 * Reading status never touches the network; every write is an explicit
 * administrator action.
 */
export type CatalogState = 'unavailable' | 'locked' | 'update_plugin' | 'install' | 'ready';
export type CatalogConsent = 'unanswered' | 'yes' | 'no';

export interface CatalogDesign {
  id: string;
  revision: number;
  sha256: string;
  name: string;
  format: string;
  tier: string;
  family: string | null;
  slug: string;
  tags: string[];
  thumbnail: { '1x': string; '2x': string } | null;
  popularity: number | null;
  local_revision: number | null;
  state: CatalogState;
}

export interface CatalogSetup {
  id: string;
  revision: number;
  sha256: string;
  name: string;
  goal: string;
  tier: string;
  design: { id: string; revision: number };
  state: CatalogState;
}

export interface CatalogTerm { id: string; label: string }

export interface CatalogStatus {
  enabled: boolean;
  consent: CatalogConsent;
  checked_at: string | null;
  update_required: boolean;
  skipped: number;
  taxonomy: Record<string, CatalogTerm[]>;
  designs: CatalogDesign[];
  setups: CatalogSetup[];
}

const path = '/wconvert/v1/template-catalog';
export const catalogStatus = () => apiFetch<CatalogStatus>({ path });
/** `ifStale` is what opening the picker sends: nothing happens inside twelve hours or without consent. */
export const refreshCatalog = (ifStale = false) => apiFetch<CatalogStatus>({ path: `${path}/refresh`, method: 'POST', data: { if_stale: ifStale } });
export const setCatalogConsent = (allowed: boolean) => apiFetch<CatalogStatus>({ path: `${path}/consent`, method: 'POST', data: { allowed } });
export const previewDesign = (id: string) =>
  apiFetch<{ id: string; revision: number; sha256: string; name: string; template: TemplateEntry }>({ path: `${path}/preview`, method: 'POST', data: { id } });
export const installDesign = (id: string, sha256: string) =>
  apiFetch<{ template_id: string; status: CatalogStatus }>({ path: `${path}/install`, method: 'POST', data: { id, sha256 } });
export const installSetup = (id: string, sha256: string) =>
  apiFetch<{ playbook_id: string; template_id: string; status: CatalogStatus }>({ path: `${path}/setup`, method: 'POST', data: { id, sha256 } });

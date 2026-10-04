import { __ } from '@wordpress/i18n';
import { capturedFields, settingsProblems } from '../destinations/requirements';
import { convertingActOf } from '../builder/structure/guards';
import type { Destination } from '../destinations/api';
import type { Template } from '@renderer/types';
import { childKeysOf } from '../builder/panel';
import type { TemplateNode } from '@renderer/types';

/** Rules and wording are declared by PHP; the admin evaluates the current draft. */
export interface OutcomeContract {
  action: 'submit' | 'click' | 'match';
  capture_any_of: readonly string[];
  requirement: string;
  measurement: string;
  proof_level: string;
  destination_type: string | null;
  link_required: boolean;
  audience_channel: string | null;
}

export function outcomeDesignIssue(outcome: OutcomeContract, template: Template | undefined): string | null {
  const acts = template ? convertingActOf(template.tree) : [];
  if (acts.length !== 1 || acts[0] !== outcome.action) return outcome.requirement;
  if (outcome.capture_any_of.length === 0) return !outcome.link_required || (template && hasLink(template.tree.steps[0]?.content)) ? null : outcome.requirement;
  return capturedFields(template).some((field) => outcome.capture_any_of.includes(field.name)
    && (outcome.capture_any_of.length > 1 || field.required)) ? null : outcome.requirement;
}

function hasLink(node: TemplateNode | undefined): boolean {
  if (node?.type === 'products' && 'product_ids' in node) return Array.isArray(node.product_ids) && node.product_ids.length > 0;
  if (!node || ('hidden' in node && node.hidden === true)) return false;
  if (node.type === 'button' && 'action' in node && node.action === 'link') {
    return 'href' in node && typeof node.href === 'string' && node.href.trim() !== '' && node.href.trim() !== '#';
  }
  const branches = node as unknown as Record<string, readonly TemplateNode[]>;
  return childKeysOf(node.type).some((key) => (branches[key] ?? []).some(hasLink));
}

/** A library facet suggests a fit; the edited form is checked again at publication. */
export function fitsOutcome(outcome: OutcomeContract, facets: { act: string | null; captures: readonly string[] }): boolean {
  return facets.act === outcome.action && (outcome.capture_any_of.length === 0
    || outcome.capture_any_of.some((field) => facets.captures.includes(field)));
}

export function outcomeHandoffIssue(outcome: OutcomeContract, bound: readonly string[], destinations: readonly Destination[] | null, captureMode = 'connected'): string | null {
  if (outcome.audience_channel && captureMode !== 'local') {
    const ready = destinations?.some((destination) => bound.includes(destination.id)
      && destination.availability === 'ready'
      && destination.requirements?.audience_channels?.includes(outcome.audience_channel as string)
      && settingsProblems(destination.requirements, destination.settings).length === 0);
    return ready ? null : __('Before publishing, connect a service or choose “Collect only in WConvert”.', 'wconvert');
  }
  if (outcome.destination_type === null) return null;
  if (destinations === null) return __('Open Destinations to check the required delivery setup before publishing.', 'wconvert');
  const ready = captureMode !== 'local' && destinations.some((destination) => bound.includes(destination.id)
    && destination.type === outcome.destination_type && destination.availability === 'ready'
    && destination.requirements != null
    && settingsProblems(destination.requirements, destination.settings).length === 0);
  return ready ? null : __('Connect a lead magnet email destination and complete its file link before publishing.', 'wconvert');
}

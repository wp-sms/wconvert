import { __, _n, sprintf } from '@wordpress/i18n';
import { siteLocale } from '../lib/format';
import type { Destination, DestinationRequirements, SettingsField } from './api';
import type { Template, TemplateNode } from '@renderer/types';

export interface CapturedField { name: string; required: boolean }

const children = (node: TemplateNode): readonly TemplateNode[] => {
  const branches = node as { children?: readonly TemplateNode[]; start?: readonly TemplateNode[]; end?: readonly TemplateNode[] };
  return [...(branches.children ?? []), ...(branches.start ?? []), ...(branches.end ?? [])];
};
/** Only fields on the actual submitting step can satisfy a destination. The first submission unless one is named. */
export function capturedFields(template: Template | undefined, submissionId?: string): CapturedField[] {
  if (!template) return [];
  const submission = submissionId === undefined ? template.tree.submissions[0] : template.tree.submissions.find((each) => each.id === submissionId);
  const refs = new Set(submission?.fields ?? []);
  const fields: CapturedField[] = [];
  const walk = (node: TemplateNode) => {
    if ('hidden' in node && node.hidden === true) return;
    if ('id' in node && refs.has(String(node.id)) && node.type === 'field' && 'name' in node && typeof node.name === 'string') {
      fields.push({ name: node.name, required: 'required' in node && node.required === true });
    }
    children(node).forEach(walk);
  };
  template.tree.steps.forEach((step) => walk(step.content));
  return fields;
}

/** The contact fields a provider takes without mapping, in the words a sentence uses. */
export const contactFieldNames = (): Readonly<Record<string, string>> => ({
  email: __('email', 'wconvert'), name: __('name', 'wconvert'), phone: __('phone', 'wconvert'),
});

const names: Readonly<Record<string, string>> = {
  email: __('email address', 'wconvert'), phone: __('phone number', 'wconvert'), name: __('name', 'wconvert'), interest: __('interest answer', 'wconvert'),
};
const named = (field: string) => names[field] ?? field;
/** The distinct non-empty ids, as the server's `DestinationRequirements::ids()` counts them. */
const ids = (value: unknown) => new Set(Array.isArray(value) ? value.filter((each): each is string => typeof each === 'string').map((each) => each.trim()).filter(Boolean) : []);
const tooMany = (value: unknown, field: { max?: number }) => field.max !== undefined && ids(value).size > field.max;
const present = (value: unknown, type: string) => type === 'ids'
  ? ids(value).size > 0
  : typeof value === 'string' && value.trim() !== '';
// More ids than the service takes is as unready as none: every push would refuse it (#223).
const ready = (value: unknown, field: { type: string; max?: number }) => present(value, field.type) && !(field.type === 'ids' && tooMany(value, field));

/** The keys of required settings that are still empty, or hold more ids than allowed, in schema order. */
export function missingSettings(requirements: DestinationRequirements | null | undefined, settings: Readonly<Record<string, unknown>>): string[] {
  return Object.entries(requirements?.settings ?? {}).filter(([key, field]) => !ready(settings[key], field)).map(([key]) => key);
}

export function settingsProblems(requirements: DestinationRequirements | null | undefined, settings: Readonly<Record<string, unknown>>, schema?: Readonly<Record<string, SettingsField>>): string[] {
  const problems: string[] = Object.entries(requirements?.settings ?? {}).filter(([key, field]) => !ready(settings[key], field))
    .map(([key, field]) => field.type !== 'ids'
      ? sprintf(__('Complete “%s” before this destination can send.', 'wconvert'), field.label)
      : tooMany(settings[key], field)
        ? sprintf(/* translators: 1: how many it takes, 2: the field, e.g. “List”. */ _n('Choose one “%2$s”. This service adds a contact to one list.', 'Choose no more than %1$d “%2$s”.', field.max ?? 1, 'wconvert'), field.max, field.label)
        : sprintf(__('Choose “%s” before this destination can send.', 'wconvert'), field.label));
  for (const field of Object.values(requirements?.mapped_fields ?? {})) {
    const value = settings[field.setting];
    const options = schema?.[field.setting]?.options;
    if (present(value, 'text') && options !== undefined && !options.some((option) => option.value === value)) {
      problems.push(sprintf(__('The selected field for %s is unavailable. Choose another field or keep the answer only in WConvert.', 'wconvert'), field.label));
    }
  }
  return problems;
}

/** Settings problems plus {@see captureProblems}, each prefixed with the route's name for a list that mixes routes. */
export function compatibilityProblems(destination: Destination, captures: readonly CapturedField[]): string[] {
  if (!destination.requirements) return [];
  return [...settingsProblems(destination.requirements, destination.settings), ...captureProblems(destination, captures)]
    .map((problem) => sprintf(__('%1$s: %2$s', 'wconvert'), destination.label, problem));
}

/** Where this form and this route disagree: missing or optional identifiers, unsent fields, broken mappings. */
export function captureProblems(destination: Destination, captures: readonly CapturedField[]): string[] {
  const requirements = destination.requirements;
  if (!requirements) return [];
  const problems = [...(destination.mapping_issues ?? [])];
  const needed = requirements.capture_any_of;
  const fields = captures.filter((field) => needed.includes(field.name));
  // Capture itself always requires email or phone. A route can miss its own
  // optional identifier only when another identifier allows local capture.
  const canCaptureWithoutNeeded = captures.some((field) => ['email', 'phone'].includes(field.name) && !needed.includes(field.name));
  // “email address or phone number” in the site's language, not a glued ' or '.
  const alternatives = new Intl.ListFormat(siteLocale(), { type: 'disjunction' }).format(needed.map(named));
  if (needed.length > 0 && fields.length === 0) {
    problems.push(sprintf(/* translators: %s: what it needs, e.g. “email address or phone number”. */ __('This destination needs %s. Add it to the form, or submissions can’t be sent here.', 'wconvert'), alternatives));
  } else if (fields.length > 0 && canCaptureWithoutNeeded && !fields.some((field) => field.required)) {
    problems.push(sprintf(/* translators: %s: what it needs, e.g. “email address”. */ __('This destination needs %s, but the field is optional. Submissions without it are kept in WConvert and not sent here.', 'wconvert'), alternatives));
  }
  for (const field of captures) {
    if (requirements.fields.includes(field.name)) continue;
    const mapping = requirements.mapped_fields[field.name];
    if (mapping && present(destination.settings[mapping.setting], 'text')) {
      problems.push(sprintf(__('%1$s: %2$s', 'wconvert'), mapping.label, mapping.scope));
    } else {
      problems.push(sprintf(__('The %s is saved in WConvert but is not sent by this destination.', 'wconvert'), named(field.name)));
    }
  }
  return problems;
}

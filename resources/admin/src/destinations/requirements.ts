import { __, sprintf } from '@wordpress/i18n';
import type { Destination, DestinationRequirements, SettingsField } from './api';
import type { Template, TemplateNode } from '@renderer/types';

export interface CapturedField { name: string; required: boolean }

const children = (node: TemplateNode): readonly TemplateNode[] => {
  const branches = node as { children?: readonly TemplateNode[]; start?: readonly TemplateNode[]; end?: readonly TemplateNode[] };
  return [...(branches.children ?? []), ...(branches.start ?? []), ...(branches.end ?? [])];
};
// The renderer and capture boundary derive the form from its submit button.
const submits = (node: TemplateNode): boolean => node.type === 'button'
  ? !('action' in node) || node.action !== 'link'
  : children(node).some(submits);

/** Only fields on the actual submitting step can satisfy a destination. */
export function capturedFields(template: Template | undefined): CapturedField[] {
  const form = template?.tree.steps.find(submits);
  if (!form) return [];
  const fields: CapturedField[] = [];
  const walk = (node: TemplateNode) => {
    if ('hidden' in node && node.hidden === true) return;
    if (node.type === 'field' && 'name' in node && typeof node.name === 'string') {
      fields.push({ name: node.name, required: 'required' in node && node.required === true });
    }
    children(node).forEach(walk);
  };
  walk(form);
  return fields;
}

const names: Readonly<Record<string, string>> = {
  email: __('email address', 'wconvert'), phone: __('phone number', 'wconvert'), name: __('name', 'wconvert'), interest: __('interest answer', 'wconvert'),
};
const named = (field: string) => names[field] ?? field;
const present = (value: unknown, type: string) => type === 'ids'
  ? Array.isArray(value) && value.some((each) => typeof each === 'string' && each.trim() !== '')
  : typeof value === 'string' && value.trim() !== '';

export function settingsProblems(requirements: DestinationRequirements | null | undefined, settings: Readonly<Record<string, unknown>>, schema?: Readonly<Record<string, SettingsField>>): string[] {
  const problems: string[] = Object.entries(requirements?.settings ?? {}).filter(([key, field]) => !present(settings[key], field.type))
    .map(([, field]) => sprintf(__('Complete “%s” before this destination can send.', 'wconvert'), field.label));
  for (const field of Object.values(requirements?.mapped_fields ?? {})) {
    const value = settings[field.setting];
    const options = schema?.[field.setting]?.options;
    if (present(value, 'text') && options !== undefined && !options.some((option) => option.value === value)) {
      problems.push(sprintf(__('The selected field for %s is unavailable. Choose another field or keep the answer only in WConvert.', 'wconvert'), field.label));
    }
  }
  return problems;
}

export function compatibilityProblems(destination: Destination, captures: readonly CapturedField[]): string[] {
  const requirements = destination.requirements;
  if (!requirements) return [];
  const problems = [...settingsProblems(requirements, destination.settings), ...(destination.mapping_issues ?? [])];
  const needed = requirements.capture_any_of;
  const fields = captures.filter((field) => needed.includes(field.name));
  // Capture itself always requires email or phone. A route can miss its own
  // optional identifier only when another identifier allows local capture.
  const canCaptureWithoutNeeded = captures.some((field) => ['email', 'phone'].includes(field.name) && !needed.includes(field.name));
  const alternatives = needed.map(named).join(__(' or ', 'wconvert'));
  if (needed.length > 0 && fields.length === 0) {
    problems.push(sprintf(__('This destination needs %s. Add it to the form; current captures cannot be sent here.', 'wconvert'), alternatives));
  } else if (fields.length > 0 && canCaptureWithoutNeeded && !fields.some((field) => field.required)) {
    problems.push(sprintf(__('This destination needs %s, but the field is optional. Captures without it are kept here and skipped by this destination.', 'wconvert'), alternatives));
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
  return problems.map((problem) => sprintf(__('%1$s: %2$s', 'wconvert'), destination.label, problem));
}

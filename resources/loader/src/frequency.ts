import type { Frequency, OptinRecord } from './types';

/**
 * The allowance, checked before any rule.
 *
 * It is a fourth top-level field rather than a rule (issue #3) because it is
 * not a question about this page view — it is what this device has already been
 * shown — and checking it first short-circuits everything else.
 *
 * `stopAfterConversion` defaults ON and the rest default off. Converting is the
 * strongest "stop showing me this" a visitor can give, and it is the one a
 * merchant would be embarrassed to have ignored.
 */
export function isAllowed(frequency: Frequency | undefined, record: OptinRecord | undefined, day: number): boolean {
  if (record === undefined) {
    return true;
  }

  const cap = frequency ?? {};

  if (cap.stopAfterConversion !== false && record.c === 1) {
    return false;
  }

  if (cap.stopAfterDismiss === true && record.d === 1) {
    return false;
  }

  if (cap.maxImpressions !== undefined && (record.i ?? 0) >= cap.maxImpressions) {
    return false;
  }

  // Whole days, not milliseconds: a cooldown is expressed in days, so the
  // finer number would be precision this never asks about and one more thing
  // stored on the visitor's device (ADR 0017).
  return !(cap.cooldownDays !== undefined && record.l !== undefined && day - record.l < cap.cooldownDays);
}

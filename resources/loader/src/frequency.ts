import type { Frequency, OptinRecord } from './types';

/**
 * The allowance, checked before any rule.
 *
 * It is a fourth top-level field rather than a rule (issue #3) because it is
 * not a question about this page view — it is what this device has already been
 * shown — and checking it first short-circuits everything else.
 *
 * **`stopAfterDismiss` and `stopAfterConversion` both default ON**; the two
 * numbers default off. Both record something the visitor DID — closed it, or
 * completed it — and both mean the same thing: stop showing me this. The two
 * numbers are a merchant's pacing decision, so they are off until asked for.
 *
 * Issue #3 settled the four names and left the defaults to the ticket that
 * built the store; the prototype had `stopAfterDismiss` off, and it cannot be.
 * The whole justification for writing anything to a visitor's device is
 * ADR 0017's — "it records a choice the visitor made by clicking the close
 * button, and withholding it means the popup reappears — worse for the visitor
 * on every axis". Off by default, the record is written, read, and ignored, and
 * the popup reappears anyway. A merchant who wants it back sets `cooldownDays`
 * beside it, or turns this off deliberately.
 */
export function isAllowed(frequency: Frequency | undefined, record: OptinRecord | undefined, day: number): boolean {
  if (record === undefined) {
    return true;
  }

  const cap = frequency ?? {};

  if (cap.stopAfterConversion !== false && record.c === 1) {
    return false;
  }

  if (cap.stopAfterDismiss !== false && record.d === 1) {
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

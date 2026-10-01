/** Authoring IDs also work on HTTP installs, where randomUUID is unavailable. */
export const newAuthoringId = (): string => Array.from(
  crypto.getRandomValues(new Uint8Array(16)),
  byte => byte.toString(16).padStart(2, '0'),
).join('');

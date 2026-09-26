import { PAYLOAD_ELEMENT_ID } from './payload';

/** Free and Pro read the same localized payload, including older cached pages. */
export function journeyLabel(index: number): string {
  try {
    const labels = JSON.parse(document.getElementById(PAYLOAD_ELEMENT_ID)?.getAttribute('data-journey') ?? 'null');
    if (typeof labels?.[index] === 'string') return labels[index];
  } catch { /* Missing or malformed page copy uses the fallback. */ }
  return ['Continue', 'Submission not confirmed. Please try again.', 'Contact details are required before you see your result.',
    'Already saved. You can review these details, but cannot change them.'][index];
}

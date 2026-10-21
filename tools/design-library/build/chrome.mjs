/**
 * A campaign drawn as a visitor meets it, with the pieces the loader adds
 * rather than the design: the close control, a refused entry, and a ticking
 * countdown (ADR 0159).
 *
 * `render()` alone draws none of the three, so a check built on it could not
 * see them move — and a design now colours all three. This mounts through the
 * shared `shell()`, with the container's own close control, at a fixed clock
 * and a fixed deadline, then refuses the screen's first field the way the
 * capture endpoint does. Every check that proves a campaign unchanged, or
 * readable, draws it through here.
 *
 * Self-contained, so it runs as-is in a JSDOM window and, by its source, in a
 * Playwright page.
 */
export const SAMPLE_NOW = Date.UTC(2026, 0, 1, 9, 0, 0);
export const SAMPLE_DEADLINE = SAMPLE_NOW + ((2 * 24 + 14) * 3600 + 5 * 60 + 9) * 1000;
export const SAMPLE_ERROR = 'Enter a valid email address.';

export function drawWithChrome(api, entry, index, variant, deadline, message) {
  const type = entry.display_type ?? 'popup';
  const chrome = type === 'inline' ? null : api.closeButton(() => {});
  // As Pro's popover marks it, so a bar's control sits where a bar's does.
  if (chrome && type === 'floating_bar') chrome.dataset.bar = '';
  const parts = api.shell({ tree: entry.tree, tokens: entry.tokens ?? {} }, chrome, { displayType: type, endsAt: deadline, shadowMode: 'open' });
  const root = index === 0 ? parts.root : parts.step(index);
  if (variant) api.previewResult?.(root, variant, entry.tree.steps[index].products_required);
  const field = root.querySelector('.wc-input[name]');
  if (field) api.refuse(root, message, field.getAttribute('name'));
  parts.stop();
  return { host: parts.host, root };
}

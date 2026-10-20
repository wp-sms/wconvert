/**
 * Catalogue v3 detail pages: what the website reads for its gallery. The plugin
 * never reads them, so they carry the marketing words and the preview/og/thumb
 * digests the website follows.
 */
const check = (ok, message) => { if (!ok) throw Error(message); };
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const identifier = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,59}$/.test(value);
const words = (value, max) => typeof value === 'string' && value.trim() !== '' && value.length <= max;
const terms = value => value === undefined || (Array.isArray(value) && value.every(identifier));
const dimension = value => Number.isSafeInteger(value) && value > 0 && value <= 10000;

/**
 * Validate one detail page and return its public dependencies as [key, sha]
 * pairs. A null sha is the 2x thumbnail, whose own digest is not in its name.
 * `seen` spans every detail page of a release: an id appears once.
 */
export function detailDependencies(page, seen = new Set()) {
  check(page?.schema === 3 && Array.isArray(page.details), 'Invalid detail page');
  const dependencies = [];
  for (const detail of page.details) {
    check(identifier(detail?.id) && !seen.has(detail.id), 'Repeated or invalid detail id');
    seen.add(detail.id);
    check(typeof detail.slug === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(detail.slug), `Invalid detail slug: ${detail.id}`);
    check(detail.description === undefined || words(detail.description, 1000), `Invalid detail description: ${detail.id}`);
    check(['industries', 'occasions', 'style', 'colour'].every(key => terms(detail[key])), `Invalid detail taxonomy: ${detail.id}`);
    check(detail.screens === undefined || Array.isArray(detail.screens), `Invalid detail screens: ${detail.id}`);
    if (detail.preview !== undefined) {
      check(digest(detail.preview), `Invalid preview digest: ${detail.id}`);
      dependencies.push([`v3/previews/${detail.preview}.html`, detail.preview]);
    }
    if (detail.og !== undefined) {
      check(digest(detail.og), `Invalid og digest: ${detail.id}`);
      dependencies.push([`v3/og/${detail.og}.jpg`, detail.og]);
    }
    if (detail.thumb !== undefined) {
      const thumb = detail.thumb;
      check(thumb && digest(thumb.sha) && dimension(thumb.width) && dimension(thumb.height) && words(thumb.alt, 300), `Invalid detail thumbnail: ${detail.id}`);
      dependencies.push([`v3/thumbs/${thumb.sha}.webp`, thumb.sha], [`v3/thumbs/${thumb.sha}@2x.webp`, null]);
    }
  }
  return dependencies;
}

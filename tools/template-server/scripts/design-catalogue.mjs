import { createHash } from 'node:crypto';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (ok, message) => { if (!ok) throw Error(message); };
const json = value => JSON.stringify(value, null, 2) + '\n';
export const legacyReleaseId = (packs, collections) => hash(json({ packs, collections }));

/** Release identity commits to the entire public projection, including preview/image hashes. */
export function validateDesignCatalogue(catalogue, { id, packs, collections, origin }) {
  check(catalogue?.schema === 1 && catalogue.release === id && Array.isArray(catalogue.designs), 'Invalid design catalogue');
  check(hash(json({ packs, collections, designs: catalogue.designs })) === id, 'Design catalogue integrity mismatch');
  const dependencies = new Map(), ids = new Set();
  const reference = (value, kind, fragment = false) => {
    const url = new URL(value);
    check(url.origin === origin && !url.username && !url.password && !url.search && (fragment || !url.hash), 'Invalid public design URL');
    const match = url.pathname.match(kind === 'preview' ? /^\/previews\/([a-f0-9]{64})\.html$/ : /^\/thumbnails\/([a-f0-9]{64})\.jpg$/);
    check(match, 'Invalid public design asset');
    dependencies.set(url.pathname.slice(1), match[1]);
  };
  for (const design of catalogue.designs) {
    check(/^[a-z0-9][a-z0-9-]{0,59}$/.test(design.id) && !ids.has(design.id), 'Repeated or invalid design ID'); ids.add(design.id);
    check(['free', 'pro'].includes(design.availability) && /^[a-f0-9]{64}$/.test(design.revision), 'Invalid design tier or revision');
    check(Array.isArray(design.packs) && design.packs.length > 0 && design.pack_id === design.packs[0].id, 'Invalid design pack membership');
    for (const delivery of design.packs) check(packs.some(pack => pack.id === delivery.id && (pack.access === 'premium' ? 'pro' : 'free') === delivery.access), 'Design references an absent pack');
    check(Array.isArray(design.screens) && design.screens.length > 0 && new Set(design.screens.map(screen => screen.id)).size === design.screens.length, 'Invalid design screens');
    check(['available', 'unavailable'].includes(design.preview_status), 'Invalid preview status');
    if (design.preview_status === 'unavailable') {
      check(!design.preview_url && !design.embed_url && !design.thumbnail && design.screens.every(screen => !screen.preview_url && !screen.embed_url), 'Unavailable preview references assets');
      continue;
    }
    reference(design.preview_url, 'preview', true); reference(design.embed_url, 'preview');
    for (const screen of design.screens) {
      check(screen.preview_url === design.preview_url + '&screen=' + encodeURIComponent(screen.id)
        && screen.embed_url === design.embed_url + '#screen=' + encodeURIComponent(screen.id), 'Invalid screen selection URL');
    }
    const thumbnail = design.thumbnail;
    check(thumbnail && Number.isInteger(thumbnail.width) && thumbnail.width > 0 && Number.isInteger(thumbnail.height) && thumbnail.height > 0
      && typeof thumbnail.alt === 'string' && thumbnail.alt.trim() && typeof thumbnail.partial === 'boolean'
      && design.screens.some(screen => screen.id === thumbnail.screen_id), 'Invalid thumbnail metadata');
    reference(thumbnail.url, 'thumbnail');
    check(dependencies.get(new URL(thumbnail.url).pathname.slice(1)) === thumbnail.sha256, 'Invalid thumbnail digest');
  }
  return dependencies;
}

import { createHash } from 'node:crypto';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (ok, message) => { if (!ok) throw Error(message); };
const json = value => JSON.stringify(value, null, 2) + '\n';
export const legacyReleaseId = (packs, collections) => hash(json({ packs, collections }));

/** Release identity commits to the entire public projection, including preview/image hashes. */
export function validateDesignCatalogue(catalogue, { id, packs, collections, origin }) {
  check(catalogue?.schema === 1 && catalogue.release === id && Array.isArray(catalogue.designs), 'Invalid design catalogue');
  const extensions = catalogue.extensions;
  check(hash(json({ packs, collections, designs: catalogue.designs })) === id, 'Design catalogue integrity mismatch');
  if (extensions) {
    check(catalogue.designs.length > 0 && catalogue.designs.every(design => design.gallery_extensions_sha256 === hash(json(extensions))), 'Gallery extension integrity mismatch');
    check(extensions.schema === 1 && extensions.capabilities?.design_only_embed === 1
      && extensions.capabilities.bundled_designs === 1 && extensions.capabilities.collection_designs === 1
      && Array.isArray(extensions.bundled_designs) && Array.isArray(extensions.collections), 'Invalid gallery extensions');
  } else check(catalogue.designs.every(design => !('gallery_extensions_sha256' in design)), 'Missing gallery extensions');
  const dependencies = new Map(), ids = new Set();
  const reference = (value, kind, fragment = false) => {
    const url = new URL(value);
    check(url.origin === origin && !url.username && !url.password && !url.search && (fragment || !url.hash), 'Invalid public design URL');
    const match = url.pathname.match(kind === 'preview' ? /^\/previews\/([a-f0-9]{64})\.html$/ : /^\/thumbnails\/([a-f0-9]{64})\.jpg$/);
    check(match, 'Invalid public design asset');
    dependencies.set(url.pathname.slice(1), match[1]);
  };
  const bundled = extensions?.bundled_designs ?? [], all = [...catalogue.designs, ...bundled];
  for (const design of all) {
    check(/^[a-z0-9][a-z0-9-]{0,59}$/.test(design.id) && !ids.has(design.id), 'Repeated or invalid design ID'); ids.add(design.id);
    check(['free', 'pro'].includes(design.availability) && /^[a-f0-9]{64}$/.test(design.revision), 'Invalid design tier or revision');
    check(['popup', 'inline', 'floating_bar', 'slide_in', 'fullscreen'].includes(design.format), 'Invalid design format');
    check(Array.isArray(design.packs) && (bundled.includes(design)
      ? design.packs.length === 0 && !('pack_id' in design) && design.bundled === true && design.bundle_tier === design.availability
      : design.packs.length > 0 && design.pack_id === design.packs[0].id), 'Invalid design pack membership');
    check(new Set(design.packs.map(pack => pack.id)).size === design.packs.length, 'Repeated design pack membership');
    for (const delivery of design.packs) check(packs.some(pack => pack.id === delivery.id && (pack.access === 'premium' ? 'pro' : 'free') === delivery.access), 'Design references an absent pack');
    check(Array.isArray(design.screens) && design.screens.length > 0 && new Set(design.screens.map(screen => screen.id)).size === design.screens.length, 'Invalid design screens');
    check(['available', 'unavailable'].includes(design.preview_status), 'Invalid preview status');
    if (design.preview_status === 'unavailable') {
      check(!design.preview_url && !design.embed_url && !design.design_only_embed && !design.thumbnail
        && design.screens.every(screen => !screen.preview_url && !screen.embed_url && !screen.design_only_embed_url), 'Unavailable preview references assets');
      continue;
    }
    reference(design.preview_url, 'preview', true); reference(design.embed_url, 'preview');
    if (design.design_only_embed) {
      const embed = design.design_only_embed;
      check(embed.version === 1 && JSON.stringify(embed.devices) === '["desktop","mobile"]'
        && embed.default_device === 'desktop' && embed.mobile_width === 320, 'Invalid design-only capability');
      reference(embed.url, 'preview');
    }
    for (const screen of design.screens) {
      check(screen.preview_url === design.preview_url + '&screen=' + encodeURIComponent(screen.id)
        && screen.embed_url === design.embed_url + '#screen=' + encodeURIComponent(screen.id), 'Invalid screen selection URL');
      check(design.design_only_embed
        ? screen.design_only_embed_url === design.design_only_embed.url + '#screen=' + encodeURIComponent(screen.id)
        : !screen.design_only_embed_url, 'Invalid design-only screen URL');
    }
    const thumbnail = design.thumbnail;
    check(thumbnail && Number.isInteger(thumbnail.width) && thumbnail.width > 0 && Number.isInteger(thumbnail.height) && thumbnail.height > 0
      && typeof thumbnail.alt === 'string' && thumbnail.alt.trim() && typeof thumbnail.partial === 'boolean'
      && design.screens.some(screen => screen.id === thumbnail.screen_id), 'Invalid thumbnail metadata');
    reference(thumbnail.url, 'thumbnail');
    check(dependencies.get(new URL(thumbnail.url).pathname.slice(1)) === thumbnail.sha256, 'Invalid thumbnail digest');
  }
  const collectionIds = new Set();
  for (const collection of extensions?.collections ?? []) {
    check(/^[a-z0-9][a-z0-9-]{0,63}$/.test(collection.id) && !collectionIds.has(collection.id), 'Repeated or invalid gallery collection');
    collectionIds.add(collection.id);
    check(Array.isArray(collection.items) && collection.items.length > 0
      && new Set(collection.items.map(item => item.setup_id)).size === collection.items.length, 'Invalid collection items');
    for (const item of collection.items) {
      const design = all.find(design => design.id === item.design_id);
      check(design && /^[a-z0-9][a-z0-9-]{0,63}$/.test(item.setup_id) && ['any', 'before', 'during', 'after'].includes(item.stage), 'Invalid collection design membership');
      if (item.pack_id) {
        check(packs.some(pack => pack.id === item.pack_id && pack.sha256 === item.pack_digest)
          && design.packs.some(pack => pack.id === item.pack_id), 'Invalid collection pack reference');
      } else check(bundled.includes(design) && !item.pack_digest, 'Missing collection delivery reference');
    }
    check(JSON.stringify(collection.design_ids) === JSON.stringify([...new Set(collection.items.map(item => item.design_id))]), 'Invalid collection design IDs');
    const event = collection.event;
    if (event) {
      check(event.date_basis === 'site-calendar' && event.end_semantics === 'exclusive' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(event.family)
        && ['start', 'end_exclusive', 'feature_start', 'feature_end_exclusive'].every(key =>
          /^\d{4}-\d{2}-\d{2}$/.test(event[key]) && new Date(event[key] + 'T12:00:00Z').toISOString().slice(0, 10) === event[key])
        && event.start < event.end_exclusive && event.feature_start < event.feature_end_exclusive
        && event.feature_start <= event.start && event.feature_end_exclusive <= event.end_exclusive, 'Invalid gallery event dates');
    }
  }
  return dependencies;
}

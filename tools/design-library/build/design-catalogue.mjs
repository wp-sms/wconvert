import { createHash } from 'node:crypto';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (ok, message) => { if (!ok) throw Error(message); };
const identifier = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,59}$/.test(value);

/** Explicit public projection: never spread source trees, setup data or download credentials. */
export function designCatalogue(packs, rows, origin, objects) {
  const designs = new Map();
  const add = (folder, extension, bytes) => {
    const sha256 = hash(bytes), key = `${folder}/${sha256}.${extension}`;
    if (!objects.some(object => object.key === key)) objects.push({ scope: 'public', key, bytes, sha256 });
    return `${origin}/${key}`;
  };
  for (const entry of [...packs].sort((a, b) => JSON.parse(a.json).id.localeCompare(JSON.parse(b.json).id))) {
    const pack = JSON.parse(entry.json), row = rows.find(row => row.id === pack.id);
    for (const design of pack.templates) {
      check(identifier(design.id) && ['free', 'pro'].includes(design.tier), 'Invalid public design identity or tier');
      const bindings = (pack.image_bindings ?? []).filter(binding => binding.template_id === design.id);
      const revision = hash(JSON.stringify({ design, assets: bindings.map(binding => [binding.node_id, pack.assets.find(asset => asset.id === binding.asset_id)?.sha256]) }));
      const delivery = { id: pack.id, access: entry.access === 'free' ? 'free' : 'pro' };
      const previous = designs.get(design.id);
      if (previous) {
        check(previous.revision === revision, 'Conflicting versions of one public design');
        previous.packs.push(delivery);
        continue;
      }
      const screens = design.tree.steps.flatMap(step => (step.results?.length ? step.results : [null]).map(result => ({
        id: step.id + (result ? '/' + result.id : ''),
        label: step.name + (result ? ` · ${result.heading}` : ''),
        step_id: step.id, ...(result ? { result_id: result.id } : {}),
      })));
      check(screens.length > 0 && screens.every(screen => typeof screen.step_id === 'string' && screen.step_id.length > 0)
        && new Set(screens.map(screen => screen.id)).size === screens.length, 'Invalid or duplicate public screens');
      const facts = entry.public_metadata?.[design.id];
      const item = {
        id: design.id, name: design.name, pack_id: pack.id, packs: [delivery],
        format: design.display_type, availability: design.tier, revision,
        ...(typeof facts?.description === 'string' && facts.description.trim() ? { description: facts.description } : {}),
        ...(typeof facts?.bundled === 'boolean' ? { bundled: facts.bundled } : {}),
        ...(facts?.bundled && ['free', 'pro'].includes(facts.bundle_tier) ? { bundle_tier: facts.bundle_tier } : {}),
        ...(facts?.prerequisites ? { prerequisites: { plugins: [...facts.prerequisites.plugins] } } : {}),
        screens, preview_status: 'unavailable',
      };
      const artwork = entry.gallery?.find(artwork => artwork.id === design.id);
      if (artwork) {
        check(row.preview_url && typeof artwork.embed === 'string' && Buffer.byteLength(artwork.embed) <= 2097152, 'Invalid focused preview');
        const thumbnail = artwork.thumbnail;
        check(Buffer.isBuffer(thumbnail.bytes) && thumbnail.bytes.length > 0 && thumbnail.bytes.length <= 5242880
          && Number.isInteger(thumbnail.width) && thumbnail.width > 0 && Number.isInteger(thumbnail.height) && thumbnail.height > 0
          && typeof thumbnail.alt === 'string' && thumbnail.alt.trim() && typeof thumbnail.partial === 'boolean'
          && screens.some(screen => screen.id === thumbnail.screen_id), 'Invalid public thumbnail');
        item.preview_status = 'available';
        item.preview_url = row.preview_url + '#design=' + encodeURIComponent(design.id);
        item.embed_url = add('previews', 'html', Buffer.from(artwork.embed));
        item.thumbnail = {
          url: add('thumbnails', 'jpg', thumbnail.bytes), width: thumbnail.width, height: thumbnail.height,
          alt: thumbnail.alt, partial: thumbnail.partial, screen_id: thumbnail.screen_id,
          sha256: hash(thumbnail.bytes),
        };
        for (const screen of screens) {
          screen.preview_url = item.preview_url + '&screen=' + encodeURIComponent(screen.id);
          screen.embed_url = item.embed_url + '#screen=' + encodeURIComponent(screen.id);
        }
      }
      designs.set(design.id, item);
    }
  }
  return [...designs.values()].sort((a, b) => a.id.localeCompare(b.id));
}

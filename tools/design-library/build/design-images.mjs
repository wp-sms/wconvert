/**
 * The JavaScript twin of `src/Template/Transfer/DesignImages.php` (ADR 0162):
 * every picture slot in a design, keyed by its path — an image's `src`, and a
 * `bg-image` in design, node or `narrow` tokens. A gradient is a style, not a
 * picture, and is no slot. `design-images.test.mjs` holds the two to the same
 * answer on one fixture.
 *
 * @return {Record<string, {path: (string|number)[], url: string, background: boolean}>}
 */
export function slots(design) {
  const found = {};
  const walk = (node, path) => {
    if (node?.type === 'image') {
      if (node.src !== undefined && typeof node.src !== 'string') throw new Error('This design has an invalid image address.');
      found[[...path, 'src'].join('/')] = { path: [...path, 'src'], url: typeof node.src === 'string' ? node.src : '', background: false };
    }
    for (const [key, value] of Object.entries(node)) {
      const at = Array.isArray(node) ? Number(key) : key;
      if ((key === 'tokens' || key === 'narrow') && value && typeof value === 'object' && !Array.isArray(value) && 'bg-image' in value) {
        const raw = value['bg-image'];
        if (typeof raw !== 'string') throw new Error('This design has an invalid background image.');
        let url;
        if (raw === 'none' || raw === '') url = '';
        else { const match = raw.match(/^url\(['"]?(.*?)['"]?\)$/s); if (!match) continue; url = match[1]; }
        found[[...path, key, 'bg-image'].join('/')] = { path: [...path, key, 'bg-image'], url, background: true };
      } else if (value && typeof value === 'object') walk(value, [...path, at]);
    }
  };
  walk(design, []);
  return found;
}

/** Write one slot's value in place. */
export function put(design, path, value) {
  let at = design;
  for (const key of path.slice(0, -1)) at = at[key];
  at[path.at(-1)] = value;
}

/**
 * A design object with each bound picture written into its slot as a data URI,
 * as an installed site shows it — what the contrast gate must measure text
 * against. `media` is `[{id, bytes, mime?}]`.
 */
export function withPictures(object, media) {
  const design = structuredClone({ tree: object.tree, tokens: object.tokens ?? {} }), found = slots(design);
  for (const binding of object.image_bindings ?? []) {
    const asset = object.assets.find(item => item.id === binding.asset_id), item = media.find(candidate => candidate.id === binding.asset_id), slot = found[binding.slot];
    if (!asset || !item || !slot || slot.url !== '') throw new Error(`Unbound picture: ${object.id} ${binding.slot}`);
    const uri = `data:${item.mime ?? asset.mime};base64,${item.bytes.toString('base64')}`;
    put(design, slot.path, slot.background ? `url("${uri}")` : uri);
  }
  return { ...object, ...design };
}

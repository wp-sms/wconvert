/** One-time prototype handoff. Review the generated native sources before publishing. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { designs } from './designs.mjs';

const root = path.resolve(import.meta.dirname, '../../..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const write = (file, value) => fs.writeFileSync(path.join(root, file), JSON.stringify(value, null, 2) + '\n');
const walk = (node, fn) => { fn(node); for (const key of ['children', 'start', 'end']) for (const child of node[key] ?? []) walk(child, fn); };
const slug = name => 'everyday-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
const catalog = read('tools/design-library/publishing/catalog.json');
const words = read('tools/design-library/publishing/designs.json');
const collection = read('tools/design-library/pilot/collection.json');
const provenance = read('tools/design-library/fresh-50-prototype/assets/provenance.json');
const generated = new Set(provenance.generated.map(asset => asset.id));
const freeImages = new Set();
for (const d of designs.filter(d => d.tier === 'Free')) for (const screen of d.tree.steps) walk(screen.content, n => { if (n.type === 'image') freeImages.add(path.basename(n.src, '.png')); });
const industry = {
  'Food & hospitality': 'food-drink', 'Retail & makers': 'retail', 'Culture & learning': 'books-publishing',
  'Travel & outdoors': 'travel-places', 'Home & wellbeing': 'home-garden', 'Playful & community': 'general', 'Work & services': 'professional-services',
};
const mapping = [];
for (const prototype of designs) {
  const id = slug(prototype.name), tier = prototype.tier.toLowerCase();
  const native = { id, name: prototype.name, display_type: prototype.display_type, tier, tokens: structuredClone(prototype.tokens), tree: structuredClone(prototype.tree) };
  const stringTokens = bag => Object.fromEntries(Object.entries(bag).map(([key, value]) => [key, String(value)]));
  native.tokens = stringTokens(native.tokens);
  native.tree.submissions ??= [];
  native.tree.fonts = [
    { family: 'DM Sans', faces: [{ weight: 400, italic: false }, { weight: 700, italic: false }] },
    { family: 'Instrument Serif', faces: [{ weight: 400, italic: false }] },
  ];
  for (const screen of native.tree.steps) walk(screen.content, node => {
    for (const bag of ['tokens', 'narrow']) if (node[bag]) node[bag] = stringTokens(node[bag]);
    if (node.type === 'image') {
      const name = path.basename(node.src, '.png');
      const file = `tools/design-library/pilot/assets/everyday/${name}.webp`;
      const bytes = fs.readFileSync(path.join(root, file));
      node.src = `data:image/webp;base64,${bytes.toString('base64')}`;
      const hash = createHash('sha256').update(bytes).digest('hex');
      catalog.image_rights[hash] = { kind: generated.has(name) ? 'ai-generated' : 'original', source: `Original WConvert Everyday prototype artwork, ${name}. See pilot/assets/everyday/README.md.`, redistribution: true, reviewedBy: 'Codex, prototype provenance review, 2026-10-24', access: freeImages.has(name) ? 'free' : 'premium' };
    }
    if (node.type === 'consent') node.hidden = true;
    if (node.type === 'button' && node.action === 'link') delete node.href;
    if (node.type === 'followup') { delete node.href; node.hidden = true; node.label = 'Open the resource'; }
  });
  // One-time enquiries still expose the native optional consent capability.
  // Privacy Guidance keeps it hidden for their request purpose.
  if (native.tree.submissions?.[0] && !native.tree.submissions[0].consents.length) {
    let max = 0;
    native.tree.steps.forEach(s => walk(s.content, n => { max = Math.max(max, Number(n.id?.slice(1)) || 0); }));
    const consent = { type: 'consent', id: `n${max + 1}`, role: 'consent_text', text: 'I agree to receive marketing emails. Unsubscribe anytime.', hidden: true };
    let form;
    walk(native.tree.steps[0].content, n => { if (n.children?.some(child => child.type === 'button' && child.action === 'submit')) form = n; });
    if (!form) throw Error(`No form container in ${id}`);
    form.children.push(consent);
    native.tree.submissions[0].consents.push(consent.id);
  }
  const directory = tier === 'free' ? 'tools/design-library/hosted' : 'pro/modules/display-types';
  const goal = !prototype.capture ? 'promote_offer' : native.tree.submissions[0].purpose === 'request' ? 'collect_enquiries' : 'grow_email_list';
  for (const submission of native.tree.submissions ?? []) delete submission.purpose;
  write(`${directory}/templates/${id}.json`, native);
  const audience = goal === 'collect_enquiries' || prototype.category === 'Work & services' ? 'services' : prototype.category === 'Culture & learning' ? 'publishers' : 'stores';
  const requirements = [
    goal === 'promote_offer' ? 'Set the action link and review the offer wording.' : goal === 'collect_enquiries' ? 'Choose where requests are collected and how your team will reply.' : 'Choose an email destination or Collect only, and review the signup wording.',
    ...(prototype.reward ? ['Create a valid coupon and match its value, saving and terms.'] : []),
    ...(prototype.resource ? ['Add the promised resource URL and show its acknowledgement button before publishing.'] : []),
    ...(prototype.timer ? ['Set a real campaign end date and match every written deadline. The countdown uses that saved date.'] : []),
    ...(prototype.display_type === 'inline' ? ['Place the campaign using its block or shortcode.'] : []),
  ];
  mapping.push({ id: prototype.id, native_id: id, name: prototype.name, tier, goal, audience, requirements, idea: prototype.idea, directory, screens: native.tree.steps.map(s => ({ id: s.id, name: s.name })) });
  words.designs[id] = { description: `${prototype.name}: ${goal === 'promote_offer' ? 'a focused offer or information link' : goal === 'collect_enquiries' ? 'a practical enquiry form' : prototype.resource ? 'an email signup with a useful resource' : 'an email signup'} in a ${prototype.format.toLowerCase()} layout.`, industries: [industry[prototype.category]], occasions: [prototype.timer ? (goal === 'promote_offer' ? 'sale' : 'launch') : 'evergreen'], style: [['07', '16', '21', '27', '36', '39', '44'].includes(prototype.id) ? 'minimal' : ['06', '12', '37', '49'].includes(prototype.id) ? 'soft' : ['15', '25', '26', '30', '32'].includes(prototype.id) ? 'crisp' : 'editorial'], colour: [{ '#fff5df': 'warm', '#173fda': 'cool', '#fbd7cb': 'warm', '#183e35': 'green', '#f3efe6': 'neutral', '#30213d': 'dark', '#e2d8ef': 'cool', '#f16b37': 'warm', '#8d242d': 'warm', '#e2edf1': 'cool' }[prototype.tokens.bg] ?? 'neutral'] };
  collection.entries = collection.entries.filter(entry => entry.id !== id);
  collection.entries.push({ id, audience, family: prototype.name, visitor_need: requirements[0], difference: prototype.idea, requirements, status: 'review', source: 'User-approved Everyday, extraordinary prototype, 24 October 2026.', suggested_setup: requirements, measure: prototype.capture ? 'Accepted requests, not confirmed subscriptions or bookings.' : 'Offer or information link clicks.', batch: 'everyday-extraordinary', comparison: { decision: 'new_design', against: ['winter-paper-pine'], reason: prototype.idea } });
}
collection.batches = collection.batches.filter(b => b.id !== 'everyday-extraordinary');
collection.batches.push({ id: 'everyday-extraordinary', name: 'Everyday, extraordinary' });
write('tools/design-library/publishing/catalog.json', catalog);
write('tools/design-library/publishing/designs.json', words);
write('tools/design-library/pilot/collection.json', collection);
write('docs/reviews/everyday-2026-10-24/prototype-map.json', mapping);
console.log('Wrote 50 native designs: 35 Pro, 15 hosted Free. Generate matching Playbooks from native SlotRoles next.');

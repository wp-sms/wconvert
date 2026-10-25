import type { Collection, OnlineCollectionMember } from '../../../resources/admin/src/discovery/api';

export function onlineCollection(): Collection {
  const online: OnlineCollectionMember[] = Array.from({ length: 20 }, (_, index) => {
    const id = `sale-${index + 1}`;
    const tier = index < 5 ? 'free' : 'pro';
    const state = tier === 'free' ? 'install' : 'locked';
    return {
      stage: index < 4 ? 'before' : 'during', playbook_id: null,
      setup: { id, name: `Sale setup ${index + 1}`, revision: 1, sha256: 'a'.repeat(64), tier, state, goal: index === 0 ? 'promote_offer' : 'grow_email_list', design: { id, revision: 1 } },
      design: { id, name: `Sale design ${index + 1}`, revision: 1, sha256: 'b'.repeat(64), tier, state, format: 'popup', family: null, slug: id, tags: [], thumbnail: { '1x': `https://example.com/${id}.webp`, '2x': `https://example.com/${id}@2x.webp` }, popularity: null, local_revision: null },
    };
  });
  return { id: 'catalog-shopping', revision: 'r', name: 'Shopping weekend', description: 'Twenty sale designs', cover: 'sale', priority: 100, business_types: [], online, items: online.map(member => ({ setup_id: member.setup.id, stage: member.stage })) };
}

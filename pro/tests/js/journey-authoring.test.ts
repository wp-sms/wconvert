import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { journeyAuthoring } from '@/journeyAuthoring';
import { registerJourneyAuthoring } from '../../modules/journeys/admin/register';

/**
 * Journey authoring is Pro's code in Pro's bundle (ADR 0147). The server's
 * `journeys` flag says the module shipped; these slots are what makes the
 * editor appear. A flag that is true over an empty slot is a build bug: the
 * merchant would see a journey with nothing to edit it with.
 */
describe('journey authoring slots', () => {
  it('fills every slot free leaves open', () => {
    registerJourneyAuthoring();
    const slots = ['question', 'result', 'screenCondition', 'route'] as const;
    for (const slot of slots) expect(journeyAuthoring[slot], slot).toBeTypeOf('function');
    expect(Object.keys(journeyAuthoring).sort()).toEqual([...slots].sort());
  });

  it("is registered by Pro's admin entry", () => {
    const entry = readFileSync(resolve(import.meta.dirname, '../../resources/admin/src/main.tsx'), 'utf8');
    expect(entry).toMatch(/^registerJourneyAuthoring\(\);$/m);
  });
});

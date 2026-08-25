import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@renderer/render';
import type { TemplateNode } from '@renderer/types';

/**
 * The renderer's half of the consent-sentence parity.
 *
 * The [[Consent Record]] is the wording **exactly as it was shown**, and two
 * programs decide what that is: this renderer draws it in the browser, and
 * `src/Lead/ConsentRecord.php` composes the evidence on the server. Neither
 * can defer to the other — the renderer is a pure function with no server, and
 * the server cannot trust a wording a public endpoint's client supplied
 * (ADR 0032).
 *
 * So they are two spellings of one rule, and the fixture is what stops them
 * drifting. `tests/unit/Lead/ConsentSentenceParityTest.php` reads the same
 * file and asserts the same strings, exactly as the rule and template
 * manifests are held together from both sides (ADR 0005, ADR 0010).
 */

interface Case {
  readonly why: string;
  readonly node: TemplateNode;
  readonly shown: string;
}

const FIXTURE = resolve(import.meta.dirname, '../fixtures/consent-sentences.json');
const { cases } = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { cases: readonly Case[] };

describe('the consent sentence, as the renderer draws it', () => {
  it.each(cases)('$why', ({ node, shown }) => {
    const root = render({ steps: [{ type: 'stack', children: [node] }] }, {});

    expect(root.querySelector('.wc-consent-text')?.textContent).toBe(shown);
  });

  /**
   * The other half of "no dead `#`": with no href resolved there is no anchor
   * at all, not an anchor pointing nowhere (ADR 0032).
   */
  it('renders no anchor where the sentence carries no resolved link', () => {
    for (const { node, shown } of cases) {
      const root = render({ steps: [{ type: 'stack', children: [node] }] }, {});
      const anchor = root.querySelector('.wc-consent-text a');

      expect(anchor === null).toBe(!shown.includes('privacy policy'));
    }
  });
});

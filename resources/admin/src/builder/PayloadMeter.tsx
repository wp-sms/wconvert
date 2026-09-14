import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { adminSettings } from '../settings';
import type { Template } from '@renderer/types';

/**
 * What this design costs a visitor, measured while it is being spent.
 *
 * ============================================================================
 * A SCOPE IS BYTES, AND THE ONLY OTHER PLACE THAT SHOWS IS A FAILING BUILD.
 * ============================================================================
 * An Optin's design rides the page payload on every matching view, against a
 * budget ADR 0010 set and `PayloadBudgetTest` has held ever since. Until
 * ADR 0062 the merchant could not move that number much: tokens are a fixed set
 * of short strings. A token bag per box is different — it is repeatable, it
 * nests, and a design restyled box by box can grow without anything on screen
 * saying so.
 *
 * So the cost is on screen where it is spent. It is **not a warning and not a
 * refusal**: nothing at runtime reads this budget, a design over it still
 * renders, and the merchant is told rather than stopped.
 *
 * ============================================================================
 * GZIPPED, BECAUSE THAT IS THE NUMBER THE BUDGET IS IN.
 * ============================================================================
 * `CompressionStream` is what makes the meter honest. Raw JSON bytes are three
 * to four times the real figure and would read as alarming on a design that is
 * nowhere near the cap — a meter that lies pessimistically teaches a merchant
 * to ignore it, which is worse than no meter (ADR 0042 rule 2).
 *
 * Where the browser has no `CompressionStream`, the meter draws NOTHING rather
 * than falling back to raw bytes under the same label. There is no honest way
 * to print a figure in the wrong unit beside a budget.
 */
export function PayloadMeter({ template }: { template: Template }) {
  const budget = adminSettings()?.designBudget;
  const bytes = useGzippedSize(template);

  if (budget === undefined || bytes === null) {
    return null;
  }

  const share = bytes / budget;

  return (
    <span
      className="wconvert-meter"
      data-over={share > 1 ? 'true' : undefined}
      /*
        **`title` and not a permanent second line.** The share is the thing a
        merchant reads at a glance and the two numbers behind it are what they
        want once — which is exactly the split between a label and a tooltip.
      */
      title={sprintf(
        /* translators: 1: how many bytes this design costs, gzipped. 2: the per-design budget in bytes. */
        __('%1$s bytes of %2$s, compressed, on every page this Campaign shows on.', 'wconvert'),
        bytes.toLocaleString(),
        budget.toLocaleString(),
      )}
    >
      {sprintf(
        /* translators: %d: what share of the per-design size budget this design uses, as a percentage. */
        __('%d%% of the size budget', 'wconvert'),
        Math.round(share * 100),
      )}
    </span>
  );
}

/**
 * The design's snapshot, gzipped, in bytes — or null while it is being measured
 * and on a browser that cannot.
 *
 * **It measures the same two keys the payload carries** — `tree` and `tokens` —
 * rather than the whole config, because the rest of an Optin's config is rules
 * and destinations and neither reaches the browser (`PublishedProjection`
 * strips more than it keeps). A meter counting bytes a visitor never downloads
 * is a meter about the wrong thing.
 *
 * Re-measured on every edit, and that is affordable for the same reason the
 * preview remounting on every keystroke is: the work is proportional to one
 * design, and `CompressionStream` does it off the main thread.
 */
function useGzippedSize(template: Template): number | null {
  const json = JSON.stringify({ tree: template.tree, tokens: template.tokens });
  const [size, setSize] = useState<number | null>(null);

  useEffect(() => {
    let live = true;

    gzippedLength(json)
      .then((bytes) => {
        if (live) {
          setSize(bytes);
        }
      })
      /*
        A meter is not worth an error surface. The one failure mode is a browser
        with no `CompressionStream`, which is a browser this cannot honestly
        measure on — so it draws nothing, which is what `null` already means.
      */
      .catch(() => {
        if (live) {
          setSize(null);
        }
      });

    return () => {
      live = false;
    };
  }, [json]);

  return size;
}

async function gzippedLength(json: string): Promise<number | null> {
  if (typeof CompressionStream === 'undefined') {
    return null;
  }

  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));

  return (await new Response(stream).arrayBuffer()).byteLength;
}

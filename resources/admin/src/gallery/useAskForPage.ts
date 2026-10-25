import { useEffect } from 'react';

/**
 * A page's live cards are asked for together, as soon as the page is drawn,
 * so a page is one request: `useSetupPreviews` and `useTemplateTrees` batch a
 * tick and drop what they already have (ADR 0171 §11). A stage still draws
 * only near the viewport.
 *
 * `from` is the list the keys come from: a new one asks again, so a setup
 * whose revision moved in a re-read gallery is fetched once more.
 */
export function useAskForPage(keys: readonly string[], ask: (key: string) => void, from?: unknown) {
  // Joined so a page that renders again with the same cards asks nothing.
  const page = keys.join('\n');
  useEffect(() => {
    for (const key of page.split('\n')) if (key !== '') ask(key);
  }, [page, ask, from]);
}

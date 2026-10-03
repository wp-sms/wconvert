import { useEffect, useRef, useState } from 'react';

/** Long enough that typing a word is one request, short enough to feel live. */
const DEBOUNCE_MS = 250;

type SearchResult<Hit> = { scope: string; query: string } & (
  { status: 'ready'; hits: readonly Hit[] } | { status: 'error' }
);

/**
 * The search half of a name-finding combobox: debounced, with the previous
 * request cancelled. Shared by {@link ObjectPicker} and `LinkField`, which
 * differ in what they search and what a pick stores, not in how they search.
 *
 * Only the current scope and query's results are returned, including during
 * the debounce. Every completion checks cancellation — aborting alone does not
 * stop a completed or non-cancellable response overwriting a newer query — and
 * a failed search has its own state rather than pretending WordPress returned
 * no matches.
 *
 * `scope` is part of the identity of a result: the picker's `post` hits must
 * never be offered after it switches to `term`.
 */
export function useObjectSearch<Hit>(
  search: (query: string, signal: AbortSignal) => Promise<readonly Hit[]>,
  scope: string,
  query: string | null,
  enabled: boolean,
) {
  const [result, setResult] = useState<SearchResult<Hit> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState(0);
  // The latest search function, so an inline arrow from the caller does not
  // restart the debounce on every render. Declared before the search effect,
  // so it is current by the time that effect runs.
  const latest = useRef(search);
  useEffect(() => { latest.current = search; });

  useEffect(() => {
    if (query === null || !enabled) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      latest.current(query, controller.signal)
        .then((found) => {
          if (controller.signal.aborted) return;
          setResult({ scope, query, status: 'ready', hits: found });
          setActive(0);
        })
        .catch(() => {
          if (!controller.signal.aborted) setResult({ scope, query, status: 'error' });
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [scope, enabled, query, attempt]);

  const current = enabled && result?.scope === scope && result.query === query ? result : null;

  return {
    searching: enabled && query !== null && current === null,
    failed: current?.status === 'error',
    hits: current?.status === 'ready' ? current.hits : [],
    active,
    setActive,
    /** Forget the last answer, so the next one is awaited rather than reused. */
    reset: () => setResult(null),
    retry: () => {
      setResult(null);
      setAttempt((at) => at + 1);
    },
  };
}

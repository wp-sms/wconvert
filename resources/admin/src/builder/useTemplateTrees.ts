import { useCallback, useEffect, useRef, useState } from 'react';
import type { Template } from '@renderer/types';

/** Fetch only nearby trees, in batches within the server's 24-design limit. */
export function useTemplateTrees(
  fetchTrees: (ids: readonly string[]) => Promise<{ templates: (Template & { id: string })[] }>,
) {
  const [trees, setTrees] = useState<ReadonlyMap<string, Template>>(new Map());
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const asked = useRef(new Set<string>());
  const pending = useRef(new Set<string>());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const want = useCallback((id: string) => {
    if (asked.current.has(id) || pending.current.has(id)) return;
    pending.current.add(id);
    if (pending.current.size > 1) return;

    void Promise.resolve().then(() => {
      if (!alive.current) return;
      const all = [...pending.current];
      pending.current.clear();
      for (const each of all) asked.current.add(each);

      for (let offset = 0; offset < all.length; offset += 24) {
        const batch = all.slice(offset, offset + 24);
        void fetchTrees(batch).then(({ templates }) => {
          if (!alive.current) return;
          const returned = new Set(templates.map((design) => design.id));
          setTrees((current) => {
            const next = new Map(current);
            for (const design of templates) next.set(design.id, { tree: design.tree, tokens: design.tokens });
            return next;
          });
          setFailed((current) => {
            const next = new Set(current);
            for (const each of batch) {
              if (returned.has(each)) next.delete(each);
              else next.add(each);
            }
            return next;
          });
        }).catch(() => {
          if (alive.current) setFailed((current) => new Set([...current, ...batch]));
        });
      }
    });
  }, [fetchTrees]);

  const retry = useCallback((id: string) => {
    asked.current.delete(id);
    setFailed((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    want(id);
  }, [want]);

  return { trees, failed, want, retry };
}

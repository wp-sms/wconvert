import { useCallback, useEffect, useRef, useState } from 'react';
import { previewPlaybooks, type PlaybookEntry } from '../goals/api';

/** Only visible cards request actual Prefill trees. One frame batches up to 24. */
export function useSetupPreviews(goal: string, entries: readonly PlaybookEntry[]) {
  const [previews, setPreviews] = useState<Map<string, PlaybookEntry>>(new Map());
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [epoch, setEpoch] = useState(0);
  const state = useRef({ entries, goal, requested: new Map<string, string>(), queue: new Set<string>(), scheduled: false, generation: 0, epoch: 0 });
  state.current.entries = entries;
  if (state.current.goal !== goal) {
    state.current.goal = goal; state.current.generation++; state.current.requested.clear(); state.current.queue.clear(); state.current.scheduled = false;
  }
  useEffect(() => () => { state.current.generation++; }, []);
  const onNear = useCallback((id: string) => {
    const current = state.current;
    if (!goal || current.goal !== goal || current.epoch !== epoch) return;
    const entry = current.entries.find(value => value.id === id);
    if (!entry || !entry.revision || current.requested.get(id) === entry.revision || entry.template || (entry.availability && entry.availability !== 'ready')) return;
    current.requested.set(id, entry.revision); current.queue.add(id);
    setFailed(values => new Set([...values].filter(value => value !== id)));
    if (current.scheduled) return;
    current.scheduled = true; const generation = current.generation;
    queueMicrotask(() => {
      if (generation !== current.generation) return;
      current.scheduled = false;
      const queued = [...current.queue]; current.queue.clear();
      for (let at = 0; at < queued.length; at += 24) {
        const ids = queued.slice(at, at + 24);
        void previewPlaybooks(goal, ids).then(result => {
          if (generation !== current.generation) return;
          const returned = new Map(result.entries.map(value => [value.id, value]));
          const valid = ids.filter(id => returned.get(id)?.revision === current.entries.find(value => value.id === id)?.revision);
          setPreviews(values => new Map([...values, ...valid.map(id => [id, returned.get(id)!] as const)]));
          setFailed(values => new Set([...values, ...ids.filter(id => !valid.includes(id))]));
        }).catch(() => { if (generation === current.generation) setFailed(values => new Set([...values, ...ids])); });
      }
    });
  }, [goal, epoch]);
  const reset = () => {
    const current = state.current;
    current.generation++; current.requested.clear(); current.queue.clear(); current.scheduled = false;
    current.epoch++; setPreviews(new Map()); setFailed(new Set()); setEpoch(current.epoch);
  };
  const retry = (id: string) => {
    state.current.requested.delete(id); setFailed(values => new Set([...values].filter(value => value !== id))); onNear(id);
  };
  return { previews, failed, onNear, retry, reset };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { routeFrom } from '../nav';

const POSITION = 'wconvertNavigationPosition';
interface Entry { hash: string; position: number }
export interface EditingState { dirty: boolean; busy: boolean }

/** Keeps the editor mounted while a requested route awaits the merchant's decision. */
export function useAdminNavigation() {
  const [entry, setEntry] = useState<Entry>(() => ({
    hash: window.location.hash,
    position: typeof window.history.state?.[POSITION] === 'number' ? window.history.state[POSITION] : 0,
  }));
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const accepted = useRef(entry);
  const locationPosition = useRef(entry.position);
  const editing = useRef<EditingState>({ dirty: false, busy: false });
  const [pending, setPending] = useState<Entry | null>(null);
  const requested = useRef<Entry | null>(null);

  const ask = useCallback((next: Entry) => {
    if (requested.current === null && document.activeElement instanceof HTMLElement) {
      returnFocusTo.current = document.activeElement;
    }
    requested.current = next;
    setPending(next);
  }, []);

  const accept = useCallback((next: Entry) => {
    accepted.current = next;
    editing.current = { dirty: false, busy: false };
    requested.current = null;
    setPending(null);
    setEntry(next);
  }, []);

  const restore = useCallback(() => {
    requested.current = null;
    setPending(null);
    const previous = accepted.current;
    const distance = previous.position - locationPosition.current;
    if (distance !== 0) window.history.go(distance);
    else window.history.replaceState(window.history.state, '', previous.hash || window.location.pathname + window.location.search);
  }, []);

  useEffect(() => {
    window.history.replaceState({ ...window.history.state, [POSITION]: accepted.current.position }, '');
    const follow = () => {
      const stored = window.history.state?.[POSITION];
      const position = typeof stored === 'number' ? stored : locationPosition.current + 1;
      if (typeof stored !== 'number') {
        window.history.replaceState({ ...window.history.state, [POSITION]: position }, '');
      }
      locationPosition.current = position;
      const next = { hash: window.location.hash, position };
      if (next.hash === accepted.current.hash) {
        // A hash can occur more than once in browser history. Keeping this
        // mounted draft must also adopt the entry actually under the cursor.
        accepted.current = next;
        requested.current = null;
        setPending(null);
        setEntry(next);
        return;
      }
      if (editing.current.busy) { restore(); return; }
      if (editing.current.dirty) {
        ask(next); return;
      }
      accept(next);
    };
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, [accept, ask, restore]);

  const navigate = useCallback((hash: string) => {
    if (hash === accepted.current.hash) return;
    const next = { hash, position: locationPosition.current + 1 };
    window.history.pushState({ ...window.history.state, [POSITION]: next.position }, '', hash);
    locationPosition.current = next.position;
    accept(next);
  }, [accept]);

  /** A visible way out without its own discard confirmation, such as opening a new campaign's editor from creation. */
  const requestNavigation = useCallback((hash: string) => {
    if (editing.current.busy || hash === accepted.current.hash) return;
    if (!editing.current.dirty) { navigate(hash); return; }
    const next = { hash, position: locationPosition.current + 1 };
    window.history.pushState({ ...window.history.state, [POSITION]: next.position }, '', hash);
    locationPosition.current = next.position;
    ask(next);
  }, [ask, navigate]);

  const onEditingStateChange = useCallback((state: EditingState) => { editing.current = state; }, []);
  return {
    returnFocusTo,
    hash: entry.hash,
    route: routeFrom(entry.hash),
    navigate,
    requestNavigation,
    onEditingStateChange,
    pending: pending !== null,
    stay: restore,
    discard: () => { if (requested.current !== null) accept(requested.current); },
  };
}

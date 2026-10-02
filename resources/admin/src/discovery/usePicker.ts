import { useCallback, useEffect, useRef, useState } from 'react';
import { messageOf } from '../shell/loadable';
import { pickerData, saveOccasions, savePreferences, type PickerData, type PickerPreferences, type Occasion } from './api';
import { siteDay } from './model';

/** Stale reads cannot overwrite a save. Errors preserve the usable local library. */
export function usePicker() {
  const [data, setData] = useState<PickerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const operation = useRef(0); const mounted = useRef(false); const writing = useRef(false);
  const clock = useRef<{ server: number; received: number; timezone: string; offset: number } | null>(null);
  const reload = useCallback(async () => {
    if (writing.current) return;
    const request = ++operation.current;
    try { const result = await pickerData(); if (mounted.current && request === operation.current) {
      clock.current = result.server_time === undefined ? null : { server: result.server_time * 1000, received: performance.now(), timezone: result.timezone, offset: result.timezone_offset ?? 0 };
      setData(result); setError(null);
    } }
    catch (cause) { if (mounted.current && request === operation.current) setError(messageOf(cause)); }
  }, []);
  useEffect(() => { mounted.current = true; void reload();
    const resume = () => { if (document.visibilityState === 'visible') void reload(); };
    document.addEventListener('visibilitychange', resume);
    const generation = operation;
    return () => { mounted.current = false; generation.current++; document.removeEventListener('visibilitychange', resume); };
  }, [reload]);
  useEffect(() => {
    // No remote refresh. An open/offline picker expires placement at site midnight.
    const timer = window.setInterval(() => {
      const value = clock.current;
      if (!value || document.visibilityState !== 'visible') return;
      const today = siteDay(value.server + performance.now() - value.received, value.timezone, value.offset);
      setData(previous => previous && previous.today !== today ? { ...previous, today } : previous);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const preferences = async (next: PickerPreferences) => {
    if (writing.current) return;
    writing.current = true; const request = ++operation.current; setSaving(true); setError(null);
    try { const result = await savePreferences(next); if (mounted.current && request === operation.current) setData(value => value && ({ ...value, preferences: result })); }
    catch (cause) { if (mounted.current && request === operation.current) setError(messageOf(cause)); return false; }
    finally { writing.current = false; if (mounted.current) setSaving(false); }
  };
  const occasions = async (items: Occasion[]) => {
    if (writing.current || !data) return;
    writing.current = true; const request = ++operation.current; setSaving(true); setError(null);
    try { const result = await saveOccasions({ ...data.occasions, items }); if (mounted.current && request === operation.current) setData(value => value && ({ ...value, occasions: result })); return true; }
    catch (cause) { if (mounted.current && request === operation.current) setError(messageOf(cause)); return false; }
    finally { writing.current = false; if (mounted.current) setSaving(false); }
  };
  const toggleSaved = (key: string) => {
    if (!data) return;
    const saved = data.preferences.saved.includes(key) ? data.preferences.saved.filter(id => id !== key) : [...data.preferences.saved, key];
    void preferences({ ...data.preferences, saved });
  };
  return { data, error, saving, reload, preferences, occasions, toggleSaved };
}

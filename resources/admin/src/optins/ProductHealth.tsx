import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { readProductHealth, type ProductHealth } from './api';

/** Check only displayed campaigns, bounded batches, and discard superseded reads. */
export function useProductHealth(ids: string, refresh: number) {
  const [state, setState] = useState<{ key: string; rows: Record<string, ProductHealth>; loading: boolean; failed: boolean }>({ key: '', rows: {}, loading: false, failed: false });
  const [attempt, setAttempt] = useState(0);
  const key = `${ids}:${refresh}:${attempt}`;
  useEffect(() => {
    if (!ids) return;
    const controller = new AbortController();
    setState({ key, rows: {}, loading: true, failed: false });
    const timer = setTimeout(() => {
      controller.abort();
      setState({ key, rows: {}, loading: false, failed: true });
    }, 20000);
    void (async () => {
      const values = ids.split(',');
      const rows: Record<string, ProductHealth> = {};
      try {
        for (let i = 0; i < values.length; i += 12) {
          if (controller.signal.aborted) return;
          const batch = values.slice(i, i + 12);
          const result = await readProductHealth(batch, controller.signal);
          for (const id of batch) {
            const row = result.find(value => value.id === id);
            if (!row) throw Error('Incomplete product check');
            rows[id] = row;
          }
        }
        if (!controller.signal.aborted) setState({ key, rows, loading: false, failed: false });
      } catch {
        if (!controller.signal.aborted) setState({ key, rows: {}, loading: false, failed: true });
      } finally { clearTimeout(timer); }
    })();
    return () => { clearTimeout(timer); controller.abort(); };
  }, [ids, key]);
  const current = state.key === key ? state : { rows: {} as Record<string, ProductHealth>, loading: !!ids, failed: false };
  return { ...current, recheck: () => setAttempt(n => n + 1) };
}

export function productHealthLabel(health?: ProductHealth): string | null {
  if (!health) return null;
  const warnings = health.checks.filter(check => check.state === 'warning').length;
  if (warnings) return sprintf(_n('%d product warning', '%d product warnings', warnings, 'wconvert'), warnings);
  if (health.checks.some(check => check.state === 'unknown')) return __('Products not checked', 'wconvert');
  if (health.checks.some(check => check.state === 'context')) return __('Check a sample basket', 'wconvert');
  return null;
}

export function ProductHealthDetails({ health, loading, failed, onRecheck, onReview, reviewDisabled }: { health?: ProductHealth; loading: boolean; failed: boolean; onRecheck: () => void; onReview?: () => void; reviewDisabled?: boolean }) {
  if (!loading && !failed && (!health || health.checks.length === 0)) return null;
  return <section className="wconvert-product-health" aria-label={__('Product check', 'wconvert')}>
    <div className="wconvert-product-health-heading">
      <h3>{__('Product check', 'wconvert')}</h3>
      <Button variant="outline" disabled={loading} onClick={onRecheck}>{__('Check again', 'wconvert')}</Button>
    </div>
    {loading ? <p role="status">{__('Checking products…', 'wconvert')}</p> : failed ? <p role="alert">{__('Products could not be checked. Try again.', 'wconvert')}</p> : health && <>
      <p className="wconvert-product-health-scope">{health.basis === 'published' ? __('Published version · current catalog', 'wconvert') : __('Saved draft · current catalog', 'wconvert')}</p>
      <ul>{health.checks.map((check, index) => <li key={index} data-state={check.state}>
        <strong>{check.label}</strong>
        <p>{check.message}</p>
      </li>)}</ul>
      {onReview && health.checks.some(check => check.state === 'warning' || check.state === 'context') && <Button disabled={reviewDisabled} onClick={onReview}>{__('Review products', 'wconvert')}</Button>}
    </>}
  </section>;
}

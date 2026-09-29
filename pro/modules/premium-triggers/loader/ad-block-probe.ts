/** A bounded observation of cosmetic interference with an ad-like element. */
export type AdBlockStatus = 'pending' | 'detected' | 'not_detected' | 'unknown';

export function probeAdBlocking(settled: (status: AdBlockStatus) => void): () => void {
  let stopped = false;
  let host: HTMLElement | null = null;
  let bait: HTMLElement | null = null;
  let control: HTMLElement | null = null;
  const timers: number[] = [];
  const samples: Array<'blocked' | 'clear' | 'invalid'> = [];

  function clean(): void {
    for (const timer of timers) window.clearTimeout(timer);
    timers.length = 0;
    document.removeEventListener('visibilitychange', visibility);
    document.removeEventListener('prerenderingchange', begin);
    document.removeEventListener('DOMContentLoaded', begin);
    host?.remove();
    host = bait = control = null;
  }

  function finish(status: AdBlockStatus): void {
    if (stopped) return;
    stopped = true;
    clean();
    settled(status);
  }

  function visible(element: HTMLElement): boolean {
    if (!element.isConnected) return false;
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && box.width >= 8 && box.height >= 8;
  }

  function sample(): void {
    try {
      if (!host?.isConnected || !control || !bait || !visible(control)) samples.push('invalid');
      else samples.push(visible(bait) ? 'clear' : 'blocked');
    } catch {
      samples.push('invalid');
    }
    if (samples.length !== 3) return;
    const blocked = samples.filter(value => value === 'blocked').length;
    finish(blocked >= 2 && !samples.includes('clear') ? 'detected'
      : samples.every(value => value === 'clear') ? 'not_detected' : 'unknown');
  }

  function visibility(): void {
    if (host && document.hidden) finish('unknown');
    else if (!host) begin();
  }

  function begin(): void {
    if (stopped || host || !document.body || document.hidden || (document as Document & { prerendering?: boolean }).prerendering) return;
    try {
      host = document.createElement('div');
      host.style.cssText = 'position:absolute;left:-9999px;top:0;width:12px;height:24px;pointer-events:none';
      control = document.createElement('div');
      bait = document.createElement('div');
      bait.className = 'adsbox ad-banner adsbygoogle';
      for (const element of [control, bait]) element.style.cssText = 'width:10px;height:10px;display:block';
      host.append(control, bait);
      document.body.append(host);
      for (const delay of [50, 250, 750]) timers.push(window.setTimeout(sample, delay));
      timers.push(window.setTimeout(() => finish('unknown'), 1000));
    } catch {
      finish('unknown');
    }
  }

  document.addEventListener('visibilitychange', visibility);
  document.addEventListener('prerenderingchange', begin);
  if (!document.body) document.addEventListener('DOMContentLoaded', begin, { once: true });
  else begin();
  return () => { stopped = true; clean(); };
}

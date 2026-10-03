import { createAnalytics, type AnalyticsConfig, type Status } from './analytics';

interface PageConfig extends AnalyticsConfig { debug?: boolean; environment?: string; labels: string[]; statuses: Record<Status, string>; }
function start() {
  const element = document.getElementById('wconvert-analytics-config');
  if (!element) return;
  let config: PageConfig;
  try { config = JSON.parse(element.textContent ?? ''); } catch { return; }
  const analytics = createAnalytics(config);
  let active = true;
  let report: (id: string, kind: string, status: Status) => void = () => { /* Only explicit diagnostic pages retain observations. */ };
  window.__wcvObserve = session => ({
    ...session,
    show(entry, controls) {
      // The observer sees the presentation boundary; the provider gets only an ID and semantic act.
      const id = entry.id;
      for (const kind of Object.keys(controls) as (keyof typeof controls)[]) {
        const act = controls[kind];
        controls[kind] = () => {
          try { if (active) report(id, kind, analytics.observe(id, kind)); } catch { /* Tracking cannot interrupt a campaign. */ }
          act();
        };
      }
      return session.show(entry, controls);
    },
  });
  const captured = (event: Event) => {
    const detail = (event as CustomEvent<{ optinId?: string }>).detail;
    if (typeof detail?.optinId === 'string') report(detail.optinId, 'capture', analytics.observe(detail.optinId, 'capture'));
  };
  document.addEventListener('wconvert:capture', captured);
  if (!config.debug) return;
  const host = document.createElement('aside'); host.setAttribute('aria-label', config.labels[0]);
  Object.assign(host.style, { position: 'fixed', bottom: '16px', insetInlineEnd: '16px', zIndex: '2147483647', maxWidth: 'min(400px,90vw)' });
  const root = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = ':host{font:14px/1.5 system-ui;color:#17202a}section{background:white;border:1px solid #aaa;border-radius:8px;padding:16px;max-height:60vh;overflow:auto;box-shadow:0 4px 20px #0003}input,button{font:inherit;max-width:100%;box-sizing:border-box;padding:6px;margin:4px 0}ol{padding-inline-start:20px;overflow-wrap:anywhere}';
  const panel = document.createElement('section');
  const heading = document.createElement('strong'); heading.textContent = config.labels[0];
  const note = document.createElement('p'); note.textContent = `${config.labels[1]} (${config.environment}; ${config.consent === 'site' ? config.labels[7] : 'WP Consent API'})`;
  const target = document.createElement('input'); target.placeholder = config.labels[3]; target.setAttribute('aria-label', config.labels[3]);
  target.hidden = config.route !== 'gtag';
  const help = document.createElement('p'); help.textContent = config.route !== 'gtag' ? config.labels[4] : config.labels[5];
  const button = document.createElement('button'); button.textContent = config.labels[2];
  const output = document.createElement('p'); output.setAttribute('role', 'status');
  button.onclick = () => { output.textContent = config.statuses[analytics.test(target.value.trim().toUpperCase())]; };
  const list = document.createElement('ol'); list.setAttribute('aria-label', config.labels[0]);
  report = (id, kind, status) => {
    const item = document.createElement('li'); item.textContent = `${kind}: ${config.statuses[status]} (${id})`;
    list.prepend(item); while (list.children.length > 10) list.lastElementChild?.remove();
  };
  const close = document.createElement('button'); close.textContent = '×'; close.setAttribute('aria-label', config.labels[6]);
  const stop = () => { active = false; host.remove(); document.removeEventListener('wconvert:capture', captured); window.__wcvObserve = undefined; report = () => {}; };
  close.onclick = stop;
  panel.append(heading, close, note, target, help, button, output, list); root.append(style, panel); document.body.append(host);
  window.setTimeout(stop, 10 * 60 * 1000);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();

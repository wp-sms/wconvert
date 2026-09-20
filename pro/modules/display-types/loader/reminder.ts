import { A_NARROW_DESIGN } from '@renderer/css';
import type { Tokens } from '@renderer/types';

export interface Teaser {
  label: string;
  placement?: string;
  gap?: number;
  background?: string;
  color?: string;
  mobile?: { visible?: boolean; placement?: string; gap?: number };
}

/** Shared by visitor presentation and the isolated editor preview. No storage. */
export function reminder(config: Teaser, tokens: Tokens, labels: [string, string] = ['Dismiss reminder', 'Submission received — View details']) {
  const host = document.createElement('div');
  host.setAttribute('popover', 'manual');
  host.setAttribute('data-wconvert-reopen', '');
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = ':host{direction:inherit}div{display:flex;align-items:stretch;box-sizing:border-box;border-radius:1.5rem;box-shadow:0 2px 12px #0003;overflow:hidden}button{font:inherit;color:inherit;background:transparent;border:0;min-height:44px;min-width:44px;padding:8px 12px;cursor:pointer;overflow-wrap:anywhere}button:first-child{min-width:44px;flex:1}button:last-child{flex:none}button:focus-visible{outline:2px solid currentColor;outline-offset:-4px}';
  const row = document.createElement('div');
  row.style.backgroundColor = '#2563eb';
  row.style.color = '#fff';
  row.style.backgroundColor = tokens.accent || row.style.backgroundColor;
  row.style.color = tokens['accent-fg'] || row.style.color;
  if (config.background) row.style.backgroundColor = config.background;
  if (config.color) row.style.color = config.color;
  row.style.fontFamily = tokens.font || 'system-ui, sans-serif';
  row.style.fontSize = '16px';
  row.style.lineHeight = '1.4';
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = config.label;
  const close = document.createElement('button');
  close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', labels[0]);
  row.append(button, close); shadow.append(style, row);
  const media = matchMedia(`(max-width: ${A_NARROW_DESIGN})`);
  function layout(narrow = media.matches) {
    const settings = narrow ? { placement: config.mobile?.placement ?? config.placement, gap: config.mobile?.gap ?? config.gap } : config;
    const placement = settings.placement ?? 'block_end_inline_end';
    const gap = Math.max(8, Math.min(96, settings.gap ?? 16));
    const top = placement.startsWith('block_start');
    const start = placement.endsWith('inline_start');
    const rtl = getComputedStyle(document.documentElement).direction === 'rtl';
    for (const edge of ['block-start', 'block-end', 'inline-start', 'inline-end']) host.style.removeProperty(`inset-${edge}`);
    for (const [key, value] of Object.entries({
      position: 'fixed', inset: 'auto', margin: '0', padding: '0', border: '0', background: 'transparent',
      'inline-size': 'max-content', 'max-inline-size': `calc(100% - ${gap * 2}px - env(safe-area-inset-left,0px) - env(safe-area-inset-right,0px))`,
      'block-size': 'auto', 'max-block-size': `calc(100% - ${gap * 2}px)`, overflow: 'auto', 'z-index': '2147483647',
      [`inset-block-${top ? 'start' : 'end'}`]: `max(${gap}px,env(safe-area-inset-${top ? 'top' : 'bottom'},0px))`,
      [`inset-inline-${start ? 'start' : 'end'}`]: `max(${gap}px,env(safe-area-inset-${start !== rtl ? 'left' : 'right'},0px))`,
    })) host.style.setProperty(key, value, 'important');
    return !narrow || config.mobile?.visible !== false;
  }
  return { host, button, close, media, layout, confirmation: labels[1] };
}

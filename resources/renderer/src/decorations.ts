import type { Decorations } from './types';

const circle = (x: number, y: number, r: number): string => `M${x-r} ${y}a${r} ${r} 0 1 0 ${r*2} 0a${r} ${r} 0 1 0 -${r*2} 0`;
const SHAPES: Partial<Record<import('./types').Decoration['kind'], string[]>> = {
  equalizer: Array.from({ length: 15 }, (_, i) => { const h = [16, 30, 48, 24, 38][i % 5]; return `M${3+i*6.4} 58v-${h}h3.5v${h}Z`; }),
  rings: [circle(50, 30, 28), circle(50, 30, 20), circle(50, 30, 12)],
  pixel: ['M24 8h8v8h36V8h8v16h8v24h-8v8h-8V40H32v16h-8v-8h-8V24h8ZM32 24v8h8v-8ZM60 24v8h8v-8Z'],
  bubbles: [circle(16, 16, 12), circle(50, 16, 12), circle(84, 16, 12), circle(16, 46, 12), circle(50, 46, 12), circle(84, 46, 12)],
  balloon: ['M50 3C16 3 22 40 50 44C78 40 84 3 50 3ZM50 44l-3 5h6ZM50 49q-7 5 0 10'],
  barcode: Array.from({ length: 22 }, (_, i) => `M${i*4.5} 5h${[1,2,3][i%3]}v50h-${[1,2,3][i%3]}Z`),
  halo: [circle(50, 30, 29)],
};

/** Original, built-in artwork. A design selects shapes; it cannot supply SVG markup. */
export function decorate(parent: HTMLElement, group?: Decorations): void {
  if (!group || group.hidden || !group.items?.length) return;
  parent.classList.add('wc-decorated');
  const layer = document.createElement('div');
  layer.className = 'wc-decorations';
  layer.setAttribute('aria-hidden', 'true');
  for (const [index, item] of group.items.slice(0, 8).entries()) {
    if (!['bat', 'eyes', 'sparkle', 'equalizer', 'rings', 'pixel', 'bubbles', 'balloon', 'barcode', 'halo'].includes(item.kind)) continue;
    const box = document.createElement('span');
    box.className = 'wc-decoration';
    for (const [key, value] of Object.entries({ x: item.x, y: item.y, size: item.size })) {
      box.style.setProperty(`--dec-${key}`, `${value}${key === 'size' ? 'px' : '%'}`);
      box.style.setProperty(`--dec-n-${key}`, `${item.narrow?.[key as 'x' | 'y' | 'size'] ?? value}${key === 'size' ? 'px' : '%'}`);
    }
    box.style.color = `var(--wc-${item.color ?? 'fg'})`;
    const motion = document.createElement('span');
    motion.className = 'wc-decoration-motion';
    motion.dataset.motion = item.motion ?? 'none';
    motion.style.animationDelay = `${item.motion === 'arrive' ? index * .12 : index * -.7}s`;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 60');
    svg.setAttribute('focusable', 'false');
    const paths = SHAPES[item.kind] ?? (item.kind === 'bat'
      ? ['M46 24L45 13L50 18L55 13L54 24Q62 42 50 53Q38 42 46 24Z', 'M46 25Q24 2 2 8Q12 24 6 39Q23 28 30 44Q37 35 46 41Z', 'M54 25Q76 2 98 8Q88 24 94 39Q77 28 70 44Q63 35 54 41Z']
      : item.kind === 'eyes'
        ? ['M4 30Q22 7 43 30Q22 53 4 30ZM57 30Q78 7 96 30Q78 53 57 30Z']
        : ['M50 2L59 22L83 30L59 38L50 58L41 38L17 30L41 22Z']);
    paths.forEach((d, at) => {
      const path = document.createElementNS(svg.namespaceURI, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'currentColor');
      if (item.kind === 'bat' && at > 0) path.setAttribute('class', 'wc-wing');
      if (item.kind === 'equalizer') {
        path.setAttribute('class', 'wc-level');
        (path as SVGElement).style.animationDelay = `${(at % 3) * -1.1}s`;
      }
      if (['rings', 'bubbles', 'balloon'].includes(item.kind)) {
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '2');
      }
      if (item.kind === 'pixel') path.setAttribute('fill-rule', 'evenodd');
      if (item.kind === 'halo') path.setAttribute('opacity', '.2');
      svg.append(path);
    });
    if (item.kind === 'eyes') for (const cx of [25, 75]) {
      const pupil = document.createElementNS(svg.namespaceURI, 'ellipse');
      pupil.setAttribute('cx', String(cx)); pupil.setAttribute('cy', '30');
      pupil.setAttribute('rx', '4'); pupil.setAttribute('ry', '10'); pupil.setAttribute('fill', '#111'); svg.append(pupil);
    }
    motion.append(svg); box.append(motion); layer.append(box);
  }
  parent.prepend(layer);
}

export const DECORATION_CSS = `
.wc-decorated{position:relative;isolation:isolate}
.wc-decorated>:not(.wc-decorations){z-index:1}
.wc-decorated>.wc-decorations{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;border-radius:inherit}
.wc-decoration{position:absolute;left:var(--dec-x);top:var(--dec-y);width:var(--dec-size);transform:translate(-50%,-50%)}
.wc-decoration-motion,.wc-decoration svg{display:block;width:100%}
.wc-decoration-motion[data-motion=float],.wc-decoration-motion[data-motion=flap]{animation:wc-float 5s ease-in-out infinite}
[data-motion=flap] .wc-wing{transform-origin:50px 28px;animation:wc-flap .65s ease-in-out infinite alternate}
.wc-decoration-motion[data-motion=blink]{animation:wc-blink 5s ease-in-out infinite}
.wc-root[data-motion=paused] .wc-decoration-motion,.wc-root[data-motion=paused] .wc-wing,.wc-root[data-motion=paused] .wc-level{animation-play-state:paused}
.wc-decoration-motion[data-motion=drift]{animation:wc-drift 6s ease-in-out infinite}
.wc-decoration-motion[data-motion=pulse]{animation:wc-pulse 6s ease-in-out infinite}
.wc-decoration-motion[data-motion=arrive]{animation:wc-arrive .7s ease-out both}
[data-motion=levels] .wc-level{transform-origin:center bottom;animation:wc-level 3.4s ease-in-out infinite}
.wc-artwork-motion[data-artwork-motion=arrive]{animation:wc-arrive .7s ease-out both}
.wc-artwork-motion[data-artwork-motion=breathe]{animation:wc-breathe 6s ease-in-out infinite}
.wc-artwork-motion[data-artwork-motion=drift]{animation:wc-drift 6s ease-in-out infinite}
.wc-root[data-motion=paused] .wc-artwork-motion{animation-play-state:paused}
@keyframes wc-breathe{0%,100%{transform:scale(.98)}50%{transform:scale(1)}}
@keyframes wc-drift{50%{transform:translateY(-6px)}}
@keyframes wc-pulse{0%,100%{opacity:.6}50%{opacity:1}}
@keyframes wc-arrive{from{opacity:.65;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes wc-level{0%,100%{transform:scaleY(.7)}50%{transform:scaleY(1)}}
@keyframes wc-float{50%{transform:translateY(-8px) rotate(5deg)}}
@keyframes wc-flap{to{transform:scaleY(.55)}}
@keyframes wc-blink{0%,42%,48%,100%{transform:scaleY(1)}45%{transform:scaleY(.08)}}
@container (max-width:24rem){.wc-decoration{left:var(--dec-n-x);top:var(--dec-n-y);width:var(--dec-n-size)}}
@media(prefers-reduced-motion:reduce){.wc-decoration-motion,.wc-wing,.wc-level,.wc-artwork-motion{animation:none!important}}
`;

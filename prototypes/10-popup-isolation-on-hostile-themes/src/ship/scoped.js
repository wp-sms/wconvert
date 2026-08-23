// Size probe: what the SCOPED strategy costs in a real loader.
// Same job as shadow.js, plus the `!important` inflation pass that the strategy
// needs to stand any chance against a theme's own `!important` rules.
import { MARKUP, CSS } from '../template.js';

const NS = 'wcv-x9f2';

function bang(css) {
  return css.replace(/([a-zA-Z-]+)\s*:\s*([^;{}]+);/g, (m, p, v) =>
    /!important/.test(v) ? m : p + ':' + v.trim() + ' !important;');
}

export function show(fontUrl, onSubmit) {
  const host = document.createElement('div');
  host.className = NS;
  const style = document.createElement('style');
  style.textContent = bang(
    '.' + NS + ',.' + NS + ' *,.' + NS + ' *::before,.' + NS + ' *::after{all:revert;}' +
    CSS.replace(/@R@/g, '.' + NS).replace(/@FONT@/g, fontUrl).replace(/@Z@/g, '2147483647')
  );
  document.head.appendChild(style);
  host.innerHTML = MARKUP;
  document.body.appendChild(host);

  const opener = document.activeElement;
  const sibs = [];
  for (const el of document.body.children) {
    if (el !== host) { el.setAttribute('inert', ''); sibs.push(el); }
  }
  const focusable = () => host.querySelectorAll('button,input,[tabindex]:not([tabindex="-1"])');
  const close = () => {
    sibs.forEach((el) => el.removeAttribute('inert'));
    host.remove();
    style.remove();
    if (opener) opener.focus();
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return close();
    if (e.key !== 'Tab' || !host.contains(document.activeElement)) return;
    const list = focusable();
    const i = Array.prototype.indexOf.call(list, document.activeElement);
    if (e.shiftKey ? i <= 0 : i === list.length - 1) {
      e.preventDefault();
      list[e.shiftKey ? list.length - 1 : 0].focus();
    }
  });
  host.querySelector('.wcv-close').addEventListener('click', close);
  host.querySelector('.wcv-form').addEventListener('submit', (e) => {
    e.preventDefault();
    onSubmit(host.querySelector('.wcv-input').value);
  });
  focusable()[0].focus();
  return close;
}

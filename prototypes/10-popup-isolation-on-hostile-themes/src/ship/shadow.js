// Size probe: what the SHADOW strategy costs in a real loader.
// Container + reset + focus trap + Esc + restore + inert. Nothing else.
import { MARKUP, CSS } from '../template.js';

export function show(fontUrl, onSubmit) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML =
    '<style>:host{all:initial!important;direction:inherit!important;display:block!important}' +
    CSS.replace(/@R@/g, ':host').replace(/@FONT@/g, fontUrl).replace(/@Z@/g, '2147483647') +
    '</style>' + MARKUP;

  const opener = document.activeElement;
  const sibs = [];
  for (const el of document.body.children) {
    if (el !== host) { el.setAttribute('inert', ''); sibs.push(el); }
  }
  const focusable = () => root.querySelectorAll('button,input,[tabindex]:not([tabindex="-1"])');
  const close = () => {
    sibs.forEach((el) => el.removeAttribute('inert'));
    host.remove();
    if (opener) opener.focus();
  };
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return close();
    if (e.key !== 'Tab') return;
    const list = focusable();
    const i = Array.prototype.indexOf.call(list, root.activeElement);
    if (e.shiftKey ? i <= 0 : i === list.length - 1) {
      e.preventDefault();
      list[e.shiftKey ? list.length - 1 : 0].focus();
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  root.querySelector('.wcv-close').addEventListener('click', close);
  root.querySelector('.wcv-form').addEventListener('submit', (e) => {
    e.preventDefault();
    onSubmit(root.querySelector('.wcv-input').value);
  });
  focusable()[0].focus();
  return close;
}

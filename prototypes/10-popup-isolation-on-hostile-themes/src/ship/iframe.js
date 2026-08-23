// Size probe: what the IFRAME strategy costs in a real loader.
// The extra weight over shadow.js is all ergonomics: passing dir/lang in, waiting
// for load before anything can be measured or focused, and running the key handler
// in two documents because the frame's keydowns never reach the parent.
import { MARKUP, CSS } from '../template.js';

export function show(fontUrl, onSubmit) {
  const frame = document.createElement('iframe');
  frame.title = 'Get 10% off your first order';
  frame.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483646;background:transparent';
  const de = document.documentElement;
  frame.srcdoc =
    '<!doctype html><html dir="' + (de.getAttribute('dir') || 'ltr') + '" lang="' + (de.getAttribute('lang') || 'en') +
    '"><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent}' +
    CSS.replace(/@R@/g, 'html').replace(/@FONT@/g, fontUrl).replace(/@Z@/g, '2147483647') +
    '</style></head><body>' + MARKUP + '</body></html>';

  const opener = document.activeElement;
  const sibs = [];
  const close = () => {
    sibs.forEach((el) => el.removeAttribute('inert'));
    frame.remove();
    if (opener) opener.focus();
  };
  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    const focusable = () => doc.querySelectorAll('button,input,[tabindex]:not([tabindex="-1"])');
    const onKey = (e) => {
      if (e.key === 'Escape') return close();
      if (e.key !== 'Tab') return;
      const list = focusable();
      const i = Array.prototype.indexOf.call(list, doc.activeElement);
      if (e.shiftKey ? i <= 0 : i === list.length - 1) {
        e.preventDefault();
        list[e.shiftKey ? list.length - 1 : 0].focus();
      }
    };
    doc.addEventListener('keydown', onKey);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    doc.querySelector('.wcv-close').addEventListener('click', close);
    doc.querySelector('.wcv-form').addEventListener('submit', (e) => {
      e.preventDefault();
      onSubmit(doc.querySelector('.wcv-input').value);
    });
    focusable()[0].focus();
  });
  document.body.appendChild(frame);
  for (const el of document.body.children) {
    if (el !== frame) { el.setAttribute('inert', ''); sibs.push(el); }
  }
  return close;
}

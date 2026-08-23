// Size probe: the RECOMMENDED shape -- a modal <dialog> in the top layer holding a
// closed shadow root. Everything shadow.js does, minus the focus trap and the Esc
// handler and the inerting, because showModal() already does all three.
import { MARKUP, CSS } from '../template.js';

const ARMOUR = {
  display: 'block', position: 'fixed', inset: '0', margin: '0', padding: '0',
  border: '0', background: 'transparent', width: 'auto', height: 'auto',
  'max-width': 'none', 'max-height': 'none', overflow: 'visible',
};

export function show(fontUrl, onSubmit) {
  const css = CSS.replace(/@R@/g, ':host').replace(/@Z@/g, 'auto');
  const face = css.match(/@font-face\s*\{[^}]*\}/g) || [];

  // @font-face never applies from inside a shadow root, and ::backdrop cannot be
  // set inline. Two rules in the document; the rest of the CSS stays inside.
  const doc = document.createElement('style');
  doc.textContent = face.join('').replace(/@FONT@/g, fontUrl) +
    'dialog[data-wcv]::backdrop{background:transparent}';
  document.head.appendChild(doc);

  const dlg = document.createElement('dialog');
  dlg.setAttribute('data-wcv', '');
  for (const k in ARMOUR) dlg.style.setProperty(k, ARMOUR[k], 'important');

  const host = document.createElement('div');
  dlg.appendChild(host);
  document.body.appendChild(dlg);

  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML =
    '<style>:host{all:initial!important;direction:inherit!important;display:block!important}' +
    css.replace(/@font-face\s*\{[^}]*\}/g, '') + '</style>' + MARKUP;

  const close = () => { dlg.close(); dlg.remove(); doc.remove(); };
  root.querySelector('.wcv-close').addEventListener('click', close);
  root.querySelector('.wcv-form').addEventListener('submit', (e) => {
    e.preventDefault();
    onSubmit(root.querySelector('.wcv-input').value);
  });
  // Esc fires `close` natively; the element still has to be taken out of the DOM.
  dlg.addEventListener('close', () => { dlg.remove(); doc.remove(); });
  dlg.showModal();
  return close;
}

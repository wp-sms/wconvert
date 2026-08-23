// The isolation strategies, behind one interface.
//
//   mount(mode) -> { kind, query(sel), root, destroy() }
//
// Same markup, same CSS, different container + reset. That is the whole experiment:
// if two modes render differently on the same theme, the container is why.

import { MARKUP, CSS } from './template.js';

const NS = 'wcv-x9f2'; // the scoped namespace; deliberately unguessable-ish

export const MODES = {
  // closed shadow root, reset with `all: initial` on the host. The naive version.
  'shadow':       { kind: 'shadow', shadowMode: 'closed', reset: 'all-initial' },
  // same, but explicitly re-inheriting writing direction
  'shadow-dir':   { kind: 'shadow', shadowMode: 'closed', reset: 'all-initial-dir' },
  // ...and with @font-face hoisted out to the document, where it actually applies
  'shadow-fixed': { kind: 'shadow', shadowMode: 'closed', reset: 'all-initial-dir', hoistFont: true },
  // ...and with the host reset made `!important`, which is the only thing an outer
  // -tree rule cannot beat. This is the candidate answer.
  'shadow-armour': { kind: 'shadow', shadowMode: 'closed', reset: 'all-initial-dir-imp', hoistFont: true },
  // no reset at all -- is the shadow boundary alone enough?
  'shadow-bare':  { kind: 'shadow', shadowMode: 'closed', reset: 'none' },
  // open shadow root -- does `closed` actually buy anything?
  'shadow-open':  { kind: 'shadow', shadowMode: 'open',   reset: 'all-initial' },
  // namespaced class + the strongest non-shadow reset available
  'scoped':       { kind: 'scoped', important: false },
  // ...and the same with `!important` on every single declaration
  'scoped-imp':   { kind: 'scoped', important: true },
  // total isolation, worst ergonomics
  'iframe':       { kind: 'iframe' },
  // Escape a `body { transform }` by hanging off <html> instead. Cheap, and it
  // does nothing about a transform on <html> itself.
  'shadow-html':  { kind: 'shadow', shadowMode: 'closed', reset: 'all-initial-dir-imp', hoistFont: true, appendTo: 'html' },
  // The TOP LAYER. A modal <dialog> is promoted out of the normal painting order
  // entirely: its containing block is the viewport, not a transformed ancestor,
  // and it paints above every z-index on the page without competing on z-index.
  'dialog':       { kind: 'shadow', shadowMode: 'closed', reset: 'all-initial-dir-imp', hoistFont: true, dialog: true },
};

const FONT_FACE = /@font-face\s*\{[^}]*\}/g;

function zIndex() {
  return String(window.WCV10_Z || 2147483646);
}

function fontUrl() {
  return (window.WCV10_FONT || './assets/fraunces.woff2');
}

// `!important` on every declaration, including inside the reset.
//
// It must skip @font-face: `!important` is invalid on a descriptor, so banging the
// whole sheet silently invalidates the face and the template loses its webfont.
// A naive implementation of this strategy gets that wrong.
function bang(css) {
  const faces = [];
  const body = css.replace(FONT_FACE, (m) => { faces.push(m); return `/*F${faces.length - 1}*/`; });
  const out = body.replace(/([a-zA-Z-]+)\s*:\s*([^;{}]+);/g, (m, prop, val) => {
    if (/!important/.test(val)) return m;
    return `${prop}: ${val.trim()} !important;`;
  });
  return out.replace(/\/\*F(\d+)\*\//g, (m, i) => faces[Number(i)]);
}

function render(rootSel, cfg) {
  let css = CSS.replace(/@R@/g, rootSel).replace(/@FONT@/g, fontUrl()).replace(/@Z@/g, zIndex());
  let reset = '';

  // An @font-face declared inside a shadow root never enters the document's font
  // set, so the element silently falls back. Hoisting it is the only fix, and it
  // is a hole in the isolation the strategy is chosen for.
  if (cfg.hoistFont) {
    const faces = css.match(FONT_FACE) || [];
    css = css.replace(FONT_FACE, '');
    if (faces.length && !document.getElementById('wcv-faces')) {
      const s = document.createElement('style');
      s.id = 'wcv-faces';
      s.textContent = faces.join('\n');
      document.head.appendChild(s);
    }
  }

  if (cfg.kind === 'shadow') {
    if (cfg.reset === 'all-initial')     reset = `${rootSel} { all: initial; }`;
    if (cfg.reset === 'all-initial-dir') reset = `${rootSel} { all: initial; direction: inherit; }`;
    // `!important` in the INNER tree is the one thing that outranks a normal --
    // and an important -- declaration in the outer tree targeting the host.
    if (cfg.reset === 'all-initial-dir-imp') {
      // `all: initial` also wipes position/inset, so a top-layer dialog would fall
      // back into normal flow -- inside the transform it was promoted to escape.
      reset = `${rootSel} { all: initial !important; direction: inherit !important; display: block !important;` +
        (cfg.dialog ? ' position: fixed !important; inset: 0 !important; width: auto !important; height: auto !important; max-width: none !important; max-height: none !important; overflow: visible !important;' : '') +
        ' }' +
        (cfg.dialog ? `\n${rootSel}::backdrop { background: transparent; }` : '');
    }
  } else if (cfg.kind === 'scoped') {
    // `all: revert` rolls each property back to the UA sheet, dropping the theme's
    // author styles. It is the strongest reset that exists outside a shadow root.
    reset = `${rootSel}, ${rootSel} *, ${rootSel} *::before, ${rootSel} *::after { all: revert; }`;
  }

  let out = reset + '\n' + css;
  if (cfg.important) out = bang(out);
  return out;
}

export function mount(modeName, opts) {
  const cfg = MODES[modeName];
  if (!cfg) throw new Error('unknown mode ' + modeName);
  // `into` mounts somewhere other than <body>. Top-layer promotion is skipped:
  // showModal() on an element that is then moved drops it out of the top layer,
  // and a modal dialog is meaningless for an in-flow inline Optin anyway.
  const into = opts && opts.into;

  if (cfg.kind === 'shadow') {
    const host = document.createElement('div');
    host.setAttribute('data-wcv', '');
    let outer = host;

    if (cfg.dialog) {
      // <dialog> is not on the list of elements that may host a shadow root, so
      // the dialog holds the top-layer promotion and an inner div holds the shadow.
      outer = document.createElement('dialog');
      outer.setAttribute('data-wcv', '');
      // Inline + `!important` is the only armour available to an element that has
      // no shadow root of its own: it outranks even the page's `!important` rules.
      const armour = {
        display: 'block', position: 'fixed', inset: '0', margin: '0', padding: '0',
        border: '0', background: 'transparent', width: 'auto', height: 'auto',
        'max-width': 'none', 'max-height': 'none', overflow: 'visible',
      };
      for (const k in armour) outer.style.setProperty(k, armour[k], 'important');
      outer.appendChild(host);
      // ::backdrop cannot be set inline, and the UA's is a second grey scrim on top
      // of the template's own. One document-level rule; part of the honest footprint.
      if (!document.getElementById('wcv-backdrop')) {
        const s = document.createElement('style');
        s.id = 'wcv-backdrop';
        s.textContent = 'dialog[data-wcv]::backdrop{background:transparent}';
        document.head.appendChild(s);
      }
    }

    (into || (cfg.appendTo === 'html' ? document.documentElement : document.body)).appendChild(outer);
    const root = host.attachShadow({ mode: cfg.shadowMode });
    root.innerHTML = `<style>${render(':host', cfg)}</style>${MARKUP}`;
    if (cfg.dialog && !into) outer.showModal();

    return {
      kind: 'shadow', root, host: outer, shadowHost: host, dialog: !!cfg.dialog,
      query: (s) => root.querySelector(s),
      queryAll: (s) => Array.from(root.querySelectorAll(s)),
      destroy: () => { if (cfg.dialog && outer.open) outer.close(); outer.remove(); },
    };
  }

  if (cfg.kind === 'scoped') {
    const host = document.createElement('div');
    host.className = NS;
    host.setAttribute('data-wcv', '');
    const style = document.createElement('style');
    style.textContent = render('.' + NS, cfg);
    document.head.appendChild(style);
    host.innerHTML = MARKUP;
    (into || document.body).appendChild(host);
    return {
      kind: 'scoped', root: host, host,
      query: (s) => host.querySelector(s),
      queryAll: (s) => Array.from(host.querySelectorAll(s)),
      destroy: () => { host.remove(); style.remove(); },
    };
  }

  // iframe: srcdoc, same-origin, so the parent can still reach in to size it.
  const frame = document.createElement('iframe');
  frame.setAttribute('data-wcv', '');
  frame.setAttribute('title', 'Get 10% off your first order');
  frame.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:' + zIndex() + ';background:transparent;color-scheme:normal;';
  frame.setAttribute('allowtransparency', 'true');
  const dir = document.documentElement.getAttribute('dir') || 'ltr';
  const lang = document.documentElement.getAttribute('lang') || 'en';
  frame.srcdoc =
    `<!doctype html><html dir="${dir}" lang="${lang}"><head><meta charset="utf-8">` +
    `<style>html,body{margin:0;padding:0;background:transparent;}${render('html', cfg)}</style>` +
    `</head><body>${MARKUP}</body></html>`;
  (into || document.body).appendChild(frame);
  return {
    kind: 'iframe', root: frame, host: frame,
    query: (s) => frame.contentDocument && frame.contentDocument.querySelector(s),
    queryAll: (s) => frame.contentDocument ? Array.from(frame.contentDocument.querySelectorAll(s)) : [],
    destroy: () => frame.remove(),
    ready: new Promise((res) => frame.addEventListener('load', res, { once: true })),
  };
}

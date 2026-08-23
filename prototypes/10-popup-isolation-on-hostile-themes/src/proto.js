// Entry point. Mounts one isolation mode and exposes a debug API for the harness.
//
// The debug API is not incidental -- a CLOSED shadow root is unreachable from
// Playwright, from an a11y auditor, and from the theme's own JS. Having to build
// this to test at all is itself one of the findings.

import { mount, MODES } from './isolate.js';
import { attach, activeInside } from './a11y.js';
import { PROBED, ELEMENTS, MARKUP, CSS } from './template.js';

const params = new URLSearchParams(location.search);
const mode = params.get('wcv10') || 'shadow';
const inlineHost = params.get('wcv10_inline'); // selector of a clipping ancestor to mount inside
const noA11y = params.has('wcv10_noa11y');    // skip the hand-written a11y layer entirely

function describe(el) {
  if (!el) return null;
  const bits = [el.tagName.toLowerCase()];
  if (el.id) bits.push('#' + el.id);
  if (el.className && typeof el.className === 'string') bits.push('.' + el.className.trim().split(/\s+/).join('.'));
  return bits.join('');
}

function textWidth(el) {
  if (!el || !el.firstChild) return null;
  const doc = el.ownerDocument;
  const r = doc.createRange();
  r.selectNodeContents(el);
  const rect = r.getBoundingClientRect();
  return Math.round(rect.width * 100) / 100;
}

function boot() {
  const mounted = mount(mode);
  const finish = () => {
    const win = mounted.kind === 'iframe' ? mounted.root.contentWindow : window;
    // With ?wcv10_noa11y the hand-written layer is skipped, which is the only way
    // to see what the CONTAINER gives you rather than what we wrote.
    const trap = noA11y
      ? { closed: false, focusables: () => mounted.queryAll('button,input,[tabindex]:not([tabindex="-1"])'), close() {} }
      : attach(mounted, () => {});
    if (noA11y) { const f = trap.focusables()[0]; if (f) f.focus(); }

    const api = {
      mode,
      kind: mounted.kind,
      // ---- rendering fidelity -------------------------------------------------
      styles() {
        const out = {};
        for (const sel of ELEMENTS) {
          const el = mounted.query(sel);
          if (!el) { out[sel] = null; continue; }
          const cs = win.getComputedStyle(el);
          const props = {};
          for (const p of PROBED) props[p] = cs.getPropertyValue(p).trim();
          out[sel] = props;
        }
        return out;
      },
      rects() {
        const out = {};
        for (const sel of ELEMENTS) {
          const el = mounted.query(sel);
          if (!el) { out[sel] = null; continue; }
          const r = el.getBoundingClientRect();
          out[sel] = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
        }
        // the container itself, in PARENT viewport coordinates
        const hr = mounted.host.getBoundingClientRect();
        out['@host'] = { x: Math.round(hr.x), y: Math.round(hr.y), w: Math.round(hr.width), h: Math.round(hr.height) };
        out['@viewport'] = { w: window.innerWidth, h: window.innerHeight };
        return out;
      },
      // Is our popup actually the thing the visitor can click? Asked in the PARENT
      // document, because that is where a cookie banner or sticky header lives.
      hitTest() {
        const out = {};
        for (const sel of ['.wcv-modal', '.wcv-submit', '.wcv-input', '.wcv-close']) {
          const el = mounted.query(sel);
          if (!el) { out[sel] = { ok: false, reason: 'missing' }; continue; }
          const r = el.getBoundingClientRect();
          const off = mounted.kind === 'iframe' ? mounted.host.getBoundingClientRect() : { x: 0, y: 0 };
          const cx = off.x + r.x + r.width / 2;
          const cy = off.y + r.y + r.height / 2;
          const top = document.elementFromPoint(cx, cy);
          // In the parent document, our element surfaces as the host (shadow/iframe)
          // or as the element itself (scoped).
          const isOurs = top === mounted.host || (top && mounted.host.contains(top));
          out[sel] = { ok: !!isOurs, top: describe(top), at: [Math.round(cx), Math.round(cy)] };
        }
        return out;
      },
      // WHO PAINTS ON TOP, ignoring `inert`.
      //
      // `inert` removes an element from hit-testing, so a page we have inerted
      // reports us as "on top" even when a banner is painting a grey scrim over
      // us: clickable, but obscured. Lifting inert for the measurement is the only
      // way to ask about paint order rather than about pointer routing.
      paintOrder() {
        const inerted = Array.from(document.querySelectorAll('body > [data-wcv-inert]'));
        inerted.forEach((el) => el.removeAttribute('inert'));
        const out = {};
        for (const sel of ['.wcv-modal', '.wcv-submit']) {
          const el = mounted.query(sel);
          if (!el) { out[sel] = { ok: false, reason: 'missing' }; continue; }
          const r = el.getBoundingClientRect();
          const off = mounted.kind === 'iframe' ? mounted.host.getBoundingClientRect() : { x: 0, y: 0 };
          const cx = off.x + r.x + r.width / 2;
          const cy = off.y + r.y + r.height / 2;
          const top = document.elementFromPoint(cx, cy);
          const isOurs = top === mounted.host || (top && mounted.host.contains(top));
          out[sel] = { ok: !!isOurs, top: describe(top), at: [Math.round(cx), Math.round(cy)] };
        }
        inerted.forEach((el) => el.setAttribute('inert', ''));
        return out;
      },
      // Did the template's own webfont actually render?
      font() {
        const title = mounted.query('.wcv-title');
        return {
          declared: title ? win.getComputedStyle(title).getPropertyValue('font-family').trim() : null,
          textWidth: textWidth(title),
          docFontCheck: typeof document.fonts !== 'undefined' ? document.fonts.check("700 27px 'WCV Fraunces'") : null,
          ownFontCheck: (win.document && win.document.fonts) ? win.document.fonts.check("700 27px 'WCV Fraunces'") : null,
        };
      },
      // ---- accessibility ------------------------------------------------------
      a11y() {
        const dlg = mounted.query('[role=dialog]');
        return {
          role: dlg && dlg.getAttribute('role'),
          ariaModal: dlg && dlg.getAttribute('aria-modal'),
          // Do the IDREFs resolve? They must not cross a shadow/iframe boundary.
          labelResolves: !!(dlg && mounted.query('#' + dlg.getAttribute('aria-labelledby'))),
          describeResolves: !!(dlg && mounted.query('#' + dlg.getAttribute('aria-describedby'))),
          focusables: trap.focusables().map(describe),
          // What OUTSIDE code sees as focused -- the honest cross-boundary answer.
          documentActiveElement: describe(document.activeElement),
          actualActiveElement: describe(activeInside(mounted)),
          inertedSiblings: document.querySelectorAll('body > [data-wcv-inert]').length,
          bodyChildren: document.body.children.length,
          // Can a page-level Tab reach anything outside us?
          outsideFocusables: Array.from(document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]'))
            .filter((el) => !mounted.host.contains(el) && el !== mounted.host)
            .filter((el) => !el.closest('[inert]'))
            .length,
        };
      },
      tab(shift) {
        const list = trap.focusables();
        const cur = activeInside(mounted);
        const i = list.indexOf(cur);
        const next = shift ? (i <= 0 ? list.length - 1 : i - 1) : (i === list.length - 1 ? 0 : i + 1);
        if (list[next]) list[next].focus();
        return describe(activeInside(mounted));
      },
      // ---- behaviour ----------------------------------------------------------
      fill(email) {
        const input = mounted.query('.wcv-input');
        input.focus();
        input.value = email;
        input.dispatchEvent(new win.Event('input', { bubbles: true }));
        return { value: input.value, focused: describe(activeInside(mounted)) };
      },
      submit() {
        const form = mounted.query('.wcv-form');
        let captured = null;
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          captured = new (win.FormData || FormData)(form).get('email');
        }, { once: true });
        mounted.query('.wcv-submit').click();
        return { captured };
      },
      esc() {
        const target = mounted.kind === 'iframe' ? mounted.root.contentDocument : mounted.root;
        target.dispatchEvent(new (win.KeyboardEvent || KeyboardEvent)('keydown', { key: 'Escape', bubbles: true, composed: true }));
        return { closed: trap.closed, closedBy: trap.closedBy, restored: trap.restoredTo, bodyChildren: document.body.children.length };
      },
      // ---- what the theme's own JS can see ------------------------------------
      exposure() {
        const host = mounted.host;
        return {
          hostTag: host.tagName.toLowerCase(),
          // The classic theme/plugin sweep: does it find our fields?
          themeCanSeeInputs: document.querySelectorAll('input[type=email]').length,
          themeCanSeeButtons: document.querySelectorAll('button').length,
          shadowRootReachable: !!host.shadowRoot,
          iframeDocReachable: mounted.kind === 'iframe' ? !!mounted.root.contentDocument : null,
        };
      },
      dir() {
        const el = mounted.query('.wcv-modal');
        const close = mounted.query('.wcv-close');
        const modal = el.getBoundingClientRect();
        const cr = close.getBoundingClientRect();
        return {
          htmlDir: document.documentElement.getAttribute('dir'),
          modalDirection: win.getComputedStyle(el).getPropertyValue('direction'),
          hostDirection: getComputedStyle(mounted.host).getPropertyValue('direction'),
          titleTextAlign: win.getComputedStyle(mounted.query('.wcv-title')).getPropertyValue('text-align'),
          // inset-inline-end put the close button on which side of the modal?
          closeOnLeft: (cr.x + cr.width / 2) < (modal.x + modal.width / 2),
        };
      },
      _mounted: mounted,
    };

    window.__WCV10 = api;
    document.documentElement.setAttribute('data-wcv10-ready', mode);
  };

  if (mounted.ready) mounted.ready.then(finish);
  else finish();
}

// Mounting inside a deliberately clipping ancestor -- the `inline` display type's
// problem, and the one case where "just append to body" is not available.
function bootInline(sel) {
  const parent = document.querySelector(sel);
  const mounted = mount(mode, { into: parent });
  const go = () => {
  const r = mounted.query('.wcv-modal').getBoundingClientRect();
  const pr = parent.getBoundingClientRect();
  window.__WCV10 = {
    mode, kind: mounted.kind, inline: true,
    clip: {
      parent: { x: Math.round(pr.x), y: Math.round(pr.y), w: Math.round(pr.width), h: Math.round(pr.height) },
      modal: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      parentOverflow: getComputedStyle(parent).overflow,
      visibleAtCentre: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === mounted.host
        || mounted.host.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)),
    },
  };
  document.documentElement.setAttribute('data-wcv10-ready', mode);
  };
  if (mounted.ready) mounted.ready.then(go); else go();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => (inlineHost ? bootInline(inlineHost) : boot()));
} else {
  inlineHost ? bootInline(inlineHost) : boot();
}

export { MODES, MARKUP, CSS };

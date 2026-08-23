// Focus trap, Esc, focus restoration and page inerting -- written once per container
// kind, because the container is exactly what changes how each of them has to work.

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

function focusables(mounted) {
  return mounted.queryAll(FOCUSABLE).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

// Make everything except our own container unreachable to Tab AND to a screen
// reader's virtual cursor. `aria-modal` alone does neither in practice.
function inertSiblings(host, on) {
  Array.from(document.body.children).forEach((el) => {
    if (el === host) return;
    if (on) { el.setAttribute('inert', ''); el.setAttribute('data-wcv-inert', ''); }
    else if (el.hasAttribute('data-wcv-inert')) { el.removeAttribute('inert'); el.removeAttribute('data-wcv-inert'); }
  });
}

export function attach(mounted, onClose) {
  const opener = document.activeElement;
  const state = { closed: false, escSeen: false, wrapped: 0 };

  inertSiblings(mounted.host, true);

  const close = (why) => {
    if (state.closed) return;
    state.closed = true;
    state.closedBy = why;
    inertSiblings(mounted.host, false);
    mounted.destroy();
    if (opener && opener.focus) opener.focus();
    state.restoredTo = document.activeElement === opener;
    if (onClose) onClose(why);
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { state.escSeen = true; close('esc'); return; }
    if (e.key !== 'Tab') return;
    const list = focusables(mounted);
    if (!list.length) return;
    const active = activeInside(mounted);
    const i = list.indexOf(active);
    if (e.shiftKey && (i <= 0)) { e.preventDefault(); list[list.length - 1].focus(); state.wrapped++; }
    else if (!e.shiftKey && i === list.length - 1) { e.preventDefault(); list[0].focus(); state.wrapped++; }
  };

  // Where the listener has to live differs per container, and that IS the finding:
  //  - shadow: events retarget at the boundary, but a listener ON the root sees them
  //  - scoped: same document, so document-level works
  //  - iframe: the frame is a separate document; the parent never sees its keydowns
  if (mounted.kind === 'iframe') {
    const doc = mounted.root.contentDocument;
    doc.addEventListener('keydown', onKey);
    // Esc pressed while focus is in the PARENT page still has to close us.
    document.addEventListener('keydown', onKey);
    state.detach = () => { doc.removeEventListener('keydown', onKey); document.removeEventListener('keydown', onKey); };
  } else {
    mounted.root.addEventListener('keydown', onKey);
    document.addEventListener('keydown', onKey);
    state.detach = () => { mounted.root.removeEventListener('keydown', onKey); document.removeEventListener('keydown', onKey); };
  }

  const closeBtn = mounted.query('.wcv-close');
  if (closeBtn) closeBtn.addEventListener('click', () => close('button'));

  const first = focusables(mounted)[0];
  if (first) first.focus();

  return Object.assign(state, { close, opener, focusables: () => focusables(mounted) });
}

// The honest answer to "what is focused?" per container. Worth its own function
// because `document.activeElement` gives a different (wrong) answer in three of four.
export function activeInside(mounted) {
  if (mounted.kind === 'shadow') return mounted.root.activeElement;
  if (mounted.kind === 'iframe') {
    const d = mounted.root.contentDocument;
    return d ? d.activeElement : null;
  }
  return document.activeElement;
}

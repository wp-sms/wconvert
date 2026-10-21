import { mountModal, type MountOptions, type Mounted } from '@renderer/mount';
import { REFERABLE } from '@renderer/render';
import { decorateFullscreen } from './surface';

/** The viewport belongs to the container; template width remains the content measure. */
export function mountFullscreen(options: MountOptions): Mounted {
  let restore: (() => void) | undefined;
  const focusStep = () => {
    const root = mounted.root;
    if (!root) return;
    const heading = root.querySelector<HTMLElement>('h1,h2') ?? root;
    heading.tabIndex = -1;
    const dialog = root.getRootNode() instanceof ShadowRoot
      ? (root.getRootNode() as ShadowRoot).host.parentElement : null;
    if (dialog) dialog.scrollTop = 0;
    heading.focus({ preventScroll: true });
  };
  const mounted = mountModal(options, {
    lightDismiss: false,
    styles: {
      'inline-size': '100%', 'max-inline-size': 'none',
      'block-size': '100dvh', 'max-block-size': '100%',
      margin: '0', overflow: 'auto', 'overscroll-behavior': 'contain',
      background: 'var(--wc-bg,#fff)',
    },
    prepare(root) {
      decorateFullscreen(root, options.template.tokens.width);
      // showModal runs its own focusing steps before opened(). Give it the
      // heading now so a capture input is never transiently focused first.
      const heading = root.querySelector<HTMLElement>('h1,h2') ?? root;
      heading.tabIndex = -1;
      heading.setAttribute('autofocus', '');
      // Outside the size-contained root: otherwise it becomes the containing
      // block for a fixed child, and the way out scrolls offscreen with it.
      const close = root.querySelector<HTMLElement>('.wc-close');
      if (close) {
        root.after(close);
        Object.assign(close.style, {
          position: 'fixed', insetBlockStart: 'max(.75rem, env(safe-area-inset-top))',
          insetInlineEnd: 'max(.75rem, env(safe-area-inset-left), env(safe-area-inset-right))',
          inlineSize: '44px', blockSize: '44px', zIndex: '1',
        });
        // Outside the root it no longer inherits the design's tokens, so it
        // carries them: its own four and the colours they may name (ADR 0159).
        // A design that sets none keeps the fullscreen look it always had.
        const fallback: Readonly<Record<string, string>> = { 'close-fg': '#111827', 'close-bg': '#fff', 'close-border': '#6b7280' };
        for (const name of [...REFERABLE, 'close-fg', 'close-bg', 'close-border', 'close-radius']) {
          const value = root.style.getPropertyValue(`--wc-${name}`) || fallback[name];
          if (value) close.style.setProperty(`--wc-${name}`, value);
        }
      }
    },
    opened() {
      if (restore) return;
      const page = document.documentElement;
      const overflow = page.style.getPropertyValue('overflow');
      const priority = page.style.getPropertyPriority('overflow');
      page.style.setProperty('overflow', 'hidden', 'important');
      restore = () => {
        if (overflow) page.style.setProperty('overflow', overflow, priority);
        else page.style.removeProperty('overflow');
        restore = undefined;
      };
      focusStep();
    },
    closed() { restore?.(); },
  });
  return {
    ...mounted,
    get root() { return mounted.root; },
    showStep(step) { mounted.showStep(step); focusStep(); },
  };
}

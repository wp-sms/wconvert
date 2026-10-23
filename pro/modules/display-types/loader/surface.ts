/** Shared by the Pro visitor container and admin preview; no stored token changes. */
export function decorateFullscreen(root: HTMLElement, width: unknown, height = '100dvh'): void {
  const authoredPadding = root.style.getPropertyValue('--wc-pad').trim();
  Object.assign(root.style, {
    inlineSize: '100%', maxBlockSize: 'none', minBlockSize: height,
    borderRadius: '0', boxShadow: 'none', overflow: 'visible', overflowWrap: 'anywhere',
    boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center',
    paddingBlockStart: 'calc(4rem + env(safe-area-inset-top))',
    paddingBlockEnd: 'max(2rem, env(safe-area-inset-bottom))',
    paddingInline: 'max(1.25rem, env(safe-area-inset-left), env(safe-area-inset-right))',
  });
  // A full-bleed design owns its spacing in its panels. Adding a second frame
  // here changes both its column proportions and its illustration placement.
  // Designs without authored padding retain the container's safe defaults.
  if (authoredPadding) root.style.padding = 'var(--wc-pad)';
  for (const child of root.children) {
    if (!(child instanceof HTMLElement) || child.classList.contains('wc-close')) continue;
    Object.assign(child.style, {
      inlineSize: '100%', maxInlineSize: typeof width === 'string' ? width : '48rem',
      marginInline: 'auto', flexShrink: '0', flexGrow: width === '100%' ? '1' : '0',
    });
  }
}

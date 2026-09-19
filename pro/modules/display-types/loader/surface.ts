/** Shared by the Pro visitor container and admin preview; no stored token changes. */
export function decorateFullscreen(root: HTMLElement, width: unknown, height = '100dvh'): void {
  Object.assign(root.style, {
    inlineSize: '100%', maxBlockSize: 'none', minBlockSize: height,
    borderRadius: '0', boxShadow: 'none', overflow: 'visible',
    boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center',
    paddingBlockStart: 'calc(4rem + env(safe-area-inset-top))',
    paddingBlockEnd: 'max(2rem, env(safe-area-inset-bottom))',
    paddingInline: 'max(1.25rem, env(safe-area-inset-left), env(safe-area-inset-right))',
  });
  for (const child of root.children) {
    if (!(child instanceof HTMLElement) || child.classList.contains('wc-close')) continue;
    Object.assign(child.style, {
      inlineSize: '100%', maxInlineSize: typeof width === 'string' ? width : '48rem',
      marginInline: 'auto', flexShrink: '0',
    });
  }
}

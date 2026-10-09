/**
 * `@wordpress/compose`, for the block's tests — not installed, for the reason
 * `wp-block-editor.tsx` gives.
 *
 * `useCopyToClipboard` returns a ref, and WordPress's listens for clicks on
 * the element it lands on. This one does the same and records what would
 * have reached the clipboard, so a test asserts on the text and the success
 * state rather than on a browser permission jsdom does not have.
 */
export const clipboard: string[] = [];

export function useCopyToClipboard<T extends HTMLElement = HTMLElement>(
  text: string | (() => string),
  onSuccess?: () => void,
): (node: T | null) => void {
  return (node) => {
    if (node === null) return;
    node.onclick = () => {
      clipboard.push(typeof text === 'function' ? text() : text);
      onSuccess?.();
    };
  };
}

/**
 * `@wordpress/block-editor`, for the block's tests.
 *
 * The package is not installed — `resources/blocks/inline-optin/src/wordpress.d.ts`
 * says why, and it is 393 MB of dev tree for types — so `vitest.config.ts`
 * aliases the specifier here. An alias rather than `vi.mock()`: Vite's
 * import-analysis resolves the specifier before any mock is applied, so
 * mocking a module that is not on disk fails at transform time with
 * "Failed to resolve import".
 *
 * It is the plainest thing that carries the same semantics, and deliberately
 * nothing more. What the tests beside it assert is WConvert's own logic —
 * which of three states the block is in, whether it warns — never WordPress's
 * components, which are not this repo's to test. The visual result is
 * confirmed in a real block editor under Playground instead.
 */
export function useBlockProps(): Record<string, unknown> {
  return { 'data-block': 'wconvert/inline-optin' };
}

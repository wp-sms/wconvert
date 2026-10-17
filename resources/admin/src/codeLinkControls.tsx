import { Suspense, type ComponentType } from 'react';

/**
 * Pro's help for a code's apply link (ADR 0152): a WooCommerce store can fill
 * the address for the code in one press. Free draws the plain link field and
 * nothing here, so it sells nothing (ADR 0116, 0147).
 */
export interface CodeLinkProps {
  /** The code the block shows. */
  code: string;
  /** The link's address as saved, or empty. */
  href: string;
  onChange(href: string): void;
}
export const codeLinkControls: { component?: ComponentType<CodeLinkProps> } = {};

export function CodeLinkSettings(props: CodeLinkProps) {
  const Control = codeLinkControls.component;
  return Control ? <Suspense fallback={null}><Control {...props} /></Suspense> : null;
}

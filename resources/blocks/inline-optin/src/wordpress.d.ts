/**
 * The editor packages this block imports and never carries.
 *
 * ============================================================================
 * WHY THEY ARE DECLARED HERE RATHER THAN INSTALLED.
 * ============================================================================
 * WordPress ships every one of these to the post editor as a classic script on
 * a `wp.*` global, so bundling a second copy would be dead weight at best and
 * — for `@wordpress/i18n` — actively wrong, since a second `__()` reads an
 * empty catalogue and every string renders in English on a translated site
 * (`vite.config.admin.mjs` argues that at length for the two packages the
 * admin bundle imports).
 *
 * So they are external either way, and the only question is where the TYPES
 * come from. Installing the four packages for types alone added **175
 * packages and 393 MB** to the dev tree — paid by `npm ci` on every pull
 * request — for a block whose whole surface is a placeholder and a select.
 *
 * These declarations are that surface and nothing wider, which is the same
 * bargain `wordpressGlobals()` already makes when it spells `@wordpress/i18n`'s
 * named exports by hand. **Narrow on purpose**: a prop that is not here is a
 * prop this block does not pass, and adding one is a line rather than a
 * dependency.
 */

declare module '@wordpress/blocks' {
  export interface BlockInstance {
    clientId: string;
    name: string;
    attributes: Record<string, unknown>;
    innerBlocks: BlockInstance[];
    isValid?: boolean;
  }
  export function getBlockType(name: string): { title: string } | undefined;
  export function serialize(blocks: BlockInstance[]): string;
  export function cloneBlock(block: BlockInstance): BlockInstance;
  export function createBlock(name: string, attributes?: Record<string, unknown>, innerBlocks?: BlockInstance[]): BlockInstance;
  export function registerBlockType(
    name: string,
    settings: {
      icon?: string;
      keywords?: string[];
      transforms?: {
        from: { type: 'block'; blocks: string[]; isMultiBlock: boolean; isMatch(attributes: unknown, blocks: BlockInstance[]): boolean; __experimentalConvert(blocks: BlockInstance[]): BlockInstance }[];
        ungroup(attributes: unknown, blocks: BlockInstance[]): BlockInstance[];
      };
      edit: (props: {
        clientId: string;
        attributes: { optinId?: string };
        setAttributes: (next: { optinId?: string }) => void;
      }) => JSX.Element;
      save: () => React.ReactNode;
    },
  ): void;
}

declare module '@wordpress/block-editor' {
  export const InnerBlocks: ((props: { allowedBlocks?: string[]; template?: [string, Record<string, unknown>][] }) => React.JSX.Element) & { Content: () => React.JSX.Element };
  export function useBlockProps(props?: Record<string, unknown>): Record<string, unknown>;
}

declare module '@wordpress/components' {
  export const Placeholder: (props: {
    icon?: string;
    label?: string;
    instructions?: string;
    children?: React.ReactNode;
  }) => JSX.Element;

  export const SelectControl: (props: {
    label?: string;
    value?: string;
    options: { label: string; value: string; disabled?: boolean }[];
    onChange: (value: string) => void;
    __next40pxDefaultSize?: boolean;
    __nextHasNoMarginBottom?: boolean;
  }) => JSX.Element;

  export const Notice: (props: {
    status?: 'warning' | 'error' | 'success' | 'info';
    isDismissible?: boolean;
    children?: React.ReactNode;
  }) => JSX.Element;
}

/*
 * `@wordpress/i18n` is deliberately NOT declared here. It is a real dependency
 * of this repo — the admin bundle imports it and typechecks against the
 * package's own types — and a `declare module` for it in this file would
 * SHADOW those for the whole tree, which is not a narrowing but a silent
 * replacement: every `_n()` and `_x()` in `resources/admin/` stops resolving.
 *
 * The rule this leaves is worth stating, because the next package to be reached
 * for will look exactly like the four above: declare only what nothing in this
 * repository installs.
 */


declare module '@wordpress/element' {
  export { useLayoutEffect, useRef, useState } from 'react';
}

declare module '@wordpress/data' {
  interface BlockEditorStore {
    canRemoveBlocks(clientIds: string[]): boolean;
    getBlocks(rootClientId?: string): import('@wordpress/blocks').BlockInstance[];
  }
  export function select(store: 'core/block-editor'): BlockEditorStore;
  export function useSelect<T>(callback: (select: (store: 'core/block-editor') => BlockEditorStore) => T, dependencies: unknown[]): T;
  export function useDispatch(store: 'core/interface'): { enableComplementaryArea(scope: string, area: string): void };
  export function useDispatch(store: 'core/block-editor'): {
    selectBlock(clientId: string): void;
    removeBlocks(clientIds: string[]): void;
    replaceBlocks(clientIds: string | string[], blocks: import('@wordpress/blocks').BlockInstance[]): void;
  };
}

declare module '@wordpress/components' {
  export const Button: (props: { ref?: React.Ref<HTMLButtonElement>; variant?: string; disabled?: boolean; 'aria-label'?: string; onClick(): void; children?: React.ReactNode }) => React.JSX.Element;
  export const ComboboxControl: (props: {
    label: string; value: string | null; options: { label: string; value: string }[];
    onFilterValueChange(value: string): void; onChange(value: string | null | undefined): void;
  }) => React.JSX.Element;
}


declare module '@wordpress/block-editor' {
  export const InspectorControls: (props: { children: React.ReactNode }) => React.JSX.Element;
  export const BlockControls: (props: { group?: string; children: React.ReactNode }) => React.JSX.Element;
}
declare module '@wordpress/components' {
  export const PanelBody: (props: { title: string; initialOpen?: boolean; opened?: boolean; onToggle?(opened: boolean): void; children: React.ReactNode }) => React.JSX.Element;
  export const ToolbarButton: (props: { disabled?: boolean; onClick(): void; children: React.ReactNode }) => React.JSX.Element;
}

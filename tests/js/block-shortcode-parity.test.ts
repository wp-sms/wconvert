import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * **The two names the block editor spells that PHP owns.**
 *
 * A block's editor half and its server half are one feature written in two
 * languages with no build step between them, so every name they share is a
 * pair that can silently drift. Two of them matter here, and both fail without
 * throwing:
 *
 * - the **block name**, which would leave the editor registering a block the
 *   server has never heard of — an "unsupported block" where content used to
 *   be;
 * - the **shortcode tag**, which the placeholder hands the merchant to paste
 *   somewhere else, and which would render as its own literal text in the post
 *   they pasted it into.
 *
 * The block name is held by construction — `block.json` is the one declaration
 * and PHP is pointed at the file — so what is asserted for it is that this is
 * still true. The tag genuinely has two spellings and this is the only thing
 * holding them together.
 *
 * `tests/unit/Frontend/InlineAnchorTest.php` is the mirror of this file, from
 * the other side, for the anchor attribute.
 */

const ROOT = resolve(import.meta.dirname, '../..');

const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

/** A PHP class constant's string value, by name. */
function phpConstant(source: string, name: string): string {
  const found = new RegExp(`const\\s+${name}\\s*=\\s*'([^']+)'`).exec(source);

  expect(found, `${name} is no longer a plain string constant`).not.toBeNull();

  return (found as RegExpExecArray)[1];
}

describe('the block editor and PHP agree about what things are called', () => {
  it('registers the block under the name PHP registers', () => {
    const metadata = JSON.parse(read('resources/blocks/inline-optin/block.json'));

    expect(metadata.name).toBe(phpConstant(read('src/Frontend/InlineOptinBlock.php'), 'NAME'));
  });

  it('names the editor script handle PHP registers', () => {
    const metadata = JSON.parse(read('resources/blocks/inline-optin/block.json'));

    expect(metadata.editorScript).toBe(phpConstant(read('src/Frontend/InlineOptinBlock.php'), 'HANDLE'));
  });

  /**
   * The one attribute, which is the whole of what this block stores.
   * `render()` reads `optinId` off the saved attributes, and an editor saving
   * anything else renders an empty string on every page while looking correct
   * in the editor.
   */
  it('declares the attribute PHP renders', () => {
    const metadata = JSON.parse(read('resources/blocks/inline-optin/block.json'));

    expect(Object.keys(metadata.attributes)).toEqual(['optinId']);
    expect(read('src/Frontend/InlineOptinBlock.php')).toContain("$attributes['optinId']");
    expect(read('resources/blocks/inline-optin/src/Edit.tsx')).toContain('attributes.optinId');
  });

  /**
   * **The shortcode the placeholder offers is the shortcode PHP answers to.**
   *
   * This is the one that has no single declaration to fall back on: the tag is
   * a PHP constant and a TypeScript constant, and the block editor is the only
   * screen in WConvert that shows a merchant either the tag or the id it
   * carries.
   */
  it('offers the shortcode tag PHP registers', () => {
    const tag = phpConstant(read('src/Frontend/InlineOptinShortcode.php'), 'TAG');

    expect(read('resources/blocks/inline-optin/src/Edit.tsx')).toContain(`const SHORTCODE_TAG = '${tag}';`);
  });
});

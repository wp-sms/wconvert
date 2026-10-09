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

  it('is discoverable for posts and theme-owned widget areas', () => {
    const metadata = JSON.parse(read('resources/blocks/inline-optin/block.json'));

    expect(metadata.category).toBe('widgets');
    expect(metadata.keywords).toEqual(expect.arrayContaining(['widget', 'sidebar', 'footer']));
    expect(metadata.description).toMatch(/page, post, sidebar, or footer/u);
  });

  it('names the editor script handle PHP registers', () => {
    const metadata = JSON.parse(read('resources/blocks/inline-optin/block.json'));

    expect(metadata.editorScript).toBe(phpConstant(read('src/Frontend/InlineOptinBlock.php'), 'HANDLE'));
  });

  /**
   * The picker's stylesheet is registered under the script's handle; a
   * metadata `editorStyle` naming anything else loads nothing, and the picker
   * draws unstyled with no error anywhere.
   */
  it('names the editor style handle PHP registers', () => {
    const metadata = JSON.parse(read('resources/blocks/inline-optin/block.json'));
    const php = read('src/Frontend/InlineOptinBlock.php');

    expect(metadata.editorStyle).toBe(phpConstant(php, 'HANDLE'));
    expect(php).toMatch(/wp_register_style\(\s*self::HANDLE/u);
  });

  /**
   * **Refresh asks the route PHP registers.** A mismatch is a 404 that the
   * picker reports as "Could not refresh campaigns", on every click, with
   * nothing to say the two files stopped agreeing.
   */
  it('refreshes from the route PHP registers', () => {
    const route = phpConstant(read('src/Frontend/InlineOptinBlock.php'), 'ROUTE');
    const namespace = phpConstant(read('src/Rest/Routes.php'), 'NAMESPACE');

    expect(read('resources/blocks/inline-optin/src/optins.ts')).toContain(`path: '/${namespace}${route}'`);
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
   * **The third cross-language pair, and the one with no UI to notice it.**
   *
   * PHP writes `window.wconvertInlineOptins` and the bundle reads it. A
   * disagreement is not an error anywhere: the reader narrows a `undefined` to
   * an empty list, so the picker renders "No published inline Optins" on a
   * site that has published several, and the merchant concludes the block is
   * broken rather than that two files stopped agreeing about a name.
   */
  it('reads the global PHP writes', () => {
    const name = phpConstant(read('src/Frontend/InlineOptinBlock.php'), 'DATA');

    expect(read('resources/blocks/inline-optin/src/optins.ts')).toContain(`window.${name}`);
  });

  /**
   * **The title is spelled twice on purpose, and has to say the same thing.**
   *
   * `block.json`'s `title` is what the inserter shows, translated by
   * WordPress's own i18n schema at `register_block_type()`. The placeholder's
   * heading is translated by `wp_set_script_translations` against the
   * bundle's catalogue instead — so `metadata.title` cannot be used there: it
   * is the raw English string, and it would ship untranslated on every
   * localised site while the inserter beside it was translated.
   *
   * Two catalogues, therefore two spellings, and the drift they permit is a
   * merchant inserting one name and landing on a block headed another.
   */
  it('heads the placeholder with the title its metadata declares', () => {
    const metadata = JSON.parse(read('resources/blocks/inline-optin/block.json'));

    expect(read('resources/blocks/inline-optin/src/Edit.tsx')).toContain(
      `__('${metadata.title}', 'wconvert')`,
    );
  });

  /**
   * **The shortcode the placeholder offers is the shortcode PHP answers to.**
   *
   * This is the one that has no single declaration to fall back on: the tag is
   * a PHP constant and a TypeScript constant, and the block editor is the only
   * screen in WConvert that shows a merchant either the tag or the id it
   * carries.
   */
  /**
   * **One prefix, so one search finds all three.** A merchant who types
   * "WConvert" in the inserter finds the campaign block and both locks; the
   * words a merchant reaches for first ("form", "inline") are keywords, so
   * they find it too.
   */
  it('names all three blocks the same way in the inserter', () => {
    const metadata = JSON.parse(read('resources/blocks/inline-optin/block.json'));

    expect(metadata.title).toBe('WConvert campaign');
    expect(metadata.keywords).toEqual(expect.arrayContaining(['wconvert', 'form', 'inline', 'popup-free']));
    expect(read('src/Frontend/ContentRegion.php')).toContain(`'title' => __('WConvert content lock', 'wconvert')`);
    expect(read('pro/modules/content-lock/src/ContentDivider.php')).toContain(`'title' => __('WConvert lock from here', 'wconvert')`);
  });

  /** The builder tells the merchant which block to add, by the name the inserter shows. */
  it('names the block in placement help by its inserter title', () => {
    const { title } = JSON.parse(read('resources/blocks/inline-optin/block.json'));

    expect(read('resources/admin/src/builder/ManualPlacement.tsx')).toContain(`Add the “${title}” block`);
    expect(read('resources/admin/src/builder/PlacementGuidance.tsx')).toContain(`Add the “${title}” block`);
  });

  it('offers the shortcode tag PHP registers', () => {
    const tag = phpConstant(read('src/Frontend/InlineOptinShortcode.php'), 'TAG');

    expect(read('resources/blocks/inline-optin/src/Edit.tsx')).toContain(`const SHORTCODE_TAG = '${tag}';`);
  });
});

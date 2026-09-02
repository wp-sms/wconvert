import { registerBlockType } from '@wordpress/blocks';
import { Edit } from './Edit';
import metadata from '../block.json';

/**
 * `wconvert/inline-optin` — the block half of "put an [[Optin]] here".
 *
 * ============================================================================
 * `save` RETURNS NULL, WHICH MAKES THIS A DYNAMIC BLOCK, WHICH IS THE POINT.
 * ============================================================================
 * A static block would serialise its own markup into post content, and the
 * anchor would then exist in as many versions as the site has old posts — so
 * changing the element that `resources/loader/src/present.ts` queries for
 * would silently orphan every block saved before the change, with a block
 * validation error on top for anyone who opened one.
 *
 * Rendering from the server means `WConvert\Frontend\InlineAnchor` is the ONE
 * place the element is written, for both this and the shortcode, forever.
 * `tests/unit/Frontend/InlineAnchorTest.php` is what holds the two surfaces to
 * the same output; there would be nothing for it to compare if half the
 * contract lived in post content.
 *
 * The name and the attribute come from `block.json` rather than being spelled
 * again here, because PHP registers the same file — `register_block_type()` is
 * pointed at that directory — and two spellings of a block name is a block the
 * editor knows and the server does not.
 */
registerBlockType(metadata.name, {
  edit: Edit,
  save: () => null,
});

import { useBlockProps } from '@wordpress/block-editor';
import { Notice, Placeholder, SelectControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { publishedInlineOptins } from './optins';

/**
 * The shortcode's tag, and its other spelling is
 * `WConvert\Frontend\InlineOptinShortcode::TAG`.
 *
 * Two spellings because one has to be PHP and the other has to be in the
 * bundle, with no build step between them — the same shape, and the same
 * hazard, as the anchor attribute one directory over. It goes wrong quietly:
 * this screen would hand the merchant a shortcode that renders as its own
 * literal text in the post they paste it into.
 *
 * `tests/js/block-shortcode-parity.test.ts` reads the constant out of the PHP
 * and holds the two together.
 */
const SHORTCODE_TAG = 'wconvert_optin';

/**
 * What the block draws in the editor canvas: **a labelled placeholder, never
 * the Optin.**
 *
 * ============================================================================
 * ADR 0040 IS ABOUT THE BUILDER'S PREVIEW, AND THIS IS NOT THE BUILDER.
 * ============================================================================
 * That ADR made the preview *"a surface the merchant works on"* — click a
 * headline and the caret lands in the block that edits it. Every word of it is
 * about the one screen where an Optin's words, design and rules are edited,
 * and it is what makes the real renderer's presence there worth its cost: the
 * picture is an INPUT.
 *
 * Here it could only be an output. The post editor edits the post; nothing on
 * this screen can change what the Optin says, so a render of it would be the
 * static thumbnail ADR 0010 says does not exist anywhere in this flow — with
 * the added cost of shipping the renderer, the design library and a template
 * fetch into the post editor to draw a picture nobody can act on.
 *
 * What the merchant needs here is the one fact this screen decides: WHICH
 * Optin goes at this point in the page. So that is what it shows, by name.
 */
export function Edit({
  attributes,
  setAttributes,
}: {
  attributes: { optinId?: string };
  setAttributes: (next: { optinId?: string }) => void;
}): React.JSX.Element {
  const blockProps = useBlockProps();
  const optins = publishedInlineOptins();
  const chosen = attributes.optinId ?? '';
  const resolved = optins.find((optin) => optin.id === chosen);

  return (
    <div {...blockProps}>
      <Placeholder
        icon="feedback"
        label={__('Inline Optin', 'wconvert')}
        instructions={
          optins.length === 0
            ? __(
                'This site has no published inline Optin yet. Create one in WConvert and publish it, then choose it here.',
                'wconvert',
              )
            : __('Choose which of your inline Optins appears at this point in the page.', 'wconvert')
        }
      >
        {/*
          ====================================================================
          AN ID THAT NO LONGER RESOLVES SAYS SO, HERE, WHERE IT CAN BE FIXED.
          ====================================================================
          An Optin is unpublished, soft-deleted, or switched to another
          [[Display Type]] on a screen that has never heard of this post. All
          three arrive here identically — as an id that is not in the list —
          and all three leave a block sitting in content nobody has edited.

          On the visitor's page that is already harmless: the loader walks the
          payload looking for anchors, never the reverse, so an anchor with no
          entry is never looked at and renders nothing and records nothing.
          What it is NOT is visible. The merchant sees a page that quietly
          stopped having a form on it, and the editor is the only surface that
          can tell them which of their blocks is the one.

          It keeps the chosen id rather than clearing it, because "Summer sale
          signup was unpublished" is recoverable by republishing and an
          attribute silently reset to nothing is not.
        */}
        {chosen !== '' && resolved === undefined && (
          <Notice status="warning" isDismissible={false}>
            {sprintf(
              /* translators: %s: the stored Optin id. */
              __(
                'This block points at an Optin that is no longer published as an inline Optin (%s). Republish it, or choose another one — until then this block shows nothing on the page.',
                'wconvert',
              ),
              chosen,
            )}
          </Notice>
        )}

        <SelectControl
          __next40pxDefaultSize
          __nextHasNoMarginBottom
          label={__('Optin', 'wconvert')}
          value={resolved === undefined ? '' : chosen}
          options={[
            {
              label:
                optins.length === 0
                  ? __('No published inline Optins', 'wconvert')
                  : __('Choose an Optin…', 'wconvert'),
              value: '',
              disabled: optins.length === 0,
            },
            ...optins.map((optin) => ({ label: optin.name, value: optin.id })),
          ]}
          onChange={(optinId) => setAttributes({ optinId })}
        />

        {/*
          ====================================================================
          THE SHORTCODE FOR THE OPTIN THEY JUST PICKED, ON THE ONE SCREEN THAT
          KNOWS BOTH HALVES.
          ====================================================================
          The shortcode exists for everywhere this block is not — the classic
          editor, a page builder, a widget, `do_shortcode()` in a theme
          template — and every one of those places asks the merchant for a
          26-character ULID. **There is nowhere else in WConvert that shows
          one.** Not the Optins list, whose projection reads no LONGTEXT and
          carries no display type (ADR 0001); not the builder, which is opened
          by React state rather than by a URL; not the eligibility inspector.

          This picker already holds every published inline Optin's id beside
          its name, because that is what it is for. Printing the one they
          chose is the whole of the gap, on the screen where they are already
          deciding which Optin goes where — and it costs a line rather than a
          new surface.

          Selectable text rather than a copy button: a button needs the
          clipboard API, a permission, a success state and a fallback for the
          browsers that refuse it, to save a double-click.
        */}
        {resolved !== undefined && (
          <p className="wconvert-inline-optin__shortcode">
            {__('Elsewhere on this site, use:', 'wconvert')}{' '}
            <code>{`[${SHORTCODE_TAG} id="${resolved.id}"]`}</code>
          </p>
        )}
      </Placeholder>
    </div>
  );
}

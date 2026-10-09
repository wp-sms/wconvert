import { useBlockProps } from '@wordpress/block-editor';
import { Button, Notice, Placeholder } from '@wordpress/components';
import { useCopyToClipboard } from '@wordpress/compose';
import { useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import type { PickerRules } from './campaignPicker';
import { CampaignPickerFields, NewTabLink, campaignName, useCampaignChoices } from './campaignPicker';
import type { InlineCampaign, InlineChoices } from './optins';
import { inlineSource } from './optins';

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
  const state = useCampaignChoices(inlineSource);
  // Null is "the list never arrived", which is not the same as "there are
  // none" and must not be reported as though the merchant's campaign is gone —
  // `optins.ts` argues that at length. While it is null this block knows
  // nothing about any id, so it claims nothing about the one it holds.
  const { data } = state;
  const chosen = attributes.optinId ?? '';
  const selected = data?.campaigns.find((campaign) => campaign.id === chosen);
  const resolved = selected?.status === 'published' ? selected : undefined;
  const unresolvable = data !== null && chosen !== '' && resolved === undefined;

  return (
    <div {...blockProps}>
      <Placeholder
        icon="feedback"
        /*
          The same words as `block.json`'s `title`, and spelled again rather
          than imported from it — because the two are translated out of
          DIFFERENT catalogues. WordPress translates the metadata through its
          i18n schema when the block is registered; this is translated by
          `wp_set_script_translations` against the bundle's. `metadata.title`
          here would be the raw English string, shipped untranslated beside an
          inserter entry that was translated.

          `tests/js/block-shortcode-parity.test.ts` holds the two spellings
          together, since the drift they permit is a merchant inserting one
          name and landing on a block headed another.
        */
        label={__('WConvert campaign', 'wconvert')}
        instructions={instructionsFor(data)}
      >
        <div className="wconvert-inline-block">
        <CampaignPickerFields value={chosen} onChange={(optinId) => setAttributes({ optinId })} state={state} rules={rules()}>
          {/*
            ==================================================================
            AN ID THAT NO LONGER RESOLVES SAYS SO, HERE, WHERE IT CAN BE FIXED.
            ==================================================================
            A campaign is unpublished, soft-deleted, or switched to another
            [[Display Type]] on a screen that has never heard of this post.
            All three arrive here as an id that is not a published inline
            campaign, and all three leave a block sitting in content nobody
            has edited.

            On the visitor's page that is already harmless: the loader walks
            the payload looking for anchors, never the reverse, so an anchor
            with no entry renders nothing and records nothing. What it is NOT
            is visible. The merchant sees a page that quietly stopped having a
            form on it, and the editor is the only surface that can tell them
            which of their blocks is the one.

            It keeps the chosen id rather than clearing it, because "Summer
            sale signup was unpublished" is recoverable by republishing and an
            attribute silently reset to nothing is not. The id itself is never
            printed (ADR 0131 decision 4): the name, when the list still has
            one, or "This campaign".
          */}
          {unresolvable && (
            <Notice status="warning" isDismissible={false}>
              {selected !== undefined
                ? sprintf(
                    /* translators: %s: the campaign's name. */
                    __('“%s” is no longer published inline, so this block shows nothing on the page. Republish it or choose another.', 'wconvert'),
                    campaignName(selected),
                  )
                : __('This campaign is no longer published inline, so this block shows nothing on the page. Republish it or choose another.', 'wconvert')}
            </Notice>
          )}
        </CampaignPickerFields>

        {/*
          ====================================================================
          THE SHORTCODE FOR THE CAMPAIGN THEY JUST PICKED, ON THE ONE SCREEN
          THAT KNOWS BOTH HALVES.
          ====================================================================
          The shortcode exists for everywhere this block is not — the classic
          editor, a page builder, a widget, `do_shortcode()` in a theme
          template — and every one of those places asks the merchant for a
          26-character ULID. That makes it the second place a campaign ID is
          shown on purpose, beside campaign Details' "For developers"
          (ADR 0131 decision 4, amended).

          A Copy button, because a 26-character ID selected by hand is the
          one that loses a character. `useCopyToClipboard` carries the
          clipboard fallback WordPress already ships, so the cost the old
          comment here weighed — permission, fallback, success state — is
          WordPress's, and what is left is the "Copied" state.
        */}
        {resolved !== undefined && <PlacedCampaign campaign={resolved} />}
        </div>
      </Placeholder>
    </div>
  );
}

/** The shortcode with Copy, and the door back to the campaign. */
function PlacedCampaign({ campaign }: { campaign: InlineCampaign }): React.JSX.Element {
  const shortcode = `[${SHORTCODE_TAG} id="${campaign.id}"]`;
  // Keyed by the text, so choosing another campaign is never shown as copied.
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCopyToClipboard<HTMLButtonElement>(shortcode, () => setCopied(shortcode));
  const done = copied === shortcode;

  return (
    <div className="wconvert-inline-block__placed">
      <p>
        {__('Elsewhere on this site, use:', 'wconvert')}{' '}
        <code>{shortcode}</code>
      </p>
      <div className="wconvert-lock-picker__actions">
        <Button ref={copy} variant="secondary">
          {done ? __('Copied', 'wconvert') : __('Copy shortcode', 'wconvert')}
        </Button>
        {campaign.editUrl !== null && <NewTabLink href={campaign.editUrl}>{__('Edit campaign', 'wconvert')}</NewTabLink>}
      </div>
      <span className="screen-reader-text" role="status">{done ? __('Shortcode copied.', 'wconvert') : ''}</span>
    </div>
  );
}

/**
 * What this block places, and how it refuses the rest.
 *
 * A function rather than a constant because `__()` must not run at module
 * scope: the catalogue is not loaded when the bundle is evaluated.
 */
function rules(): PickerRules<InlineCampaign> {
  return {
    ready: (campaign) => campaign.status === 'published',
    // Listed, refused, and saying why — GUIDELINES §8. A draft's anchor
    // renders nothing, so placing one would look done and show nothing.
    refused: (campaign) => campaign.status === 'draft'
      /* translators: %s: a campaign's name. */
      ? sprintf(__('%s — draft, publish to place it', 'wconvert'), campaignName(campaign))
      : null,
    createLabel: __('Create an inline campaign', 'wconvert'),
    askAdministrator: __('Ask your administrator to publish an inline campaign.', 'wconvert'),
  };
}

/**
 * What the placeholder says above the picker, for each of the three states.
 *
 * Three rather than two, because the third is the one that used to be
 * misreported: a list that never arrived is a broken editor, not an empty
 * site, and the merchant's campaigns are all still on their pages.
 */
function instructionsFor(data: InlineChoices | null): string {
  if (data === null) {
    return __('Your campaigns couldn’t be loaded here. Blocks already on the page still work. Reload the editor.', 'wconvert');
  }

  if (!data.campaigns.some((campaign) => campaign.status === 'published')) {
    return data.campaigns.length > 0
      ? __('Your inline campaigns are drafts. Publish one, then choose it here.', 'wconvert')
      : __('This site has no inline campaign yet. Create one and publish it, then choose it here.', 'wconvert');
  }

  return __('Choose which inline campaign appears here.', 'wconvert');
}

import { useId } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ExternalLink } from 'lucide-react';
import { Button } from '../components/ui/button';
import { adminSettings } from '../settings';
import { useDirection } from '../hooks/useDirection';
import { physicalPlacementLabel } from './PlacementControl';
import { inlinePlacementLabel } from '../inlinePlacement';
import { Shortcode } from './ManualPlacement';

export { inlineShortcode } from './ManualPlacement';

export interface PlacementGuidanceProps {
  readonly optinId: string;
  readonly optinName?: string;
  readonly displayType: string;
  readonly placement?: unknown;
  readonly inlinePlacement?: unknown;
  /** A published version exists; this does not assert that it can show on any page. */
  readonly published: boolean;
}

/** Open the existing real-page inspector, using WordPress's subdirectory-aware home URL. */
export function siteCheckUrl(homeUrl?: string, inspectParam?: string): string | null {
  if (!homeUrl || !inspectParam) return null;
  try {
    const target = new URL(homeUrl);
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) return null;
    target.searchParams.set(inspectParam, '1');
    return target.toString();
  } catch {
    return null;
  }
}

/** Placement instructions shared by draft review and the result of publishing. */
export function PlacementGuidance({ optinId, optinName, displayType, placement, inlinePlacement, published }: PlacementGuidanceProps) {
  const id = useId();
  const direction = useDirection();
  const inline = displayType === 'inline';
  const automatic = inline ? inlinePlacementLabel(inlinePlacement) : null;
  const position = physicalPlacementLabel(displayType, placement, direction);
  const settings = adminSettings();
  const siteCheck = published ? siteCheckUrl(settings?.homeUrl, settings?.inspectParam) : null;

  return (
    <section className="wconvert-placement" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{inline ? __('Place this Campaign on a page', 'wconvert') : __('Check where it appears', 'wconvert')}</h3>
      {automatic ? <>
        <p>{automatic}</p>
        <p>{__('After publishing, Pro places this Campaign in matching WordPress posts and pages when its display rules allow it. No block or shortcode is needed. A manual embed takes precedence.', 'wconvert')}</p>
        <p>{__('Check a matching article on your site. Page builders and custom layouts may need manual placement.', 'wconvert')}</p>
      </> : inline ? (
        <>
          {!published && <p>{__('Publish this Campaign first so it becomes available in the page editor.', 'wconvert')}</p>}
          <ol className="wconvert-placement__steps">
            <li>{__('Edit the page or post where you want the form to appear.', 'wconvert')}</li>
            <li>{optinName
              ? sprintf(/* translators: %s: the Optin name in the page editor's picker. */ __('Add the “Inline Campaign” block and choose “%s”.', 'wconvert'), optinName)
              : __('Add the “Inline Campaign” block and select this Campaign by its name.', 'wconvert')}</li>
            <li>{__('Update the page, then open it on your site to check the placement.', 'wconvert')}</li>
          </ol>
          <Shortcode optinId={optinId} />
          <p className="text-note text-muted-foreground">
            {__('The block or shortcode places it on the page. Its display rules, schedule and visitor settings still decide whether it appears.', 'wconvert')}
          </p>
        </>
      ) : (
        <>
          {position !== null && <p>{sprintf(__('Position: %s.', 'wconvert'), position)}</p>}
          <p>{published
            ? __('Your published version can appear on pages that match its display rules. Its schedule, triggers and visitor settings still decide when it shows.', 'wconvert')
            : __('After publishing, this Campaign can appear on pages that match its display rules. Its schedule, triggers and visitor settings decide when it shows.', 'wconvert')}</p>
        </>
      )}
      {siteCheck !== null && (
        <div className="wconvert-placement__check">
          <Button asChild variant="outline" size="sm">
            <a href={siteCheck} target="_blank" rel="noopener noreferrer" aria-describedby={`${id}-check-note`}>
              {__('Check your homepage', 'wconvert')}<ExternalLink aria-hidden="true" />
            </a>
          </Button>
          <p id={`${id}-check-note`} className="text-note text-muted-foreground">
            {__('Opens display checks for the published version in your signed-in session. It does not show draft edits or simulate a signed-out visitor.', 'wconvert')}
            {inline && !automatic && <> {__('For an inline form, also check the page where you placed its block or shortcode.', 'wconvert')}</>}
          </p>
        </div>
      )}
      {!published && <p className="text-note text-muted-foreground">{__('The editor preview shows your draft. Check the actual page after publishing.', 'wconvert')}</p>}
    </section>
  );
}

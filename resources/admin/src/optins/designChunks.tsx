import { Suspense, lazy, type ComponentProps } from 'react';
import { withRenderExtensions } from '../renderExtensions';
import { ChunkBoundary } from '../shell/ChunkBoundary';

/**
 * The lazily loaded pieces that draw a campaign's design, each ready only once
 * the renderer's extensions are (#397). One place, so a screen that shows a
 * design cannot import the chunk without what Pro adds to the renderer.
 */
const LazyCampaignDesign = lazy(() => withRenderExtensions(import('./CampaignDesign')));

export const LazyCampaignDetails = lazy(() => withRenderExtensions(import('./CampaignDetails')));

/**
 * A campaign's design as a thumbnail, with the placeholder box while it loads
 * and **in place of it if its code never comes**. A thumbnail is decoration on
 * the list it sits in: a failed download costs the picture, never the list,
 * the way a failed preview read costs one line on Campaigns.
 */
export function CampaignThumbnail(props: ComponentProps<typeof LazyCampaignDesign>) {
  const placeholder = <div className="wconvert-preview-placeholder" />;
  return (
    <ChunkBoundary failed={placeholder}>
      <Suspense fallback={placeholder}><LazyCampaignDesign {...props} /></Suspense>
    </ChunkBoundary>
  );
}

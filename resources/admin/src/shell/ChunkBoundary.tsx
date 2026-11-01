import { Component, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { Region, RegionErrorState } from './Region';

/**
 * The chunk that never came (#363). A missing or partly copied chunk — the
 * builder's, a section's, a design's — rejects its import, and without this the screen went blank with the reason
 * only in the console. A browser remembers a failed module for the life of the
 * page, so there is no "Try again" here, as in {@see FlowMapBoundary}: only a
 * reload, or a reinstall when the file is truly gone, fetches it again.
 *
 * `way` is the way out. The builder draws its own back link, so it brings one;
 * creation's sits above it in {@see App} and still works. A section sits inside
 * the frame and needs neither; a page that draws its own frame, as the occasion
 * page does, passes `frame` to keep the nav around the message. Decoration —
 * a design thumbnail — passes `failed`, its own stand-in, and no message.
 *
 * Around the builder (`builder/lazy.tsx`), every lazy section (`sections.tsx`)
 * and Campaigns, whose thumbnails are a chunk: a tab left open across an
 * update that deleted a file says what happened instead of going blank.
 */
export class ChunkBoundary extends Component<{ children: ReactNode; way?: ReactNode; frame?: (content: ReactNode) => ReactNode; failed?: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    // Decoration that failed (a thumbnail) brings its own stand-in; the page around it stays.
    if (this.props.failed !== undefined) return this.props.failed;
    const failed = <Region>
      <RegionErrorState message={__('Part of WConvert didn’t load.', 'wconvert')}
        hint={__('Reload the page. If it keeps happening, reinstall the plugin.', 'wconvert')} />
    </Region>;
    if (this.props.frame) return this.props.frame(failed);
    // The builder's own frame, so the way out sits where the skeleton put it.
    return this.props.way === undefined ? failed : <div className="wconvert-builder-skeleton">
      <div className="wconvert-builder-skeleton__header">{this.props.way}</div>
      <div className="p-6">{failed}</div>
    </div>;
  }
}

import { Component, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { RegionErrorState } from '../shell/Region';

/**
 * The Flow map loads on demand (ADR 0142). If its code fails to download or
 * throws while drawing, this keeps the rest of the editor working and says so
 * where the map would be. There is no "Try again": a browser remembers a
 * failed module for the life of the page, so only a reload fetches it again
 * (GUIDELINES §13).
 */
export class FlowMapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="wconvert-journey-map wconvert-flow-failed">
      <RegionErrorState message={__('The Flow map couldn’t load. Canvas still works.', 'wconvert')}
        hint={__('Save your draft, then reload the page to try again.', 'wconvert')} />
    </div>;
  }
}

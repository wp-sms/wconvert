import { __ } from '@wordpress/i18n';
import { RegionSkeleton } from '@/shell/RegionSkeleton';
import { adminSettings } from '@/settings';
import './license-frame.css';

/**
 * The License page before its code or its state, in the shape that lands: the
 * one activate card on a site with nothing activated, otherwise the status card
 * over Sites and License key. The header badge's `prompt` is set exactly when
 * nothing is activated, and it is on the page before any read.
 *
 * Outside the page's chunk, so the download and the license read are the one
 * placeholder ({@see LicensePage} draws it too). Its label is the page's name —
 * "Loading license…" as the label read "Loading loading license……".
 */
export function LicenseSkeleton() {
  if (adminSettings()?.planBadge?.prompt === true) {
    return (
      <div className="wconvert-license wconvert-license--narrow">
        <RegionSkeleton label={__('License', 'wconvert-pro')} description lines={3} footer />
      </div>
    );
  }

  return (
    <div className="wconvert-license">
      <RegionSkeleton label={__('License', 'wconvert-pro')} description lines={3} footer />
      <div className="wconvert-license-grid">
        <RegionSkeleton label={__('Sites', 'wconvert-pro')} announce={false} trailing lines={4} />
        <RegionSkeleton label={__('License key', 'wconvert-pro')} announce={false} lines={3} />
      </div>
    </div>
  );
}

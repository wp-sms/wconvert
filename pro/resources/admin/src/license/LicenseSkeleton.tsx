import { __ } from '@wordpress/i18n';
import { RegionSkeleton } from '@/shell/RegionSkeleton';

/**
 * The License page before its code or its state: one narrow card, at the
 * width the page's narrow layout takes. Outside the page's chunk, so the
 * download and the license read are the one placeholder ({@see LicensePage}
 * draws it too). Its label is the page's name — "Loading license…" as the
 * label read "Loading loading license……".
 */
export function LicenseSkeleton() {
  return (
    <div style={{ maxInlineSize: '44rem' }}>
      <RegionSkeleton label={__('License', 'wconvert-pro')} description lines={3} footer />
    </div>
  );
}

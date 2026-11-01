import { __ } from '@wordpress/i18n';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { optinsHref } from '../nav';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { Shell } from '../shell/Shell';

/** The occasion page's way back to Campaigns. */
export function OccasionBack() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ms-3 self-start">
      <a href={optinsHref()}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Campaigns', 'wconvert')}</a>
    </Button>
  );
}

/**
 * The occasion page while it loads. Outside its chunk, so the page's own code
 * arriving and its reads in flight are the one placeholder, not two.
 */
export function OccasionSkeleton() {
  return <Shell section="optins" pageTitle={__('Occasion', 'wconvert')} pageBack={<OccasionBack />} hideDescription>
    <RegionSkeleton label={__('Occasion', 'wconvert')} lines={6} />
  </Shell>;
}

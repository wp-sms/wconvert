import { __ } from '@wordpress/i18n';

export const Bundled = () => <p>{__('Fixture bundled', 'wconvert-fixture')}</p>;
export const Dropped = () => <p>{__('Fixture dropped', 'wconvert-fixture')}</p>;
// Shipped file, unshipped string: no bundle contains it, the way a minifier
// drops a branch it proves is never taken.
export const Shaken = () => <p>{__('Fixture shaken', 'wconvert-fixture')}</p>;

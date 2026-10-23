import { __ } from '@wordpress/i18n';

// Nothing imports this file and the bundle never saw it: the checker must set it
// aside as unshipped rather than fail on it.
export const Dead = () => <p>{__('Fixture dead', 'wconvert-fixture')}</p>;

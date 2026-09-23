import { adminSettings } from './settings';

let updated: string | undefined;
export const phoneSiteCountry = () => updated ?? adminSettings()?.phoneDefaultCountry ?? '';
export const setPhoneSiteCountry = (country: string) => { updated = country; };

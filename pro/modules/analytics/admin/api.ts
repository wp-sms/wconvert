export interface SettingsValue { enabled: boolean; route: 'gtag' | 'gtm'; measurement_id: string; consent: 'wp' | 'site'; dismissals: boolean; exclude_managers: boolean; data_layer: string; }
export interface Response { settings: SettingsValue; home: string; environment: string; site_matches: boolean; excluded: number; test_url: string; guide_url: string; asset_available: boolean; }
export const path = '/wconvert/v1/analytics-integration';

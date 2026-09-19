import apiFetch from '@wordpress/api-fetch';

export interface PrivacyDestination {
  id: string;
  label: string;
  type: string;
  type_label: string;
  /** Null means the configured type is no longer registered on this install. */
  fields: string[] | null;
}

export interface PrivacyDataMap {
  retention_days: number | null;
  destinations: PrivacyDestination[];
  browser: {
    key: string;
    cookie_fallback: boolean;
    contains_contact_details: boolean;
    contains_visitor_identifier: boolean;
  };
  beacon_rate_limit_seconds: number;
}

export const readDataMap = () => apiFetch<PrivacyDataMap>({
  path: '/wconvert/v1/privacy/data-map',
});

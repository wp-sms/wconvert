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
    local_storage_expiry_days: null;
    cookie_fallback: boolean;
    cookie_fallback_days: number;
    contains_contact_details: boolean;
    contains_visitor_identifier: boolean;
    stores_ab_assignment: boolean;
    cart_recovery: null | {
      key: string;
      expires_with_cart_session: boolean;
      contains_item_count: boolean;
      contains_cart_total: boolean;
      contains_contact_details: boolean;
    };
  };
  beacon_rate_limit_seconds: number;
  capture_rate_limit_seconds: number;
}

export interface PrivacyGuidance {
  enabled: boolean;
}

export const readDataMap = () => apiFetch<PrivacyDataMap>({
  path: '/wconvert/v1/privacy/data-map',
});

export const readPrivacyGuidance = () => apiFetch<PrivacyGuidance>({
  path: '/wconvert/v1/privacy/guidance',
});

export const savePrivacyGuidance = (enabled: boolean) => apiFetch<PrivacyGuidance>({
  path: '/wconvert/v1/privacy/guidance',
  method: 'POST',
  data: { enabled },
});

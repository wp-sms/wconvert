import apiFetch from '@wordpress/api-fetch';

export interface PickerPreferences {
  schema: 1; revision: number; saved: string[]; hidden: string[]; events: string[]; businesses: string[]; markets: string[]; show_featured?: boolean;
}
export interface Occasion { id: string; name: string; start: string; end: string }
export interface Occasions { schema: 1; revision: number; items: Occasion[] }
export interface Collection {
  id: string; revision: string; name: string; description: string;
  business_types: string[]; markets: string[]; priority: number;
  cover: 'sale' | 'launch' | 'services' | 'reading';
  items: { setup_id: string; stage: 'before' | 'during' | 'after' | 'any' }[];
  event?: { family: string; start: string; end_exclusive: string; feature_start: string; feature_end_exclusive: string };
}
export interface PickerData {
  saved_designs?: { key: string; name: string; retired: boolean }[];
  schema: 1; today: string; timezone: string; collections: Collection[];
  server_time?: number; timezone_offset?: number;
  preferences: PickerPreferences; occasions: Occasions;
}
export const pickerData = () => apiFetch<PickerData>({ path: '/wconvert/v1/picker' });
export const savePreferences = (value: PickerPreferences) => apiFetch<PickerPreferences>({
  path: '/wconvert/v1/picker/preferences', method: 'PUT', data: { revision: value.revision, data: value },
});
export const saveOccasions = (value: Occasions) => apiFetch<Occasions>({
  path: '/wconvert/v1/picker/occasions', method: 'PUT', data: { revision: value.revision, data: { items: value.items } },
});

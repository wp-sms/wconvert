/** Local preview responses. No network request or provider contact is made. */
export const readMappingFields = async (destination: string, refresh = false) => {
  if (destination === 'error' && !refresh) throw new Error('The service did not respond. Retry loading fields.');
  if (destination === 'empty') return { fields: [] };
  return { fields: [
  { value: 'SERVICE', label: 'Service interest' },
  { value: 'PROJECT', label: 'Project type' },
  { value: 'NOTES', label: 'Additional notes' },
] };
};

export const previewMapping = async (_destination: string, draft: {
  email: string;
  mapping: Record<string, string>;
  sample: Record<string, string>;
}) => ({
  email: draft.email,
  mapped: Object.fromEntries(Object.entries(draft.mapping).filter(([source]) => draft.sample[source]?.trim()).map(([source, target]) => [target, draft.sample[source].trim()])),
});

export const testMapping = async () => {
  throw new Error('This is a local preview. No contact was sent. Connect a real account to test delivery.');
};

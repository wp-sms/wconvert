/** Local preview responses. No network request or provider contact is made. */
export const readMappingFields = async (destination: string, refresh = false) => {
  if (destination === 'error' && !refresh) throw new Error('The service did not respond. Retry loading fields.');
  if (destination === 'refresh-error' && refresh) throw new Error('Temporary service outage.');
  if (destination === 'loading') await new Promise((resolve) => setTimeout(resolve, 15000));
  if (destination.startsWith('interest') || destination === 'refresh-error') return { fields: [
    { value: 'ALL', label: 'All interests' },
    ...(destination === 'interest-empty' ? [] : [
      { value: 'RUNNING', label: 'Interested in running', type: 'boolean' },
      { value: 'HIKING', label: 'Interested in hiking', type: 'boolean' },
    ]),
  ] };
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
  sample: Record<string, string | boolean>;
}) => ({
  email: draft.email,
  mapped: Object.fromEntries(Object.entries(draft.mapping).filter(([source]) => draft.sample[source] === true || (typeof draft.sample[source] === 'string' && draft.sample[source].trim())).map(([source, target]) => [target, typeof draft.sample[source] === 'string' ? draft.sample[source].trim() : true])),
});

export const testMapping = async () => {
  throw new Error('This is a local preview. No contact was sent. Connect a real account to test delivery.');
};

/** Local preview responses. No network request or provider contact is made. */
export const readMappingFields = async () => ({ fields: [
  { value: 'SERVICE', label: 'Service interest' },
  { value: 'PROJECT', label: 'Project type' },
] });

export const previewMapping = async (_destination: string, draft: {
  email: string;
  mapping: Record<string, string>;
  sample: Record<string, string>;
}) => ({
  email: draft.email,
  mapped: Object.fromEntries(Object.entries(draft.mapping).map(([source, target]) => [target, draft.sample[source] ?? ''])),
});

export const testMapping = async () => {
  throw new Error('This is a local preview. No contact was sent. Connect a real account to test delivery.');
};

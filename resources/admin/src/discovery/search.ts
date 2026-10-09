/** Reviewed English task aliases; translated authored names remain searchable verbatim. */
const ALIASES = [
  ['quote', 'estimate', 'quotation'],
  ['bar', 'banner'],
  ['enquiry', 'enquiries', 'inquiry', 'inquiries'],
  ['signup', 'sign-up', 'subscribe', 'subscription'],
];
export function matchesSearch(query: string, texts: readonly (string | undefined)[]): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  const haystack = texts.filter(Boolean).join(' ').toLocaleLowerCase();
  if (!ALIASES.some(group => group.includes(needle)) && haystack.includes(needle)) return true;
  // Expand complete words only, so e.g. “bar” does not match “barber”.
  return needle.split(/\s+/).every(word => {
    const aliases = ALIASES.find(group => group.includes(word));
    return (aliases ?? [word]).some(value => haystack.split(/[^\p{L}\p{N}-]+/u).includes(value));
  });
}

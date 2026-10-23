/**
 * One of the inspector's words, from the labels `InspectorLabels::all()`
 * prints in the inspector's own tag — for a part of the panel that is handed
 * an entry rather than the report, as Pro's explanations are.
 *
 * `group` is a key Pro adds through `wconvert_inspector_labels`. The English is
 * at the call site because it is what shows where the tag carries no group,
 * as an older Pro beside a newer free would print.
 */
let labels: Record<string, Record<string, unknown> | undefined> | undefined;

export function inspectorLabel(group: string, key: string, english: string): string {
  if (labels === undefined) {
    try {
      labels = JSON.parse(document.getElementById('wconvert-inspector')?.textContent ?? '{}')?.labels ?? {};
    } catch {
      labels = {};
    }
  }
  const label = labels?.[group]?.[key];

  return typeof label === 'string' && label !== '' ? label : english;
}

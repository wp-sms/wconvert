import type { TemplateEntry } from '../templates/api';

/**
 * The dev-only export, and the import that reads one back.
 *
 * ============================================================================
 * THIS IS WHAT MAKES THE VOCABULARY SELF-TESTING.
 * ============================================================================
 * **Authoring is the editor plus a dev-only export, not hand-written JSON**
 * (ADR 0010). A design is arrived at in the editor and comes back out as the
 * library entry it would ship as, which is what proves every shipped Template
 * is expressible there — so we never ship a design the merchant cannot
 * adjust. Hand-written entries would make that a habit rather
 * than a property.
 *
 * **Dev-only, and gated on `WP_DEBUG` rather than on a capability.** It is not
 * a permission question — everyone on this screen already has
 * `manage_options`. It is that a merchant has no use for the library entry
 * behind their popup, and a control they cannot act on is one they learn to
 * ignore.
 *
 * **The import validates shape and nothing else, deliberately.** A template is
 * configuration rather than a document, so there is no HTML and no CSS to
 * sanitise (ADR 0010); what is left is closure, and closure is enforced where
 * the tree is WRITTEN — `TemplateVocabulary::normalize()` drops every node,
 * token, param and Slot Role outside the vocabulary on the way in. Between
 * here and there the tree is only ever rendered, and the renderer already
 * survives an unrecognised node by skipping it and refuses an href outside the
 * scheme allowlist. A second validator here would be a third spelling of the
 * manifest.
 */

/** Two spaces, because a dev reads this and a dev diffs it. */
const INDENT = 2;

/**
 * The library entry a design would ship as.
 *
 * The key order is the order `resources/templates/library/*.json` is written
 * in, so an export can be dropped into that directory and diffed against its
 * neighbours rather than reformatted first.
 */
export function exportEntry(entry: TemplateEntry): string {
  return JSON.stringify(
    {
      id: entry.id,
      name: entry.name,
      display_type: entry.display_type,
      tokens: entry.tokens,
      tree: entry.tree,
    },
    null,
    INDENT,
  );
}

/**
 * One entry read back, or null where what arrived is not one.
 *
 * Null rather than a throw: the input is a textarea a human pasted into, so a
 * half-pasted entry is an ordinary outcome the panel has to draw a message
 * for.
 */
export function importEntry(json: string): TemplateEntry | null {
  let decoded: unknown;

  try {
    decoded = JSON.parse(json);
  } catch {
    return null;
  }

  if (decoded === null || typeof decoded !== 'object') {
    return null;
  }

  const entry = decoded as Partial<TemplateEntry>;

  if (typeof entry.id !== 'string' || entry.id === '' || !Array.isArray(entry.tree?.steps)) {
    return null;
  }

  return {
    id: entry.id,
    name: typeof entry.name === 'string' ? entry.name : entry.id,
    // One Template serves exactly one Display Type (CONTEXT.md, Template), and
    // `popup` is the one every install has — the other three are Pro's.
    display_type: typeof entry.display_type === 'string' ? entry.display_type : 'popup',
    tree: entry.tree,
    tokens: entry.tokens ?? {},
  };
}

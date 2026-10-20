/**
 * Visitor-facing words with an objective defect (ADR 0156, Phase 5): left-in
 * placeholders, a doubled word, stray or doubled spaces, an unbalanced bracket
 * or quotation mark. Taste is the reviewer's; these are not.
 */
const TEXT = new Set(['text', 'label', 'placeholder', 'help', 'alt', 'heading', 'body', 'emphasis', 'italic', 'details_note', 'link_label', 'copy_label', 'copied_label', 'copy_failed_label', 'headline', 'name']);
const RULES = [
  ['placeholder', /lorem ipsum|\b(?:TODO|TBD|FIXME|XXX)\b|\[(?:insert|your|name|company)[^\]]*\]|\{\{[^}]*\}\}/i],
  ['doubled word', /\b(\w{2,})\s+\1\b/i],
  ['spacing', /^\s|\s$| {2,}|\s[,.;:!?]/],
];
const PAIRS = [['(', ')'], ['[', ']'], ['“', '”']];

export function copyIssues(value, path = '') {
  const issues = [];
  const visit = (node, at, key) => {
    if (typeof node === 'string') {
      if (!TEXT.has(key) && !at.includes('/copy')) return;
      for (const [rule, pattern] of RULES) if (pattern.test(node)) issues.push({ at, rule, text: node.slice(0, 60) });
      for (const [open, close] of PAIRS) if (node.split(open).length !== node.split(close).length) issues.push({ at, rule: `unbalanced ${open}${close}`, text: node.slice(0, 60) });
      return;
    }
    if (Array.isArray(node)) node.forEach((item, index) => visit(item, `${at}/${index}`, key));
    else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) visit(v, `${at}/${k}`, k);
  };
  visit(value, path, '');
  return issues;
}

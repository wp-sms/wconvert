// The admin bundle's exact shape, minified by the check itself with the admin
// build's own GETTEXT_SAFE_TERSER: `wordpressGlobals()` destructures the
// gettext functions into module-scope locals, which is what a minifier renames.
// The file the check writes from this must still say `__(` for every call,
// must still carry the translators comment, and must still be a file make-pot
// can parse — or the admin build's settings no longer do any of the three.
const { __, sprintf } = window.wp.i18n;

export const label = (name) => sprintf(
  /* translators: %s: a fixture's name. */
  __('Fixture minified %s', 'wconvert-fixture'),
  name
);

// `conditionals` folds this into `__(on ? 'Fixture on' : 'Fixture off', …)`,
// whose msgid is no literal: both strings vanish from the POT.
export const state = (on) => (on ? __('Fixture on', 'wconvert-fixture') : __('Fixture off', 'wconvert-fixture'));

// `inline` above 1 rewrites the call to `keys` as `(t = …, a = …, [...new Map(…)])`,
// which make-pot's parser rejects — and with it every string in the file.
const keys = (tree, action) => [...new Map([[tree, action]]).values()];

export const listed = (t, l) => (t ? keys(t.tree, l && l.action) : []).map(() => __('Fixture listed', 'wconvert-fixture'));

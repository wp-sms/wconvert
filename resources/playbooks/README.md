# Bundled Playbooks

One PHP file per entry, each `return`ing an array.

**PHP rather than JSON, and that is the whole reason this directory is not
`resources/playbooks/*.json` beside `resources/templates/library/*.json`.** A
[[Playbook]] is nothing but words, and `wp i18n make-pot` cannot see a JSON
string — a JSON bundled registry ships an English-only library
([ADR 0013](../../docs/adr/0013-playbook-copy-carries-no-markup.md)). A
[[Template]] is structure, and its only words are placeholders no visitor ever
reads, so it stays JSON.

Remote entries are JSON and untranslated, because remote PHP is Guideline 8
remote code execution with no argument available. **The fetch is designed and
not built in v1**: a decoded remote entry is an array, so it enters through
`PlaybookLibrary::fromEntries()` exactly as a bundled one does.

## What an entry may say

Everything here is validated **at registration** by
`WConvert\Playbook\PlaybookLibrary`, which is the only place the guarantee
lives — there is no runtime check behind it.

- `copy` is plain text bound to [[Slot Role]]s, and every Role it fills must be
  one the default Template declares.
- A sentence needing a link expresses it as **structure**: a `%s` placeholder
  plus a `{label}`. **No `href`** — a link with a label and no destination is
  asking for the one destination only the site can name, and the renderer
  resolves it (ADR 0032).
- **Nothing site-local**: no post or term ids in `targeting`, no Destination
  ids. `destination_hint` names Destination *types* and the [[Lead]] fields the
  Playbook needs, and nothing else.
- No images, and no markup of any kind.
- The default Template's converting act must be the one its [[Goal]] counts.

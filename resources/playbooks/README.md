# Bundled Playbooks

One PHP file per entry, each `return`ing an array.

**PHP rather than JSON, and that is the whole reason this directory is not
`resources/playbooks/*.json` beside `resources/templates/library/*.json`.** A
[[Playbook]] supplies visible words, and `wp i18n make-pot` cannot see a JSON
string — a JSON bundled registry ships an English-only library
([ADR 0013](../../docs/adr/0013-playbook-copy-carries-no-markup.md)). A
[[Template]] supplies structure and gallery samples, so it stays JSON. A
merchant can explicitly adopt those samples through **Use this design's sample
content**; the default **Keep my content** prepares the merchant's current
words in the new design before Apply
([ADR 0075](../../docs/adr/0075-draft-history-and-template-content-choices-stay-predictable.md)).

Remote entries are JSON and untranslated, because remote PHP is Guideline 8
remote code execution with no argument available. Reviewed JSON packs can supply campaign setups under ADR 0083: a decoded remote entry is an array, so it enters through
`PlaybookLibrary::fromEntries()` exactly as a bundled one does.

## What an entry may say

Everything here is validated **at registration** by
`WConvert\Playbook\PlaybookLibrary`, which is the only place the guarantee
lives — there is no runtime check behind it.

- `copy` is plain text bound to [[Slot Role]]s, and every Role it fills must be
  one the default Template declares.
- Choice content uses `interest_options: {options: [{value, label}]}`. The
  wrapper is one Role value, not repeated Roles. Translate each visible label
  with `__()`; stable answer values remain untranslated. The enquiry starting
  point demonstrates the single optional qualification question under the
  sixth Goal, **Collect enquiries**
  ([ADR 0076](../../docs/adr/0076-an-enquiry-captures-one-optional-choice-before-handoff.md)).
- A sentence needing a link expresses it as **structure**: a `%s` placeholder
  plus a `{label}`. **No `href`** — a link with a label and no destination is
  asking for the one destination only the site can name, and the renderer
  resolves it (ADR 0032).
- **Nothing site-local**: no post or term ids in `targeting`, no Destination
  ids. `destination_hint` names Destination *types* and the [[Lead]] fields the
  Playbook needs, and nothing else.
- No images, and no markup of any kind.
- **No `code_value` or `wordmark`.** The coupon and business name belong to one
  site, so these author-only Roles stay the merchant's to fill. The design
  supplies samples
  ([ADR 0061](../../docs/adr/0061-the-vocabulary-widens-by-what-the-library-cannot-draw.md),
  [ADR 0062](../../docs/adr/0062-a-token-bag-is-scoped-to-the-box-that-carries-it.md)).

Registration validates vocabulary and copy bindings; publication additionally
checks the actual edited design against its Goal under ADR 0085. An incompatible
setup can remain a draft but cannot publish until it satisfies the contract.

Under ADR 0086, the UI calls these Campaign setups and names the task directly.
The checklist derives from actual design and Goal capabilities. List setups default
to a capable service or require explicit Collect only. Visitor copy must match the
merchant's actual follow-up. Updated collection sources need reviewed fingerprints
and a new pack version; no saved merchant copy is rewritten.

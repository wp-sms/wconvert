# Playbook copy carries no markup

Playbook copy is plain text. The renderer writes it with `textContent` and never
touches `innerHTML`. The one case that genuinely needs a link inside a sentence —
fine print — expresses it as **structure rather than markup**:

```jsonc
"fine_print": {
  "text": "By subscribing you agree to our %s",
  "link": { "label": "Privacy Policy", "href": "https://…" }
}
```

The renderer splits on the placeholder and constructs the `<a>` itself. The href
is scheme-validated to `http`, `https` or `mailto` in PHP at write.

*Completed by [#24](https://github.com/navidkashani/wconvert/issues/24): the
placeholder is not decoration, it is **the link's only place**. A sentence
carrying no `%s` renders no anchor at all, exactly as a link with no resolved
href renders none — the renderer originally appended the label to the end of the
sentence instead, which produced a word glued to the last one. That mattered
enough to correct because the [[Consent Record]] stores the sentence exactly as
shown, so an evidence string is what a rendering glitch would have become. And
only the **first** `%s` is the link: a sentence carries one link, so a second
placeholder stays literal text.*

*Amended by
[ADR 0032](0032-consent-capture-is-first-class-in-the-template.md): a Playbook
supplies the consent and fine-print **wording**, never the privacy-policy link.
The renderer resolves that one from `get_privacy_policy_url()` at render time, on
the same reasoning that keeps Destination ids out of Playbooks — a Playbook can
express nothing site-local, so the link is right on every site without any entry
knowing which site it is on. The `link` structure above is unchanged; for this
case its `href` comes from the site rather than from the entry.
[ADR 0025](0025-cart-recovery-captures-nothing.md) reuses the shape for the cart
URL.*

**Consequently `wp_kses` does not apply to Playbooks.** ADR 0010 removed it from
templates; this removes it from copy, which is the only other thing a Playbook
carries. #7's requirement for a custom `wp_kses` allowlist is **retired, not
satisfied differently** — there is nothing left for it to sanitise.

## Why #7's allowlist requirement evaporated

#7 established that `wp_kses_post()` is insufficient here, verified against WP
7.1's `$allowedposttags`: it correctly excludes `script`, `style` and `iframe`,
but also omits `form`, `input` and `select`, "which an opt-in template needs."

That reasoning was written against a document-model template. Under ADR 0010 a
field is a `field` **node** drawn from a closed vocabulary, not markup — so there
is no form markup for an allowlist to have to permit, and the gap that made a
custom allowlist necessary does not exist.

What remained was inline emphasis and the fine-print link. A four-tag allowlist
(`a`, `strong`, `em`, `br`) would have covered both.

## Why four tags still lost

Allowing any HTML forces the renderer to `innerHTML` those nodes. That puts an XSS
sink inside the ≤8KB loader on the hot path, and costs ADR 0010 the property it
prized — that the renderer is a pure function of (tree, tokens).

Server-side sanitisation at write is the standard WordPress posture and would
probably hold. But it trades a structural guarantee for a procedural one, on the
single most exposed code path in the product, to buy inline `<strong>`. The
remote library makes that trade worse: copy arriving from off-site is the exact
input class #7's "content, never capability" line exists to constrain, and a
sanitiser is a thing that can have a bug where a `textContent` renderer cannot.

Expressing the link as structure gets the capability with none of the exposure —
the same move ADR 0010 made on templates, applied one layer up.

## Consequences

- **No bolding a word inside a headline.** This is a real loss and the honest
  cost of the decision. Tokens style the whole node, so emphasis is all-or-nothing
  per node. Recoverable later as a structured emphasis span if it is actually
  missed in practice; not worth an `innerHTML` sink up front.
- **Playbooks never supply images**, for the adjacent reason plus bytes and
  licensing. A template's image slot keeps the template's own asset or stays empty.
  *Still true, and amended once the merchant became a third source. A [[Playbook]]
  supplies no image and a [[Template]] supplies its own — but a merchant may
  upload one, and until the structure editor landed that upload was destroyed by
  the next design they picked, because `image` declares no `copy` and no
  [[Slot Role]] binds to it. [`MerchantsOwn`](../../src/Template/MerchantsOwn.php)
  carries an `image`'s `src`/`alt` and a `button`'s `href` across a switch,
  and it carries only what the merchant CHANGED — measured against the entry
  their copy was taken for. Where they changed nothing the new design's own
  asset stands, which is this sentence being honoured rather than excepted.*
- **~~The residual `href` exposure is bounded and stated~~**: a remote Playbook can
  render a link to an arbitrary URL on the merchant's site. Scheme validation
  closes `javascript:`; it does not stop a link to a bad destination. Accepted
  rather than solved with a two-tier sanitiser for bundled versus remote entries,
  which is more code and a second path to get wrong.
  *Closed by [#27](https://github.com/navidkashani/wconvert/issues/27), and by
  the rule directly above rather than by a sanitiser. **A Playbook's copy carries
  a link LABEL and never an `href`**, refused at registration
  ([`PlaybookLibrary`](../../src/Playbook/PlaybookLibrary.php)). This ADR's own
  amendment already made the destination the site's to supply for the case that
  needs one, and [ADR 0025](0025-cart-recovery-captures-nothing.md) reused the
  shape for the cart URL — so an entry carrying an href is naming a page on one
  particular site, which is the thing a Playbook may not do at all. The
  arbitrary-URL exposure therefore has no shape left to arrive in, and the
  two-tier sanitiser stays refused because there is now nothing for it to
  sanitise. The scheme validation is unchanged and still applies at write, to
  the href a MERCHANT types.*
- **Bundled Playbooks ship as PHP files returning arrays; remote ones as JSON.**
  A Playbook is nothing but words and `wp i18n make-pot` cannot see a JSON string,
  so a JSON bundled registry ships an English-only library. Remote entries stay
  JSON and untranslated because remote PHP is Guideline 8 remote code execution
  with no argument available. Both normalise to one in-memory shape.
  *Built by [#27](https://github.com/navidkashani/wconvert/issues/27):
  [`resources/playbooks/*.php`](../../resources/playbooks/), normalised by
  [`PlaybookLibrary::fromEntries()`](../../src/Playbook/PlaybookLibrary.php) —
  which is the one door in, so **the remote fetch is designed and not built**
  rather than designed and duplicated. A decoded remote entry is an array and
  goes through the same call; what is missing is the transport.
  `tests/unit/Playbook/BundledPlaybooksTest.php` asserts every shipped word is
  reachable by `make-pot`, which is the claim this bullet rests on and had
  nothing holding it.*

  *Completed by [#52](https://github.com/navidkashani/wconvert/issues/52), with
  the cost this shape carries and where it is paid. **A PHP entry translates
  when the file is READ**, not when a word is displayed: `require`ing the seven
  bundled files fires 57 `__()` calls, so WHERE the library is built decides
  whether they are legal. It was built in `CoreServiceProvider::register()` and
  resolved from `boot()`, which runs on `plugins_loaded` — before `init`, where
  WordPress refuses to translate and says so by printing
  `_load_textdomain_just_in_time was called incorrectly` mid-request, on every
  request of every install. The decision is unchanged and the strings stay in
  PHP; what moved is the moment the directory is read. Every REST controller is
  now resolved on `rest_api_init`
  ([`CoreServiceProvider::REST_CONTROLLERS`](../../src/Container/CoreServiceProvider.php)),
  which is both after `init` and the only moment a Playbook is asked for.*

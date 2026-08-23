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
- **The residual `href` exposure is bounded and stated**: a remote Playbook can
  render a link to an arbitrary URL on the merchant's site. Scheme validation
  closes `javascript:`; it does not stop a link to a bad destination. Accepted
  rather than solved with a two-tier sanitiser for bundled versus remote entries,
  which is more code and a second path to get wrong.
- **Bundled Playbooks ship as PHP files returning arrays; remote ones as JSON.**
  A Playbook is nothing but words and `wp i18n make-pot` cannot see a JSON string,
  so a JSON bundled registry ships an English-only library. Remote entries stay
  JSON and untranslated because remote PHP is Guideline 8 remote code execution
  with no argument available. Both normalise to one in-memory shape.

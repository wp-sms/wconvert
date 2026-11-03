# 0183: Design words are one list per language

Accepted 2026-11-02. Amends ADRs 0013, 0084, 0115, 0156, 0166 and 0175, each with an inline note.

## Context

Setup words are marked for translation and sit in the POT, but nothing translates
them until a WordPress.org community does, and a design's own words live in JSON
that no extractor reads. So a German site's new campaigns start in English.

Putting the words through gettext would need bundled `.mo` files, a
`load_plugin_textdomain()` call, a filtered POT and sidecar downloads per design.
A partial community pack would then replace reviewed words wholesale, and any
word shared with the admin would drag the admin's language along.

## Decision

1. **One list per language, English to translation.** `WConvert\Template\DesignWords`
   walks a design or a setup and replaces each word its list has. The price is one
   translation per English phrase everywhere.

2. **The source is one `.po` per language**, in `tools/design-library/translations/`,
   which never ships. `npm run templates:words` writes
   `resources/templates/words/<locale>.json` for Free and
   `pro/resources/templates/words/<locale>.json` for Pro, Pro's holding the words of
   its designs and setups and of the paid setups the online library serves. Those stay
   out of every public file, and reach an installed setup through the
   `wconvert_design_words` filter. Each list is complete by itself, so neither ZIP
   depends on the other's release. Each language also has a short term
   list (`<locale>.terms.md`) so a term reads one way across every design and
   follows the wording `CONTEXT.md` settles.

3. **The manifest says which keys are words.** Never an option's `value`, a field's
   `name`, an `href`, a coupon code or a wordmark. A setup's `notes` stay with the
   text domain, because they are written to the merchant and the admin stays in its
   own language.

4. **Words are applied on top of gettext.** A word a WordPress.org pack translated
   no longer matches the list, so the pack's wording stands.

5. **The site's language decides** (`get_locale()`), because the words reach the
   site's visitors. Exact match, then without the variant (`de_DE_formal` → `de_DE`),
   then the same language, except `zh`, `pt` and `sr`, whose variants are different
   writing systems or vocabularies. There is no setting.

6. **A translation must keep the marks.** Not empty, no markup, within the English's
   limit, and the same count of `%s`, `%b` and `%i`, or a privacy link could silently
   disappear. A pair that fails is dropped when a list is read and fails CI before
   then. So does a Free or Pro word without a translation, because a list applies per word
   and a gap is an English word in a German popup.

7. **Existing campaigns never change.** Words are read into a design when the library
   is read. A campaign already holds its own copy.

8. **The online library publishes a list per language too.** The release lists it under
   a new key, `words`, as content-addressed `v3/index/<sha>.json` files within the
   per-object budget: every word of a public object and every entry's name. A paid
   setup's words never go there. `free-v1.0.0` ignores the key, and the old `i18n` slot
   is removed rather than used, because that reader would apply it and show German names
   on English templates.

9. **A site fetches only its language's files**, on any refresh, on a 304 and on a known
   release. A language with no files fetched skips the twelve-hour wait once, so a site
   that changes language need not wait; a failed fetch is not retried until the next
   ordinary refresh, and it is never an error, because the library is already on screen.

10. **Online objects are all or nothing, and read after validation.** One word missing or
    refused leaves that object English, and an install is never blocked. Words apply in
    `DesignArchive::entries()` and `playbooks()` over the snapshot, so the files, the
    cache and its key, `prune` and every digest stay English and locale-free. A bad
    translation can never drop an installed design or the revision a setup pins.

11. **Publishing runs the full validator over each object in each language**, and
    `HostedDesignWordsTest` holds the same on every pull request, so a word that cannot
    stand in is found long before a site reads it. A word missing from a list is reported
    rather than refused, because it costs only its object's German.

12. **What stays English:** gallery pictures, Collections, category labels and wconvert.io.
    A card's name is translated and search reads it, so searching a translated online
    design's English name does not match.

13. **The words the popup writes itself have a small file of their own**
    (`words/labels/<locale>.json`, one each for Free and Pro), read through
    `PageLabels` when WordPress returns English. A visitor page never reads a full list,
    and a site in English touches nothing and prints nothing extra.

## Consequences

- Pro now calls a Free class that `free-v1.0.0` lacks, so a Pro release carrying this
  must raise `WCONVERT_MIN_CORE` to the Free release that ships it.
- A new bundled word needs a translation in every shipped language in the same pull
  request: `npm run templates:words -- --check` says which. Adding a language is data
  only: an empty `.po`, a generator run, the translations.
- WordPress.org translators cannot reach these lists, only `__()` words, which still
  win where they exist.
- About 165 short strings ("Offer", "Back") have one translation that may read wrong
  somewhere. Nothing checks length or fonts, and consent wording has had no human
  review. Those are accepted risks of this first version.
- `de_DE` is informal, as WordPress's own `de_DE` is, and `de_DE_formal` reads it too.
- `PictureTransfer` no longer treats a different `alt` on an unchanged picture as a
  merchant's edit, because a language change makes that difference without one. A merchant's
  real alt-only edit is left behind when switching design, since the two cannot be told apart.
- `campaign-friday-pass` sits within bytes of its byte cap in any language, so its words set
  `Offer` to `Deal` in both, and its decorative barcode's label is short.
  _Persian cannot fit at all, even with its shortest wording, so `HostedDesignWordsTest`
  names it as the one exception for `fa_IR` ([ADR 0184](0184-right-to-left-needs-more-than-logical-properties.md))._

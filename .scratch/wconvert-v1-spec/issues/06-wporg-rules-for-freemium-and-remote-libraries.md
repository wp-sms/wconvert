# wp.org rules for freemium and remote libraries

Type: research
Status: resolved

## Question

What do the WordPress.org plugin directory guidelines permit, and do any of the
decisions already made violate them?

Two decisions carry real review risk and both are load-bearing, so finding out
late would be expensive:

1. **The freemium split.** Free plugin on wp.org with a separately distributed
   premium tier, licensing via `veronalabs/wp-premium-sdk`. What are the current
   rules on upsell prompts in the admin, "premium" feature teasers, license key
   fields, and phoning home for validation? WSMS presumably clears this bar
   already — establish how, since copying a working precedent beats reasoning
   from the guidelines.
2. **The remote Playbook library.** Playbooks are data, and the registry is
   designed for eventual remote fetch. Guideline 8 territory: executable code
   must not be loaded from remote sources. Where exactly is the line between
   fetching *data* and loading *code*, and does a JSON Playbook containing HTML
   templates and rule definitions stay on the safe side?

Also confirm: guidelines on collecting personal data (Leads), on setting cookies
before consent, and on the "Powered by" / branding link if one is planned.

Deliver: what is permitted, what is prohibited, what is merely risky, and any
decision on this map that needs revisiting. Cite the guideline numbers.

## Answer

**No map decision is invalidated.** Three need a constraint *added* to their recorded
text; none changes direction. Guidelines page verified live (body banner
`March 15, 2024`); no `#guidelines` announcement post exists after 2023-03-21, so
nothing tightened in the window this ticket worried about.

**The ticket's own guideline numbering was wrong in three places**, corrected in the
findings: credit links are **Guideline 10** (not 11); tracking is **Guideline 7** (not
12); "shim to a paid service" is not Guideline 5's wording (nearest is Guideline 6's
"Storefronts that are not services").

### The three constraints to record

1. **Premium SDK ships only in the premium plugin.** The decision as recorded says
   "reuse the SDK, mirroring WSMS" but not *where it ships* — and that omission is the
   whole compliance question. A free wp.org plugin containing a license validator or
   update checker is a hard violation (Guideline 8 bullets 1–2; Common Issues "Update
   checker": *"We do not permit plugins to phone home to other servers for updates"*).
   Direct answer to the ticket's question: **the free plugin may not be the thing that
   hooks the update API.** The premium plugin, distributed outside wordpress.org, is
   not governed by these guidelines and may carry its own updater freely.

2. **"Playbook is data, not code" must become an enforced boundary, not a
   description.** Guideline 8 does not grade intent. Four constraints: closed rule
   vocabulary (enum + scalar, no expression evaluation on a remotely-sourced rule);
   `wp_kses` at the boundary with a custom allowlist; server-side fetch, cached
   locally, degrading to the bundled registry; and **content, never capability**.

3. **Playbook degradation copy must describe an *absent* feature, never a *locked*
   one**, and must never render a real control `disabled`. Guideline 9's "implying
   users must pay to unlock included features" fires on the word *locked*. If the free
   ZIP ships exit-intent code and refuses to run it, that is trialware; if the free ZIP
   simply does not contain it, the same UI is honest marketing.

### The biggest risk is Guideline 3, not Guideline 8

Everyone looks at remote fetch and thinks remote code execution. The subtler exposure
is the Playbook decision's stated *rationale* — "the library can update independently
of a plugin release" — which reads as Guideline 3's *"Distributing code via alternate
methods, while not keeping the code hosted here up to date, may result in a plugin
being removed."* The line that saves it is **content, never capability**: the engine
always ships in the wp.org ZIP, and the library only supplies inputs it already
understands.

**These two decisions reinforce each other** — visible degradation is precisely the
mechanism that stops a remote Playbook shipping capability. A Playbook that asks for
something the install lacks *degrades* rather than *acquires*. Worth recording that
they are one design, not two.

### Sharp edges found

- **Guideline 8's third bullet names CSS alongside JavaScript.** A Playbook payload
  carrying `<style>` or a remote stylesheet is caught by the same sentence that catches
  remote `<script>`. Most-missed clause in the guideline.
- **`symfony/expression-language` is a live hazard in this codebase family.** WSMS
  bundles it (`composer.json:19`, and it is in the scoper list at `:59` — verified). If
  WConvert copies WSMS conventions wholesale, reaches for the same package for Playbook
  rules, then wires remote fetch to it, "data, not code" collapses: remotely-supplied
  Symfony expressions are remote code execution by any reading of Guideline 8.
- **`wp_kses_post()` alone is insufficient.** Verified by parsing the array literal at
  local WP 7.1 `wp-includes/kses.php:68` (98 tags): `$allowedposttags` correctly
  excludes `script`/`style`/`iframe`, but also omits **`form`, `input` and `select`**,
  which an opt-in template needs. (`button`, `textarea` and `label` are already
  allowed.) A custom allowlist is required.
- **Cookies: the directory is literally silent.** The word "cookie" appears nowhere in
  the guidelines, Review Checklist, Common Issues or FAQ. The constraint on the recorded
  cookie/localStorage decision is **legal** (ePrivacy Art. 5(3)), not a directory rule.
  But *claiming* GDPR compliance in the readme **is** a directory issue (Guideline 9 /
  Compliance Disclaimers). WSMS's published readme says "GDPR Compliant" — do not copy
  that line. Net: cookies are a directory non-issue and a legal issue; claiming they are
  a legal non-issue is a directory issue.
- **Free/premium split survives unmodified.** The operative test is **kind, not
  quantity**: unlimited-but-fewer-features is fine, full-features-but-capped is
  trialware. Never add "up to 500 leads/month" — that one line would convert a compliant
  plugin into trialware.
- **Local analytics and local Lead storage are unaffected.** Guideline 7 governs
  contacting external servers.
- **Minified sources obligation (Guideline 4)** applies to the front-end loader: if the
  fresh repo is private, un-minified sources must ship inside the ZIP. Decide
  deliberately and record it.
- **"Powered by" link:** Guideline 10 — opt-in, default off, front-end only. Admin-side
  links to your own site are explicitly welcomed.

### Precedent

WP core itself fetches remote pattern HTML and runs it through `wp_kses_post()`
(`class-wp-rest-pattern-directory-controller.php` L130/L199) — core treats remote
template HTML as data and sanitizes it anyway. WSMS's precedent is clean where it
counts: license/SDK/update code is 100% under `premium/`, and its
`bin/verify-free-contract.sh` leak guard is worth rebuilding on day one. Its
`premium-feature-lock.tsx` docblock is the sentence to lift for Playbook degradation:
*"a marketing description that links out to the upgrade page — never a disabled-but-real
control."*

**Two WSMS traps not to inherit**, and one caveat: v8's `.distignore` strips
`/resources` while the readme still claims sources ship there, and v8's free React
bundle compiles in an unreachable license page. Both flagged as **unverified
precedent** — v8 is beta and wp.org stable is 7.2.7, so it has not passed a review.
Also: Plugin Check now runs on every release (since 2025-10-27), not just submissions,
raising the cost of deferred cleanup.

Full findings, with quoted guideline text and every source URL dated:
[`research/06-wporg-rules-for-freemium-and-remote-libraries.md`](../research/06-wporg-rules-for-freemium-and-remote-libraries.md)
on branch `research/06-wporg-rules-for-freemium-and-remote-libraries`.

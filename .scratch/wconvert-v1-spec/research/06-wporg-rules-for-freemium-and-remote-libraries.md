# Ticket 06 — wp.org rules for freemium and remote libraries

**Researched:** 2026-08-23
**Primary source status:** Detailed Plugin Guidelines fetched live. The page carries **two** dates: an in-body banner reading `Last Updated: March 15, 2024` and page metadata reading `First published April 9, 2015 / Last updated March 11, 2026`. The guideline *text* is the March 2024 revision; the March 2026 touch did not change the numbered guidelines' substance (no `#guidelines`-tagged announcement post exists after **2023-03-21**). Supporting handbook pages are more recent: Plugin Developer FAQ `Last Updated: 30 June 2026`, Common Issues `last updated March 20, 2026`, Review Checklist `January 24, 2024`, Block Guidelines `May 4, 2025`, Privacy `December 14, 2023`.

> **A note on numbering.** The ticket's guideline numbers are off in three places against the live page. Corrected throughout this document:
> - Credit / "Powered by" links = **Guideline 10**, not 11.
> - Tracking without consent = **Guideline 7**, not 12. (Guideline 12 is readme spam.)
> - "Primarily a shim to a paid service" is not Guideline 5's wording; the nearest real text is **Guideline 6**'s "Storefronts that are not services."
> Upsell/admin-hijacking (**11**), remote code (**8**), obfuscation (**4**) and trialware (**5**) were cited correctly.

---

## 1. Answer

**Nothing on the map is invalidated.** The recorded free/premium split is comfortably legal under the directory rules — the free tier is a genuinely complete lead-capture plugin that works with no payment and no external service, which is exactly what Guideline 5 asks for. Three decisions need a constraint added to their recorded text rather than a change of direction: the **Premium SDK** decision must record that the SDK ships *only* in the premium plugin (a free plugin containing a license validator or update checker is a hard violation of Guideline 8 and the Common Issues "Update checker" rule); the **Playbook** decision's "data, not code" claim must become an *enforced boundary* rather than a description; and the **Playbook degradation** copy must read as a marketing description of a feature that is *absent*, never as a *locked* control.

**The single biggest review risk is not Guideline 8 — it is Guideline 3.** Everyone looks at remote fetch and thinks "remote code execution." The subtler exposure in the Playbook decision is its stated rationale: "the library can update independently of a plugin release." Guideline 3 says the only version WordPress.org distributes is the one in the directory, and "Distributing code via alternate methods, while not keeping the code hosted here up to date, may result in a plugin being removed." A remote library that can change what the plugin *does* is distributing behaviour outside the directory. The line that keeps this safe: **the remote library may add content, never capability.** The engine always ships in the wp.org ZIP; the library only ever supplies inputs it already understands.

Second-biggest risk: **HTML templates are the sharp edge, and CSS is on the wrong side of it too.** Guideline 8's third bullet names JavaScript *and CSS* in the same breath. A Playbook payload carrying `<script>`, `<style>`, or a remote stylesheet is caught by the same sentence that catches remote JS. Since v1 ships a local registry only, none of this is live yet — but the schema is being designed now, and a schema that *permits* inline `<script>` is a schema that will have to be broken later.

---

## 2. ⚠️ Decisions that need revisiting

### 2.1 Premium SDK — reuse `veronalabs/wp-premium-sdk`, mirroring WSMS
**Status: PERMITTED — but the decision as recorded is incomplete, and the missing half is a hard violation.**

The decision says "reuse the SDK, mirroring WSMS." What it does not say is *where it ships*. That omission is the whole compliance question.

Colliding rules if the SDK lands in the free wp.org build:
- **Guideline 8**, bullet 1: *"Serving updates or otherwise installing plugins, themes, or add-ons from servers other than WordPress.org's"*
- **Guideline 8**, bullet 2: *"Installing premium versions of the same plugin"*
- **Common Issues → Update checker**: *"Please remove the checks you have in your plugin to provide for updates. We do not permit plugins to phone home to other servers for updates, as we are providing that service for you with WordPress.org hosting. One of our guidelines is that you actually use our hosting, so we need you to remove that code."*
- **Guideline 6**: *"A service that exists for the sole purpose of validating licenses or keys while all functional aspects of the plugin are included locally is not permitted."*

**Answer to the ticket's explicit question** — *"is a plugin allowed to hook the update API for a separately distributed plugin, and is the free plugin allowed to be the thing that does it?"* **No, not the free plugin.** The premium plugin, distributed outside wordpress.org, is not governed by these guidelines at all and may carry its own updater freely. The free plugin must contain zero update-checker code, for itself or for anything else.

**Smallest change that clears it:** amend the decision to read *"reuse `veronalabs/wp-premium-sdk`, **shipped only in the premium plugin** — the free wp.org build contains no SDK, no license field, no license screen, and no update-checker hook."* Then make it mechanical, as WSMS does: a build-time leak guard that fails the free build if the SDK directory is present (WSMS: `bin/verify-free-contract.sh`, check 3).

---

### 2.2 Playbook — "data, not code", local registry with remote fetch designed in
**Status: SURVIVES for v1 (nothing remote is built). The *designed-in* fetch is PERMITTED-BUT-CONDITIONAL, and the conditions are not yet recorded.**

For v1 this decision is unambiguously fine: a local registry makes no external request, so Guidelines 7 and 8 are not engaged at all, and there is nothing to disclose.

The claim that needs work is *"a Playbook is data, not code."* That is **true only if something enforces it.** As recorded it is a description of intent, and Guideline 8 does not grade intent. Three specific edges:

| Payload element | Verdict | Why |
|---|---|---|
| Template HTML (structural markup, text) | **Data** | WP core itself fetches remote pattern HTML and treats it as data — see §5.2 |
| Inline `<script>` in a template | **Code — prohibited** | Guideline 8; also FAQ *"we do not accept new plugins that allow arbitrary code insertion or execution"* |
| Inline `<style>` or a remote stylesheet | **Code — prohibited** | Guideline 8 bullet 3 names CSS explicitly alongside JavaScript |
| Template expressions (`{{name}}` token substitution) | **Data** | Substitution is not evaluation |
| Template expressions with calls/loops/conditionals | **Code — prohibited** | An interpreter plus a remote program is remote execution regardless of syntax |
| Declarative rule definitions the plugin's own engine interprets | **Data** | Provided the vocabulary is closed — see below |
| Rule definitions evaluated by a general expression engine | **Code — prohibited** | If the payload can express arbitrary expressions, it is a program |

The rule-definition test that matters: **a closed vocabulary is data; an open one is code.** If a Playbook rule can only select from operators the shipped engine already implements (`scroll_depth > n`, `time_on_page > n`, `url_matches`), a remote Playbook cannot make the plugin do anything it could not already do — it is a configuration file. The moment the rule payload can carry something the engine *evaluates* rather than *looks up*, it is a program delivered from a third-party server.

This is worth stating sharply because it is a live hazard in this codebase family: **WSMS bundles `symfony/expression-language`** (`composer.json`, `require`). If WConvert copies WSMS conventions wholesale and reaches for the same package for Playbook rules, then wires the remote fetch to it, the "data, not code" claim collapses — remotely-supplied Symfony expressions are remote code execution by any reading of Guideline 8.

**And the Guideline 3 exposure, which the decision's rationale creates directly.** The recorded justification is "so the library can update independently of a plugin release." Guideline 3:

> *"The only version of the plugin that WordPress.org distributes is the one in the directory. Though people may develop their code somewhere else, users will be downloading from the directory, not the development environment. Distributing code via alternate methods, while not keeping the code hosted here up to date, may result in a plugin being removed."*

**Smallest change that clears it — add four constraints to the Playbook decision:**
1. **Content, never capability.** A remote Playbook may only reference display types, rules, and destinations the *installed* plugin already implements. An unknown key degrades (see 2.6); it never causes a new behaviour to appear. This is what keeps Guideline 3 satisfied, and it is also what makes the "data, not code" claim structurally true rather than aspirational.
2. **A closed rule vocabulary.** Rule definitions are enum + scalar; no expression evaluation, ever, on a remotely-sourced rule.
3. **`wp_kses` at the boundary with an explicit allowlist.** Every remote template goes through it before storage and before output. Note: `wp_kses_post()` alone is *insufficient for this use case* — verified against local WP 7.1 `wp-includes/kses.php`, `$allowedposttags` excludes `script`, `style` and `iframe` (good) **but also `form`, `input` and `select`** (fatal for an opt-in template). Note `button`, `textarea` and `label` *are* already allowed — it is the `form`/`input`/`select` trio that is missing, verified by parsing the array literal at `kses.php:68` (98 tags). WConvert needs a custom allowlist that adds the form elements while still excluding `script`/`style`/`iframe`, plus `wp_kses`'s built-in `wp_kses_bad_protocol()` handling to kill `javascript:` URLs and its attribute allowlisting to kill `on*` handlers.
4. **Fetch server-side, cache locally, degrade to the bundled registry on failure.** Never fetch from the visitor's browser.

---

### 2.3 Playbook degradation — the premium teaser in the free UI
**Status: PERMITTED — the design instinct is right, and one word choice decides whether it stays that way.**

The recorded decision: *"A Playbook requiring a feature the install does not have (exit intent on a free site) degrades visibly — it substitutes the best available rule and says so, rather than blocking. The premium seam is an explanation, not a wall."*

Assessed directly against **Guideline 11**, as asked:

> *"Upgrade prompts, notices, alerts, and the like must be limited in scope and used sparingly, be that contextually or only on the plugin's setting page."*

This is about as favourably positioned as an upsell can be: it is contextual, it is on the plugin's own screen, it appears only at the exact moment it is relevant, and it is not a notice, a nag, or a dashboard widget. **Guideline 5** grants the permission explicitly:

> *"Attempting to upsell the user on ad-hoc products and features is acceptable, provided it falls within bounds of guideline 11 (hijacking the admin experience)."*

And the Review Checklist, the reviewers' own document, states the operative norm plainly: *"Upselling is permitted from plugin settings screen or a link on their entry on the plugin list page."*

"An explanation, not a wall" is not merely acceptable phrasing — it is the *compliant* posture, because a wall is precisely what Guideline 5 forbids. The design is already on the right side.

**The one thing that can flip it is Guideline 9:**

> *"Implying users must pay to unlock included features"*

That bullet fires on the word *locked*. If the free plugin ships exit-intent code and refuses to run it, both Guideline 9 and Guideline 5 apply and the plugin is trialware. If the free plugin simply does not contain exit intent, the same UI is honest marketing.

**Smallest change that clears it:**
- Exit-intent (and A/B, floating bar, slide-in, ESP) code must be **absent from the free ZIP**, not present-and-disabled. See 2.4.
- Copy must describe an **absent** feature, not a locked one: *"This Playbook was designed around exit intent, which WConvert Pro adds. It's running on scroll depth instead — here's what changed."* Not *"Exit intent — upgrade to unlock."*
- Render it as a **marketing panel with a link out**, never a real control rendered `disabled`. This is exactly the doctrine WSMS wrote into its own component (§5.1) and it is the single most useful thing to copy from the precedent.
- The substituted rule must be genuinely functional. It already is — "substitutes the best available rule" is the correct behaviour and satisfies the Review Checklist's *"Requirement checks fail gracefully when not present."*
- Do not surface this via `admin_notices` anywhere outside WConvert's own screens.

**Bonus: these two decisions reinforce each other.** Visible degradation is precisely the mechanism that stops a remote Playbook from shipping capability (2.2, constraint 1). A Playbook that asks for something the install lacks *degrades* instead of *acquiring* — which is what keeps the remote library on the data side of Guideline 3/8. Worth recording that they are one design, not two.

---

### 2.4 Free / premium split
**Status: SURVIVES, unmodified — with one packaging condition that is probably already assumed but is not written down.**

Free: popup + inline, page targeting, time delay, scroll depth, local lead log, CSV export, WSMS integration. That is a working lead-capture plugin. It requires no payment, no account, no external service, and no license key to deliver its stated purpose. **Guideline 5** is satisfied, **Guideline 6**'s "Storefronts that are not services" is not triggered, and the FAQ's *"We do not accept plugins that have no meaningful purpose or provide no practical functionality"* is comfortably cleared.

On the ticket's question — *how much functionality must the free tier genuinely have?* The guidelines set no quota, and the 2018 clarification post explains why: arbitrary limits are the thing being banned, not small feature sets.

> *"Historically we've not permitted test or trial plugins that arbitrarily limit usage, and then upsell… The primary reason we don't permit this is that locking people down to a specific number of (say) images is foolish and a pointless endeavour… That said, we've always allowed (and will continue to) plugins that offer a free limited service (think Akismet for a good example)."*

The operative test is **kind, not quantity**: unlimited-but-fewer-features is fine; full-features-but-capped is trialware. WConvert's split is a feature split with no caps — no lead limit, no popup limit, no impression limit. Keep it that way. *Do not* add "up to 500 leads/month" later; that single line would convert a compliant plugin into trialware.

**The condition to record:** premium features must be **absent** from the free ZIP. Guideline 5's first sentence is unconditional — *"Plugins may not contain functionality that is restricted or locked, only to be made available by payment or upgrade"* — and it is followed by the directory's own recommended architecture: *"We recommend the use of add-on plugins, hosted outside of WordPress.org, in order to exclude the premium code."* Common Issues repeats it: *"Including code from a 'premium' source — Some premium libraries are specifically not permitted to be included in free (WordPress.org hosted) plugins. Those must be removed."*

WSMS integration in the free tier is fine (Review Checklist: *"A plugin can be required but not included or auto-installed"*) provided WConvert works fully without WSMS installed.

---

### 2.5 Front-end delivery — inlined campaign JSON, client-side rules, cookies + localStorage
**Status: SURVIVES as a directory matter. The real constraint here is legal, not a directory rule — and the map should say which.**

Checked directly: **the word "cookie" does not appear anywhere in the Detailed Plugin Guidelines, the Review Checklist, Common Issues, or the Plugin Developer FAQ.** The directory has nothing to say about setting cookies before consent. Guideline 7 governs *contacting external servers*; a first-party cookie and a localStorage key contact nothing. Guideline 8's *"all non-service related JavaScript and CSS must be included locally"* is satisfied by a locally-enqueued loader, and inlining per-URL campaign JSON into the page is local data, not remote code.

**The constraint that is real is ePrivacy Directive Art. 5(3) and GDPR — law, not directory policy.** Under ePrivacy, storing or accessing information on a visitor's terminal equipment requires consent *unless* it is strictly necessary to provide a service explicitly requested by the user. "Don't show this popup again" state is commonly treated as functional/strictly-necessary by most readings, but that is a judgement WConvert's users make for their own sites in their own jurisdictions — not something the plugin can decide for them, and emphatically not something the plugin should claim to solve.

The only directory rule in this neighbourhood is **Guideline 9**, via the Compliance Disclaimers page:

> *"implying that a plugin can create, provide, automate, or guarantee legal compliance"*
> *"No plugin can offer 100% legal compliance… we recommend that plugins do not claim to be 100% compliant, and instead to explain that the plugin itself will assist in compliance."*

So: **cookies are a directory non-issue and a legal issue; claiming they are a legal non-issue is a directory issue.**

**Smallest change:** no architectural change. Add three things:
1. `wp_add_privacy_policy_content()` disclosing the exact cookie and localStorage keys, their purpose, and their lifetime. The Privacy handbook page asks this directly: *"Does the plugin store things in the browser? If so, where and what? Think about things like cookies, local storage, etc."* (Recommended by the handbook, not mandated by the guidelines — but it is free, and it is what a reviewer looking for good faith wants to see.)
2. A site-owner-facing filter/setting to suppress or defer the storage, so a site running a consent manager can gate it. This is the feature that makes the legal problem the site owner's to solve, which is where it belongs.
3. Keep the stored value non-identifying — a seen-flag and a timestamp, not a visitor ID.
4. Never write "GDPR compliant" in the readme. Write "helps you…". (WSMS's published readme says *"GDPR Compliant: Built with privacy and compliance in mind"* — see §5.4; that is a line to *not* copy.)

---

### 2.6 Codebase relationship — fresh repo, WSMS conventions copied, no shared code
**Status: SURVIVES. One derived obligation worth recording.**

Unaffected by any guideline directly. But it carries a **Guideline 4** consequence that is easy to miss: if WConvert ships minified JS/CSS — and a deferred front-end loader certainly will — the sources must be reachable.

> *"We require developers to provide public, maintained access to their source code and any build tools in one of the following ways: Include the source code in the deployed plugin; A link in the readme to the development location."*

FAQ: *"Can I include minified JS? Yes! However you either have to keep the non-minified in your plugin or direct people via your readme as to where they can get the non-minified files. It's fine to minify, but it's not okay to hide it."* Review Checklist: *"No minification of scripts or files unless the original files are also provided."*

If the "fresh repo" is **private**, the readme link is not available and the un-minified sources must ship inside the ZIP. Pick one deliberately and record it. Also ship `composer.json` even if it is dev-only — Common Issues asks for it specifically.

---

### 2.7 Everything else the ticket asked to confirm

| Item | Verdict | Basis |
|---|---|---|
| Leads (email/phone) stored in the site's own DB | **Permitted, no directory obligation triggered** | Guideline 7 governs contacting *external servers*. Local storage of personal data is not a directory matter. |
| …but recommended | Personal data exporter + eraser callbacks, `wp_add_privacy_policy_content()` | Privacy handbook — *"If your plugin collects personal data… Does it provide a personal data exporter? Does it provide a personal data eraser callback?"* Handbook **recommendation**, not a guideline. |
| Conversion analytics recorded **locally** | **Unaffected — confirmed** | Guideline 7 prohibits contacting external servers without consent; local-only analytics contacts nothing. No opt-in required, no disclosure required. The Review Checklist's *"No analytics or tracking by third parties"* and *"Tracking usage without explicit opt-in consent"* both concern transmission. |
| Guideline 4 (obfuscation) as it touches analytics | **Unaffected** | Nothing about local analytics implies obfuscation. Only the minification obligation in 2.6 applies. |
| "Powered by" / branding link, if planned | **Permitted only opt-in, default off** | **Guideline 10** — *"All 'Powered By' or credit displays and links included in the plugin code must be optional and default to not show on users' front-facing websites. Users must opt-in… not buried in the terms of use or documentation. Plugins may not require credit or links be displayed in order to function."* Review Checklist: *"Forward facing links (including credit links, powered by, and ads) must be optional and not active by default."* Note this is **front-end only** — admin-side links to your own site are explicitly welcomed (Guideline 11). |
| UTM links to wconvert's own site | **Permitted anywhere links are permitted** | Review Checklist: *"UTM links to a developer's site are allowed anywhere links are permitted."* |

---

## 3. Permitted

**Guideline 5 — upsells are explicitly allowed.**
> *"Attempting to upsell the user on ad-hoc products and features is acceptable, provided it falls within bounds of guideline 11 (hijacking the admin experience)."*

**Guideline 5 — the directory recommends WConvert's exact architecture.**
> *"Paid functionality in services is permitted (see guideline 6: serviceware), provided all the code inside a plugin is fully available. We recommend the use of add-on plugins, hosted outside of WordPress.org, in order to exclude the premium code."*

**Guideline 11 — admin-side links to your own site are encouraged, not merely tolerated.**
> *"Developers are welcome and encouraged to include links to their own sites or social networks, as well as locally (within the plugin) including images to enhance that experience."*

**Review Checklist — the reviewers' operative norm on upsell placement.**
> *"Upselling is permitted from plugin settings screen or a link on their entry on the plugin list page."*

**Guideline 7 — documented external data use is permitted; it is *undocumented* use that is prohibited.** The prohibition list reads:
> *"Undocumented (or poorly documented) use of external data (such as blocklists)."*

The qualifier is doing the work. Documented, disclosed external data is on the permitted side — which is what makes a disclosed Playbook fetch viable.

**Guideline 6 — SaaS is permitted, including paid.**
> *"Plugins that act as an interface to some external third party service (e.g. a video hosting site) are allowed, even for paid services. The service itself must provide functionality of substance and be clearly documented in the readme file submitted with the plugin, preferably with a link to the service's Terms of Use."*

**Common Issues — API calls back to your own server are explicitly on the permitted list.**
> *"Here are some examples of what we would permit: … API calls back to your server to process possible spam comments (like Akismet)"*

**FAQ — HTML output is fine when handled properly.**
> *"We also do not accept new plugins that allow arbitrary code insertion or execution. Examples include PHP or JavaScript editors, file managers, and AI tools that generate code intended to be executed on the site. **HTML output is permitted, provided it is properly escaped and handled securely.**"*

**FAQ — minified assets are fine with sources available.**
> *"Can I include minified JS? Yes! However you either have to keep the non-minified in your plugin or direct people via your readme as to where they can get the non-minified files."*

---

## 4. Prohibited

**Guideline 5 — locked or disabled premium code inside the free plugin.**
> *"Plugins may not contain functionality that is restricted or locked, only to be made available by payment or upgrade. Functionality may not be disabled after a trial period or quota is met. In addition, plugins that provide sandbox only access to APIs and services are also trial, or test, plugins and not permitted."*

**Guideline 9 — advertising bundled-but-locked features.**
> *"Implying users must pay to unlock included features"*

**Guideline 8 — the full text, since the ticket asked for it verbatim:**

> **8. Plugins may not send executable code via third-party systems.**
>
> *"Externally loading code from documented services is permitted, however all communication must be made as securely as possible. Executing outside code within a plugin when not acting as a service is not allowed, for example:*
> - *Serving updates or otherwise installing plugins, themes, or add-ons from servers other than WordPress.org's*
> - *Installing premium versions of the same plugin*
> - *Calling third party CDNs for reasons other than font inclusions; all non-service related JavaScript and CSS must be included locally*
> - *Using third party services to manage regularly updated lists of data, when not explicitly permitted in the service's terms of use*
> - *Using iframes to connect admin pages; APIs should be used to minimize security risks*
>
> *Management services that interact with and push software down to a site are permitted, provided the service handles the interaction on it's own domain and not within the WordPress dashboard."*

Three things to read carefully here:
- **Bullet 3 names CSS, not just JavaScript.** This is the sentence that puts remote `<style>` blocks and remote stylesheets on the prohibited side alongside remote scripts. It is the most commonly missed clause in the whole guideline.
- **Bullet 4 is about *data*, not code** — remotely-managed lists of data are restricted where the *service's own terms* don't permit it. For a first-party library (WConvert's own server, WConvert's own terms) this bullet does not bite. It bites when you proxy someone else's data.
- **The opening sentence permits remote loading from documented services.** Guideline 8 is not a blanket ban on network calls; it is a ban on *executing* what comes back.

**Common Issues — update checkers in wp.org-hosted plugins.**
> *"Please remove the checks you have in your plugin to provide for updates. We do not permit plugins to phone home to other servers for updates, as we are providing that service for you with WordPress.org hosting. One of our guidelines is that you actually use our hosting, so we need you to remove that code. We also ask that plugins not interfere with the built-in updater."*

**Guideline 6 — a licence-validation-only endpoint is not a "service".**
> *"A service that exists for the sole purpose of validating licenses or keys while all functional aspects of the plugin are included locally is not permitted."*

This is the clause that answers "can the free plugin have a license key field?" A licence field in a free plugin is only meaningful if it unlocks bundled code (→ Guideline 5) or fetches updates (→ Guideline 8). Both are prohibited; the field itself is therefore pointless at best.

**Guideline 7 — the prohibited-tracking list, verbatim:**
> *"In the interest of protecting user privacy, plugins may not contact external servers without explicit and authorized consent. This is commonly done via an 'opt in' method, requiring registration with a service or a checkbox within the plugin settings. Documentation on how any user data is collected, and used, should be included in the plugin's readme, preferably with a clearly stated privacy policy."*
> *"Some examples of prohibited tracking include: Automated collection of user data without explicit confirmation from the user; Intentionally misleading users into submitting information as a requirement for use of the plugin itself; **Offloading assets (including images and scripts) that are unrelated to a service**; Undocumented (or poorly documented) use of external data (such as blocklists); Third-party advertisement mechanisms which track usage and/or views."*

**Guideline 10 — front-end credit links on by default.** Quoted in full in §2.7.

**Review Checklist, "Not Permitted"** — includes *"Remote loading data when not absolutely necessary."* This is the sentence that makes the Playbook remote fetch a *discretionary* call rather than a settled permission. See §5.

---

## 5. Merely risky — where reviewers have discretion

### 5.1 The remote Playbook fetch itself
The guidelines permit it (Guideline 7 by implication, Guideline 6, Common Issues' Akismet example). The Review Checklist, which is what a reviewer actually works from, lists *"Remote loading data when not absolutely necessary"* under **Not Permitted**, and its Stylesheets and Scripts section says *"Include all scripts and resources locally (Exception: fonts are permitted to be remote loaded, **services may also remote load on a case by case basis**)."*

"Case by case basis" is the honest answer: **this is reviewer discretion, not a rule.** What moves the discretion in your favour:
- **Ship a complete local registry and keep it complete.** If the plugin is fully functional with the network unplugged, the fetch is an enhancement, not a dependency — and "not absolutely necessary" stops being the frame. WConvert's decision already does this, and it is the strongest single card in the hand.
- **Fetch server-side and cache.** Never from the visitor's browser. WP core's own pattern proxy documents the reason: *"This simply proxies the endpoint at http://api.wordpress.org/patterns/1.0/. That isn't necessary for functionality, but is desired for privacy. It prevents api.wordpress.org from knowing the user's IP address."*
- **Disclose it in the readme in the shape reviewers ask for.** Common Issues gives the required elements: *"Clearly explain that your plugin is relying on a 3rd party as a service and under what circumstances; Provide a link to the service; Provide a link to the service terms of use and/or privacy policies."* Review Checklist adds: *"Any remote calls (such as serviceware calling it's own servers to process spam) must be disclosed in the readme."*
- **Gate it behind an admin action, not an automatic background poll.** Browsing a template library is a user-initiated request; a cron that phones home is the thing Guideline 7 is written about.
- **Note the disclosure duty is independent of the payload.** Even if the payload is unambiguously inert data, the *call* is disclosable under Guideline 7. Answering the ticket's question directly: **yes, readme disclosure is required for the fetch regardless of what comes back.**

### 5.2 The strongest precedent available: WP core treats remote template HTML as data — and sanitizes it
Verified locally in WordPress 7.1, `wp-includes/rest-api/endpoints/class-wp-rest-pattern-directory-controller.php`:

- L117 / L130 — core fetches remote pattern HTML: `$api_url = 'http://api.wordpress.org/patterns/1.0/?' . build_query( $query_args );` then `wp_remote_get( $api_url )`.
- L199 — and runs the returned template markup through kses:
  ```php
  'content' => wp_kses_post( $raw_pattern->pattern_content ),
  ```

This is the whole answer to "where is the line between data and code" in one line of core: **remote template HTML is data, and the boundary is enforced with `wp_kses`.** Core does not trust the payload because it is first-party; it sanitizes it anyway. Copying that posture is both the safe engineering choice and the most defensible thing to point a reviewer at.

Caveat to state plainly: **core is not bound by the plugin directory guidelines.** This is design precedent and a sanitization pattern, not a permission slip.

### 5.3 Third-party precedent on wp.org
**Otter Blocks** (`otter-blocks`, wp.org-hosted) fetches a remote pattern/template library from its own server and discloses it in the published readme in one sentence:

> *"The plugin is relying on the service behind api.themeisle.com for accessing the patterns list, AI prompts and Onboarding. No account is required to access the service template collection and the privacy policy can be found [here](https://themeisle.com/privacy-policy/)."*

That is a live, currently-published, wp.org-hosted plugin doing exactly what WConvert's remote Playbook library would do, disclosed in exactly the shape Common Issues asks for. **This is the sentence to model WConvert's disclosure on.**

**Starter Templates** (`astra-sites`) is the serviceware variant — its remote template library requires a free account, disclosed as: *"Please note: To access templates and AI features, you'll need a ZipWP account. [ZipWP platform](https://zipwp.com/). Signing up is quick, easy, and 100% free."* Useful as evidence that even an account-gated remote template library clears review under Guideline 6, but WConvert should prefer Otter's no-account model — fewer moving parts, no Guideline 5 exposure.

Confidence: **high** on the pattern being allowed; **medium** on any specific implementation clearing review, because the Review Checklist reserves it as case-by-case.

### 5.4 Readme wording that invites trouble
*"GDPR Compliant: Built with privacy and compliance in mind"* appears in WSMS's published readme. Against the Compliance Disclaimers page (*"we will warn you. Then if it's not fixed in a reasonable amount of time (60 days) your plugin may be closed"*) this is a live, if low-grade, exposure. It is a precedent to **not** copy. WConvert should write "helps you…", never "compliant".

### 5.5 Plugin Check now runs automatically on every release
Since **27 October 2025**, per the Plugins Team: *"We are now running Plugin Check for ALL plugins updates, new and already approved."* Results currently go to the team internally, with a stated goal to *"deliver via email a security report to authors right after they update their plugin."* Plugin Check has been mandatory for new submissions since October 2024.

Practical consequence: machine-checkable violations — unescaped output, missing sanitization, readme validity, minified assets without sources — are now caught on **every release**, not just at submission. This raises the cost of the "we'll clean it up later" approach considerably.

### 5.6 A grey area WSMS actually has, which WConvert should not inherit
WSMS v8's free React bundle **compiles in the licence page** (`resources/react/src/pages/license/index.tsx`, a licence-key `Input` with activate/deactivate calls), and `src/Service/Assets/AssetManager.php:88` ships a `licenseNonce` to the free build with the comment *"Used by the React License page; harmless in the free build."* The *entry points* are premium-only — no menu item, no PHP AJAX handler — but `'license'` remains in `ALL_SECTIONS` in `App.tsx:54`, so a free user hitting `admin.php?page=wsms#license` lands on a licence form whose backend does not exist.

Two honest caveats: this is v8, which is **not yet the published version** (wp.org stable tag is 7.2.7; the local `readme.txt` reads `Stable tag: 8.0-beta.3`), so it is **unverified precedent — it has not passed a review**. And it is defensible: no functionality is locked and no server is contacted. But it is dead weight that reads badly, and WConvert should simply not compile licence UI into the free bundle at all.

---

## 6. WSMS precedent

Read read-only at `/Users/navidkashani/Local Sites/wsms8/app/public/wp-content/plugins/wp-sms-premium`. Nothing was modified.

### 6.1 The split is a build-time split from one repo, not two codebases
`tiers.json` declares two separate plugins with separate slugs and separate install folders:
```json
{ "free":    { "slug": "wp-sms", ... },
  "premium": { "slug": "wp-sms-premium", "tiers": [ basic, pro, elite ] } }
```

`bin/build.sh` header states the contract:
> *"Free and premium are SEPARATE plugins with separate install folders… Free ZIP: no /premium, no SDK in /packages. Premium ZIP: /premium with tier-specific module set + SDK scoped under…"*

`build_free()` (from L151) stages the tree, `rm -rf "$stage/premium"`, applies `.distignore`, runs the leak guard, then zips. `build_premium()` runs `SCOPER_PROFILE=premium composer install` — the profile that pulls the SDK in.

`composer.json` makes the SDK premium-only by scoping profile:
```json
"extra": { "wp-scoper": {
  "packages": ["firebase/php-jwt", "spomky-labs/otphp", ...],
  "profiles": { "premium": { "packages": ["veronalabs/wp-premium-sdk"] } } } }
```

**The relevant WConvert lesson:** this is a monorepo with a build-time split, whereas WConvert has decided on a fresh repo with no shared release cycle. Both clear the guidelines — what matters is only that the *artifact uploaded to wp.org* contains no premium code. WConvert's separate-repo approach makes that easier, not harder.

### 6.2 The leak guard — the part most worth copying
`bin/verify-free-contract.sh`, wired into `build_free` before zipping. Its own header states the rule in guideline terms:

> *"The hard rule (WP.org Guideline 5 + business rule): the free build must compile and ship without premium source on disk. This catches a stray premium import, a forgotten strip, or a stale premium bundle re-leaking premium code into the free zip."*

Seven checks, of which four map straight onto WConvert's needs:
1. No `/premium` directory.
2. No premium dashboard bundle (`public/app-premium`).
3. **No scoped SDK** — `[ -d "$TREE/packages/veronalabs" ] && fail`. This is the mechanical enforcement of §2.1.
4. No premium PHP namespace *used* in shipped code — delegated to a PHP tokenizer (`bin/premium-ns-scan.php`) rather than grep, so prose in comments doesn't false-positive but a namespace in a string literal still fails.
7. **Drift-proof import invariant** — the free React source must not import any `premium/` path, so Vite structurally cannot bundle premium code.

Check 7's comment also documents the free-upsell carve-out, which is precisely the WConvert "Playbook degradation" shape:
> *"the free upsell UI (premium-feature-lock, premium-gateways-upsell) is a legit FREE path with a `premium-` prefix (hyphen), never a `premium/` directory segment."*

**Recommendation: build this for WConvert on day one, not after the first rejection.** It is ~150 lines and it converts "we must remember not to ship premium code" into a build failure.

### 6.3 The upsell component — the doctrine, written down in the code
`resources/react/src/components/ui/premium-feature-lock.tsx`, docblock verbatim:

> *"Inline upsell placeholder shown where a premium feature would appear in the free build. It is a marketing description that links out to the upgrade page — **never a disabled-but-real control** — so the free editor stays fully functional without it (WordPress.org Guidelines 5 & 11)."*

Implementation matches: a bordered panel, a title, a description, and an `<a href="https://wsms.io/pricing/" target="_blank" rel="noopener noreferrer">` CTA. No form control is rendered and disabled. Default copy: `'Premium feature'` / `'This feature is available in WSMS Premium.'` / `'Go Premium'`.

**"A marketing description that links out, never a disabled-but-real control" is the sentence to lift verbatim into the WConvert map** as the rule governing Playbook degradation (§2.3).

A companion component makes the same seam honest in the other direction — `premium-feature-unavailable.tsx`:
> *"Deliberately NOT the upsell: the user already paid, so selling them what they own — the bug this replaces — would be wrong."*

And `resources/react/src/lib/premium-gateways-upsell.ts` shows the copy discipline: it names *brands* (`Twilio`, `Vonage`, `Infobip`, `MessageBird`) and *channels*, deliberately not module slugs — *"copy-only data — it names nothing the seam keeps server-side."*

### 6.4 Licence UI and update checking are premium-only
All licence and SDK code lives under `premium/`:
- `premium/src/Service/Admin/LicenseMenu.php` — *"Adds a 'License' submenu under the WSMS admin menu (**premium builds only**)."*
- `premium/src/Service/Admin/Notices.php` — licence-status admin notice, premium-only, and explicitly *"hidden on the dashboard/license page itself, where the full license UI already lives"* (i.e. no double-nagging — good Guideline 11 hygiene).
- `premium/src/Service/License/` — `LicenseRefreshScheduler`, `LicenseUrls`, `LicenseMessages`, `TierGate`, and the initial-data providers.

Grepping the free tree `src/` for licence code returns **one** file — `AssetManager.php`, and only to emit a nonce. **There is no update-checker hook and no licence-activation endpoint anywhere in the free build.** That is the compliant answer to §2.1, and it is what WConvert should mirror.

### 6.5 readme.txt — what it discloses, and what it doesn't
**There is no `== External Services ==` section in either the published (7.2.7) or the local v8 readme.** The disclosure duty is largely not engaged: SMS gateways are user-configured with user-supplied credentials, which Guideline 7's SaaS exception covers — *"By installing, activating, registering, and configuring plugins that utilize those services, consent is granted for those systems."*

**WConvert cannot rely on that.** A Playbook library fetch is *not* user-configured with user-supplied credentials; it is the plugin calling the vendor's server on its own initiative. That is squarely the disclosable case, and WConvert will need the section WSMS doesn't have. Model it on Otter's sentence (§5.3).

What the readme does do well — the Guideline 4 disclosure, verbatim:
> *"== Source Code and Build Instructions ==*
> ***Note:** The plugin works out of the box — no build steps required for regular users. This section is for developers who want to modify or contribute to the source code…*
> *All source code for minified JavaScript and CSS is included in the plugin under the `resources/` directory. Build instructions and full source are available on [GitHub](https://github.com/wp-sms/wp-sms).*
> *= Third-Party Libraries = [Chart.js]…, [flatpickr]…, [React]…, [Tailwind CSS]…"*

Both permitted routes are covered at once (sources in the ZIP *and* a link to the development location), plus a third-party library inventory. **Copy this section's structure wholesale.**

⚠️ **One inconsistency in WSMS v8 worth not inheriting.** The readme says sources are *"included in the plugin under the `resources/` directory"*, but v8's `.distignore` strips it:
```
# Source Files (only built files needed)
/resources
```
I verified the **currently published** 7.2.7 trunk on SVN does ship `resources/`, so the claim is true today. In v8 it will not be. WSMS stays compliant either way via the GitHub link (Guideline 4 permits *"A link in the readme to the development location"*), but the sentence will be inaccurate. If WConvert copies this readme section, make the sentence match what the build actually ships.

Also note the readme's `== Upgrade to WSMS All-in-One ==` section — a plain feature list plus one pricing link. Guideline 12 concerns readme *spam* (affiliate links, competitor tags, >5 tags, keyword stuffing); a straightforward premium feature list with a first-party link is not that. WConvert can do the same.

### 6.6 `.distignore` — what a compliant free ZIP excludes
Excludes `/.git`, `/.github`, `/bin`, `/node_modules`, `/tests`, `/vendor`, `composer.json`, `composer.lock`, `/dist`, `/docs`, `README.md`, `.env`, PHPStan config, Vite/ESLint config, `/.claude`, `CLAUDE.md`, `AGENTS.md`, and `tiers.json`.

This directly serves Common Issues' *"Included Unneeded Folders"* (development tools, vendor folders, demos, unit tests). ⚠️ **One divergence from the guidance:** WSMS excludes `composer.json`, but Common Issues explicitly asks for it — *"we would like to ask you to include that file in your plugin, even if it is only used for development purposes."* WConvert should keep `composer.json` in the ZIP.

---

## 7. Sources

All fetched **2026-08-23**. Primary sources unless noted.

**WordPress.org official guidelines and handbook**
- [Detailed Plugin Guidelines](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/) — body banner `Last Updated: March 15, 2024`; page metadata `Last updated March 11, 2026`. Full text of Guidelines 1–18 retrieved raw and quoted verbatim above.
- [Common issues](https://developer.wordpress.org/plugins/wordpress-org/common-issues/) — `First published August 3, 2024`, `Last updated March 20, 2026`. Source for the Update checker, Undocumented 3rd party, premium-source, and minified-source rules.
- [Plugin Developer FAQ](https://developer.wordpress.org/plugins/wordpress-org/plugin-developer-faq/) — `Last Updated: 30 June 2026`. Source for minified JS, arbitrary code execution, and what is not accepted.
- [Review Checklist](https://make.wordpress.org/plugins/handbook/performing-reviews/review-checklist/) — `First published November 1, 2016`, `Last updated January 24, 2024`. The reviewers' own working document; source for the upsell-placement norm and "Remote loading data when not absolutely necessary".
- [Block Specific Plugin Guidelines](https://developer.wordpress.org/plugins/wordpress-org/block-specific-plugin-guidelines/) — `Last updated May 4, 2025`. Confirms block-plugin rules are stricter and do **not** apply to WConvert (not a single-block plugin).
- [Compliance Disclaimers](https://developer.wordpress.org/plugins/wordpress-org/compliance-disclaimers/) — `First published April 12, 2018`. Guideline 9's legal-compliance-claim prohibition.
- [Privacy](https://developer.wordpress.org/plugins/privacy/) — `Last updated December 14, 2023`. Handbook **recommendations** (not guidelines) on browser storage, exporters, erasers, `wp_add_privacy_policy_content`.
- [Alerts and Warnings](https://developer.wordpress.org/plugins/wordpress-org/alerts-and-warnings/) — `Last updated August 19, 2019`. Plugin-closure reasons.

**Plugins Team posts (primary, dated)**
- [Guideline Update: Clarifications to trialware and human readability](https://make.wordpress.org/plugins/2018/08/23/guideline-update-clarifications-to-trialware-and-human-readability/) — 2018-08-23. The authoritative statement of *why* Guideline 5 exists and the Akismet carve-out.
- [Proposal to Modify Plugin Guidelines](https://make.wordpress.org/plugins/2019/05/14/proposal-to-modify-plugin-guidelines/) — 2019-05-14. ⚠️ **A proposal, not adopted text.** It floated "one advertisement per common page" and "permanently dismissible"; the live Guideline 11 contains neither. Cited only to mark that the stricter wording circulating in blog write-ups is **not** the rule.
- [Plugin Check plugin now creates automatic security reports](https://make.wordpress.org/plugins/2025/10/29/plugin-check-plugin-now-creates-automatic-security-reports-update/) — 2025-10-29.
- [Plugin Check and 2FA Now Mandatory For New Plugin Submissions](https://make.wordpress.org/plugins/2024/10/01/plugin-check-and-2fa-now-mandatory-for-new-plugin-submissions/) — 2024-10-01.
- [#guidelines tag archive](https://make.wordpress.org/plugins/tag/guidelines/) — enumerated to confirm **no guideline-change announcement after 2023-03-21**.
- [Make/Plugins front page](https://make.wordpress.org/plugins/) — enumerated 2024–2026 posts; none affect freemium, upsell, or remote-data rules.

**Published plugin readmes (primary artifacts, via plugins.svn.wordpress.org)**
- `https://plugins.svn.wordpress.org/otter-blocks/trunk/readme.txt` — the remote-pattern-library disclosure sentence quoted in §5.3.
- `https://plugins.svn.wordpress.org/astra-sites/trunk/readme.txt` — account-gated remote template library (ZipWP).
- `https://plugins.svn.wordpress.org/wp-sms/trunk/readme.txt` — WSMS as published (stable tag 7.2.7).
- `https://plugins.svn.wordpress.org/wp-sms/trunk/` — directory listing; confirms `resources/` ships in the published free plugin.

**WordPress core, read locally (WP 7.1)**
- `/Users/navidkashani/Local Sites/wconvert/app/public/wp-includes/rest-api/endpoints/class-wp-rest-pattern-directory-controller.php` — L13–14 (privacy proxy rationale), L117/L130 (remote fetch), L199 (`wp_kses_post()` on remote pattern content).
- `/Users/navidkashani/Local Sites/wconvert/app/public/wp-includes/kses.php` — verified `$allowedposttags` (array literal at `kses.php:68`, 98 tags) excludes `script`, `style`, `iframe` **and** `form`, `input`, `select`; `button`, `textarea` and `label` are present.

**WSMS codebase, read-only** (`/Users/navidkashani/Local Sites/wsms8/app/public/wp-content/plugins/wp-sms-premium`)
- `readme.txt`, `.distignore`, `composer.json`, `tiers.json`
- `bin/build.sh`, `bin/verify-free-contract.sh`, `bin/premium-ns-scan.php`
- `resources/react/src/components/ui/premium-feature-lock.tsx`, `premium-feature-unavailable.tsx`
- `resources/react/src/lib/premium-gateways-upsell.ts`
- `resources/react/src/App.tsx`, `resources/react/src/pages/license/index.tsx`
- `src/Service/Assets/AssetManager.php`, `src/Service/Admin/AdminManager.php`
- `premium/src/Service/Admin/LicenseMenu.php`, `premium/src/Service/Admin/Notices.php`, `premium/src/Service/License/*`

**Secondary sources:** none relied on. Every claim above traces to a wordpress.org handbook page, a Plugins Team post, a published readme artifact, WordPress core source, or the WSMS codebase.

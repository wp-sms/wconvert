# Hosted picker and illustrated premium release — 19 October 2026

The plugin now defaults to `https://templates.wconvert.io/manifest.json` when no catalogue option exists. The new `fabric-sample-enquiries` v1.0.0 pack is published. No existing templates, campaigns, designs or licence activations were replaced.

## Published catalogue

Release: `7a6c87a5c2b8d70a9e068420dd9b003a0e5f586344e707a874de0c321c687c59`.
Previous release retained: `b956f0d012399019d72341b4752cfd24e3fa6b7484f4d85f26e0c5c4ee9a7858`.
Six packs: four Free, two premium; 23 campaign setups, 20 designs, three complete hosted collections. The existing five packs keep their versions and bytes. A new pack, protected PNG and preview were added; Help shoppers choose now also offers the sample enquiry. Local compilation reused 11 immutable objects; remote promotion reused 19 public objects, created three, and checked three private objects. Manifest promotion/read-back succeeded.

[Public fabric preview](https://templates.wconvert.io/previews/1651588b136a96b43bf113420c87f0d494b02e11747ec4963ec2ab0fcb8940c8.html).

## Actual checks

- New-install default status is configured without a request. A check fetches the hosted manifest. Explicit empty disables; a custom source invalidates the prior cache. Pro's credential recipient stays separately pinned; a custom catalogue cannot receive the key. These boundaries have regression tests.
- Rebuilt Free and Pro assets. Full PHP: 3,370 tests / 19,181 assertions. Full JavaScript: 254 files / 4,474 tests. Server runtime: 40 tests. Studio: 38 tests. Template registration, source boundaries and current collection gate passed. PHPStan passed after adding explicit transport-type assertions to the new regression test. Final transport rerun: 14 tests / 78 assertions.
- Real HTTPS read-only service verifier: six public previews, four Free packs, two anonymous premium refusals, one public image. Every returned hash checked.
- Disposable WordPress 7.1.3 / PHP 8.1.34, **no endpoint constant or catalogue option override**: four Free packs installed, 13 designs / 16 setups / one image; two premium refusals; offline refresh fails safely and installed previews remain available. No licence sent for public reads.
- Real WordPress → Worker → Nexus premium acceptance: temporary test site activated; Fabric sample enquiries downloaded with one design, one setup and one protected PNG. No WooCommerce installed. SDK canonical site identity and header-only licence placement checked. Image bytes/hash verified, template hydrated with the site's local image URL, no remote premium URL retained. Installed preview succeeds with HTTP deliberately unavailable and no new grant request.
- Live image boundary checks: anonymous GET/HEAD 401; correct pass GET/HEAD 200; a public path alias 404; an unrelated image with the pass 403. Pack bytes and image bytes match their manifests. Wrong site and wrong resource refused. After natural five-minute expiry both pack and image return 401. This is actual elapsed expiry, not a changed clock.
- Local filesystem rehearsal with explicit premium fixtures and WooCommerce: all six packs installed (20 designs / 23 setups / three collections). Both illustrated packs passed copy-only update, unchanged-image reuse, retained original snapshot and offline checks. The fixture path does not authorize production requests.
- Temporary site activation removed. A new grant after deactivation returns `domain_not_allowed` / 403. Only that disposable activation was changed; the licence itself was not expired/revoked. Temporary local licence file deleted. No key or signed pass is committed.

## Output inspection

The desktop/320px campaign review, normal/RTL/long-copy inspection, required-field/failure/retry and actual local Lead captures are in `fabric-sample-review-2026-10-19.md`. The public live PNG preview and acknowledgement were also visually inspected after publishing. Fine-pointer close-target findings in the generic size checker are explained in the editorial report; there are no contrast or horizontal-overflow findings.

Your `wconvert.local` browser session had expired. UI verification therefore used a fresh disposable WordPress with no catalogue setup. Goal-first creation offered Template packs immediately. Check for packs loaded all six. The unlicensed premium request gave an actionable licence message. Free Homeware preview/install changed to Installed. The editor's shared Template packs surface showed that same installed pack; no campaign edit was saved or published through that flow. Screenshots: `fabric-samples-2026-10-19/picker-default.png`, `editor-packs.png`, `live-preview-mobile.png`, `live-preview-success.png`.

## Before customer launch

The connection and illustrated download path work. Still required: publish/link service terms and privacy notice, configure/verify edge limits and bucket/lifecycle settings with an account administrator, rehearse backup restoration, and test whole-licence expiry/revocation using dedicated disposable licences. Current operator-only upload credentials cannot audit those account settings. External campaign email/SMS delivery and CI were skipped as requested. Physical-device testing and conversion performance are not claimed. Code changes are on a branch; this task does not merge them.

## PR #299 merge review — 19 October 2026

Separate spec and standards reviewers inspected `7f679a1e` against `a163fa51`.
Neither found a blocking implementation issue. The standards review requested the
release ZIP check and identified ambiguous historical rehearsal counts in the server
README; those counts are now explicitly historical.

Fresh merge checks passed: full PHP (3,370 tests / 19,182 assertions), studio
(38 tests), six current collection approvals, live public service verification
(four Free packs, six previews, two premium refusals), and disposable WordPress
7.1.3 / PHP 8.1.34 installation from the default HTTPS source, including image
verification and offline recovery. The native desktop and 320px screenshots were
inspected again. `bash bin/build.sh all` completed successfully: both Free and Pro
ZIPs passed their artifact contracts. The earlier full JavaScript and licensed
acceptance results above remain applicable; this review changes documentation only.
CI is intentionally skipped at the user's request. This merge review does not
remove the customer-launch tasks listed above or claim they have been tested.

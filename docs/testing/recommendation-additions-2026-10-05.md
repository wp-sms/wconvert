# Recommendation additions: local verification

5 October 2026. Implements [ADR 0121](../adr/0121-recommendation-additions-count-server-accepted-cart-actions.md).
This is local engineering verification, not a public release or merchant usability study.

## Passed

- Full PHP suite: 2,544 tests, 15,651 assertions.
- Full JavaScript suite with two workers: 211 files, 3,764 tests. An earlier
  unrestricted run was stopped after machine contention caused timeouts;
  the complete bounded run passed. Existing React act/navigation warnings remain.
- After the final stable-card/pending-control polish: 14 focused commerce tests passed.
- TypeScript, ESLint, PHPStan, template vocabulary validation (104 designs), source
  contract and complete Free/Pro asset build passed.
- Loader budgets: Free 14,572; Basic 25,052; Pro 26,627; Elite 27,026 gzip bytes.
  Commerce is 4,711 bytes against its explicit 4,800-byte budget. ADR 0121 records
  the small shared-loader allowances and the optional commerce increase.
- Initial disposable WordPress / WooCommerce 11.1.2 run:
  `check-products.mjs` passed 21 checks and `check-additions.mjs` passed 14 grouped
  checks. Both guest and authenticated sessions were exercised.
  The command requested WordPress 7.1.2 / PHP 8.3, but did not assert the runtime.
  Subsequent release checks found that explicit blueprint versions are necessary;
  see the verified runtime matrix in the release-candidate report below.
- Fresh session protection, origin/session/token rejection, stale revisions,
  unpublished campaigns, main/private/draft/sold-out/variable/unknown product
  refusals, stale price fingerprint, actual persisted quantity one, replay without
  another mutation/count, two additions with one headline, extension fallback,
  suppression without any direct-add candidate and forged public beacon rejection.
- Unit/browser logic tests cover pending activation, no automatic retry after lost
  responses, explicit pre-mutation refusal, supporting links without conversion,
  late response after close, stable cards during refresh, native refresh without
  the drawer-opening event, separate dashboard impact groups and activity totals.
- Final receipt lifecycle check: cleanup works with WooCommerce skipped and leaves
  unrelated option keys untouched. Pro uninstall removes only owned receipts and
  their scheduled cleanup. Privacy guidance now describes those temporary records.
  The 33 related PHP tests, PHPStan and source contract passed after this change.

## Actual local browser checks

On Twenty Twenty-Five / WooCommerce 11.1.2 at `wconvert.local`:

- Created a separate **Demo · Add coffee extras** campaign. Original link campaign
  and history remain intact. The demo brewer's manual campaign block now selects
  the new campaign; the previous template content is backed up in a local option.
- Keyboard focus reaches Add to cart; Enter adds exactly one filter/brush. Added
  confirmation and focus remain visible, and the native mini-cart count updates
  without opening its drawer. Native Cart confirmed quantities and $15/$8 prices.
- Found and fixed transient card expansion during refresh and the stale modern
  mini-cart badge. Newer WooCommerce uses an interactivity store, not only wp.data.
- Removed all items added by this verification and confirmed the basket is empty.
  [Final desktop demo](../reviews/recommendations-2026-10-05/addition-desktop.png).
- The new Goal and **Add useful extras** setup are reachable in campaign creation.
  Inspected the setup's complete desktop/mobile previews without creating another
  draft. Editor previews remain inert.
- Visually checked the actual campaign in a temporary 320-pixel container, including
  keyboard addition and its success/link wrapping. Restored its original layout.
  See [narrow success](../reviews/recommendations-2026-10-05/addition-320-container.png)
  and [mobile setup preview](../reviews/recommendations-2026-10-05/addition-setup-mobile.png).
- The browser viewport override did not resize the background storefront tab
  (it remained 1280×720), so the narrow-container and built-in mobile preview checks
  are not claimed as a full new phone/device test. Previous link-slice phone checks
  remain historical evidence only.

## Original release gate, now resolved

`bash bin/build.sh all` stopped at `templates:collections:check`: the shared
renderer change makes existing setup/collection review revisions stale.
The missing new-design history baseline was recorded through `templates:record`,
but existing editorial approvals have not been relabelled as fresh reviews.
At that point, affected library reviews and collection snapshots needed renewal
before packaging. The ZIPs then present in dist predated this slice.

Update: the subsequent [release-candidate review](../reviews/recommendations-rc-2026-10-05/release-checklist.md)
renews the 18 affected collection setups and five collections, regenerates their
snapshots, and builds new packages. The paragraph above records the earlier block;
use the candidate's checksum manifest to identify the new artifacts.

Further release work: broader theme/extension compatibility, physical phone and
assistive-technology checks, upgrade/rollback rehearsal and merchant walkthroughs.
The Woo interactivity sync event is version-sensitive; retest it on supported Woo
versions. Operation claims prevent WConvert replays, not competing cart writes by
unrelated plugins. There is no exactly-once or conversion-uplift claim.

Reports retain the existing completed-day window. Today's local test additions
are stored today and enter the standard report window tomorrow.

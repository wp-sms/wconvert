# Privacy guidance reports the current data flow

Privacy guidance is useful only when it describes the install in front of the
merchant. WConvert therefore derives one read-only Data Map from saved
retention and configured [[Destination]]s, then presents those facts in both
Data & privacy and WordPress's suggested privacy-policy text.

This completes [ADR 0018](0018-erasure-deletes-rather-than-anonymises.md) and
amends [ADR 0091](0091-shared-settings-and-submission-workflows-have-distinct-homes.md).

## Facts and wording remain separate

The Data Map reports only what WConvert can prove: the saved Retention Period,
configured destination types and declared/mapped fields, browser campaign
state, and the anonymous-count rate-limit lifetime. It never returns connection
credentials or provider settings. A configured destination whose implementation
is currently unavailable remains visible with unknown fields; missing code does
not make a configured data flow disappear.

The REST representation is available only to administrators with
`manage_options`. The admin translates it into merchant guidance. PolicyText
translates the same facts into visitor-facing suggested wording. Internal route
names stay out of the policy suggestion because they are operational labels,
while configured service types are named because they may receive a copy.

The policy suggestion follows WordPress's own reader questions rather than
printing one undifferentiated block: information collected and why, browser
storage and statistics, recipients, retention, and rights. A
`privacy-policy-tutorial` note tells the merchant to add the purpose/legal basis,
privacy contact, provider notices and transfer safeguards that WConvert cannot
determine; WordPress omits that note when the suggested text is copied. The
visitor-facing recipient list groups configured routes by service and names the
declared fields without exposing internal route labels.

## Guidance is not an automated compliance claim

WConvert does not select a legal basis, decide whether a purpose is necessary,
publish or edit the site's policy, verify a requester's identity, or promise
deletion from systems it does not control. WordPress presents plugin policy
content as a guide for the site owner to review. Destination copies, CSV files,
email logs and backups therefore remain an explicit separate checklist.

The guidance accurately distinguishes three storage boundaries:

- retained Lead fields and consent wording in WConvert;
- browser-local display/dismissal/conversion/A/B state, with no contact details
  or WConvert-generated visitor identifier; local storage has no set expiry,
  while the same-name fallback cookie lasts up to one year; and
- a site-specific one-way network-address hash kept for the short anonymous
  counting rate-limit window, while the raw network address is not stored.

## Settings follows the existing interface grammar

“Your data flow” is a normal Data & privacy region between retention and the
existing export/request actions. It uses the shared region header, loading,
failure, warning, typography and responsive layout patterns. Loading never
looks like an empty configuration. Indefinite retention receives a warning;
finite retention is stated without manufacturing a warning. The screen is
read-only and links to the existing owners for destination setup and request
work rather than creating another compliance dashboard.

## Consequences

- Changing retention or destination configuration changes the next admin read
  and the next policy-guide registration without adding storage or a schema.
- The guide describes only configured destinations, not every integration that
  could be installed.
- Unknown destination types remain reviewable without guessing their fields.
- No new legal conclusion, consent mechanism, request log or downstream erasure
  lifecycle is introduced.

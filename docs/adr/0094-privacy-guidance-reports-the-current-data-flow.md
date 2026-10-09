# Privacy guidance reports the current data flow

Privacy guidance is useful only when it describes the install in front of the
merchant. WConvert therefore derives one read-only Data Map from saved
retention and configured [[Destination]]s, then presents those facts in both
Data & privacy and WordPress's suggested privacy-policy text.

This completes [ADR 0018](0018-erasure-deletes-rather-than-anonymises.md) and
amends [ADR 0091](0091-shared-settings-and-submission-workflows-have-distinct-homes.md).

The factual Data Map remains read-only. [ADR 0096](0096-privacy-authoring-help-is-progressive-and-snapshotted.md)
adds a separate preference for privacy help while authoring new Campaigns.


**Extended by [ADR 0117](0117-cart-intelligence-uses-a-bounded-session-projection.md):** The Data Map and suggested policy text describe the rich session projection, document-memory lifetime and separate 60-second hashed-IP rate bucket alongside the legacy cart cookie.

## Facts and wording remain separate

The Data Map reports only what WConvert can prove: the saved Retention Period,
configured destination types and declared/mapped fields, browser campaign
state, and the anonymous-count and form-protection rate-limit lifetimes. Pro
modules extend the same map only when this install can actually use them: A/B
assignment state, and a WooCommerce-session cart-recovery cookie holding count
and total but no product or contact details. It never returns connection
credentials or provider settings. A configured destination whose implementation
is currently unavailable remains visible with unknown fields; missing code does
not make a configured data flow disappear.

**Extended by [ADR 0111](0111-spam-protection-precedes-capture.md):** the map
also names the configured bot-verification provider and the resource-email
guard's ten-minute active window. Browser/network information goes to the
verification provider; WConvert forwards only its verification token and
required credentials, never the form's contact fields. The map exposes no
keys. Suggested policy text discloses these checks and no longer claims the
site makes no automated decisions.

**Extended by [ADR 0106](0106-question-journeys-extend-the-paid-loader.md):** paid question answers stay in page memory unless a visitor explicitly submits contact details, when the submitted answers join the Lead snapshot and its export/erasure path. Product recommendations read only merchant-selected IDs from the public WooCommerce Store API; aggregate completions and clicks contain no individual answer set.

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

The guidance accurately distinguishes these storage boundaries:

- retained Lead fields and consent wording in WConvert;
- browser-local display/dismissal/conversion state and, only when supplied, A/B
  assignment state; local storage has no set expiry, while the same-name
  fallback cookie lasts up to one year;
- the optional cart-recovery cookie, when available, holding only cart count
  and total until the WooCommerce session ends; and
- a site-specific one-way network-address hash kept for the short anonymous
  counting rate-limit window, plus a separate address-and-Campaign hash kept
  for the fixed form-protection window, while the raw address is not stored.

## Settings follows the existing interface grammar

“Where visitor data goes” is a standard Settings disclosure between retention
and the existing export/request actions. Its closed summary names the covered
locations, and the details stay closed by default because they are occasional
reference material rather than the page's primary task. A read failure opens
the disclosure so the problem and recovery are not hidden.

The expanded content uses the shared loading, failure, warning, typography and
responsive layout patterns. Its brief merchant copy names locations and
responsibilities directly: saved in WConvert, saved in the visitor's browser,
anonymous campaign totals, sent to other services, and copies the merchant must
manage separately. Browser storage and server-side anonymous totals stay in
separate sections because they have different locations and lifetimes. Loading
never looks like an empty configuration. Indefinite retention receives a
warning; finite retention is stated without manufacturing a warning. The
screen is read-only and links to the existing owners for destination setup and
request work rather than creating another compliance dashboard.

*Amended by [ADR 0131](0131-one-way-to-show-each-thing-in-the-admin.md): the
disclosure and its sections of paragraphs are gone. The region "What visitor
data is stored" is always open and is a table — what is stored (with where),
why, how long — one row per record this install can prove, followed by a
"Sent to other services" table (destinations, analytics, bot verification) and
the separate-copies sentence. The fine print (cookie fallback, eviction,
blocked storage, add-on notes) sits in a closed inline disclosure. A failed
read keeps the region's title and offers "Try again". Indefinite retention is
stated in the table rather than drawn as a warning, and no stored key, raw
field key or provider key reaches the screen.*

## Consequences

- Changing retention or destination configuration changes the next admin read
  and the next policy-guide registration without adding storage or a schema.
- The guide describes only configured destinations, not every integration that
  could be installed.
- Unknown destination types remain reviewable without guessing their fields.
- Safety boundaries such as body/field limits, diagnostic redaction and the
  generous capture limiter are defaults rather than privacy toggles; disabling
  them would reintroduce avoidable exposure without simplifying the interface.
- No new legal conclusion, consent mechanism, request log or downstream erasure
  lifecycle is introduced.

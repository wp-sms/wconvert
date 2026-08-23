# Consent, privacy and retention

Type: grilling
Status: open

## Question

What is WConvert's consent, privacy, and data-retention model?

This is the area most often deferred and most expensive to retrofit, and
WConvert has an unusual shape: it stores personal data (Leads) *and* sets
per-visitor client-side state (seen/dismissed/session counts) *and* ships to the
EU via wp.org.

Open:

- **Does WConvert do double opt-in, or delegate it?** WSMS already has
  `doubleOptin` and `optinChannel` on its subscription forms. Doing it in
  WConvert means owning a confirmation lifecycle — which looks a lot like giving
  a Lead a lifecycle, and `CONTEXT.md` says that is the drift signal. Delegating
  it means the Standalone install has no double opt-in at all.
- Consent capture: checkbox, consent text, privacy-policy link, and what is
  recorded alongside the Lead as proof (timestamp, IP, text version?).
- **Client-side visitor state.** Frequency capping needs cookies or localStorage.
  Under GDPR/ePrivacy, which of these are legitimately "strictly necessary" and
  which need consent? Does WConvert integrate with consent-management plugins,
  and what does it do before consent is given?
- Retention: how long Leads live, whether pruning is automatic, and what the
  default is.
- WordPress's privacy tooling — personal data export and erasure hooks. Cheap to
  implement, and their absence is a wp.org review risk.
- IP storage and geo targeting: geo (premium) implies IP handling. Decide where
  that happens and whether anything is stored.

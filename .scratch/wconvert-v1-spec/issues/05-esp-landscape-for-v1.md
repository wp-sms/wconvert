# ESP landscape for v1

Type: research
Status: claimed

## Question

Which third-party Destinations ship in v1, and what do their APIs demand of the
Destination contract?

Premium gating is already decided (third-party ESPs are premium; WSMS is free),
so this is about *which* and *what shape*, not whether.

Candidates to assess: Mailchimp, Klaviyo, ConvertKit/Kit, Brevo, ActiveCampaign,
MailerLite, HubSpot, and a generic Webhook. Note that WSMS already integrates
EmailOctopus and Mailtrap — worth knowing why those, since the same reasoning
may or may not transfer.

For each candidate, establish:

- Market share among WordPress site owners specifically — this is the primary
  ranking signal, not general popularity.
- Auth model: API key vs. OAuth. OAuth means a callback URL, token storage and
  refresh, and possibly an app-review process — a materially larger build than a
  pasted key, and it changes the settings UI.
- The add-a-contact-to-a-list call: endpoint, required fields, whether lists or
  tags or both, and whether custom fields need discovery.
- Rate limits and whether they force async pushing.
- Double opt-in behaviour — several ESPs own this, which bears directly on
  *Consent, privacy and retention*.
- Any that offer a WordPress-native path worth preferring over raw HTTP.

Deliver a ranked shortlist with a recommended v1 set, plus the specific
constraints the *Destination contract* must accommodate (the OAuth ones and the
rate-limited ones are what shape it).

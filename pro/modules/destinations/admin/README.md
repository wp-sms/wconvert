# Provider marks

`mailchimp.svg` is Mailchimp's own mask icon (Freddie), served from
https://mailchimp.com/release/plums/a9c5b58dea3269f6.svg.
`brevo.svg` is Brevo's own site icon, served from
https://corp-backend.brevo.com/wp-content/uploads/2025/07/Brevo_logo.svg.
Retrieved 2026-09-29. Both files are unchanged and shown next to the provider
name, only to identify the integration.

They live with the module that registers the two destination types, and
`marks.ts` hands them to free's `providerMarks` slot from Pro's admin entry, so
the free ZIP carries no third-party logo. A provider without a mark keeps the
Lucide fallback.

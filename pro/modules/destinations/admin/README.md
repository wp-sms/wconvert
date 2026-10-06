# Provider marks

`mailchimp.svg` is Mailchimp's own mask icon (Freddie), served from
https://mailchimp.com/release/plums/a9c5b58dea3269f6.svg.
`brevo.svg` is Brevo's own site icon, served from
https://corp-backend.brevo.com/wp-content/uploads/2025/07/Brevo_logo.svg.
Retrieved 2026-09-29. Both files are unchanged and shown next to the provider
name, only to identify the integration.

`mailtrap.svg` is the symbol from Mailtrap's own square logo on its brand site,
served from https://brand.mailtrap.io/assets/logo-square-light-BDKVmA8L.svg.
Retrieved 2026-10-06. The wordmark path is removed and the `viewBox` cropped to
the symbol; the symbol's paths and colours are unchanged. Mailtrap publishes no
icon-only SVG for light backgrounds.

They live with the module that registers the three destination types, and
`marks.ts` hands them to free's `providerMarks` slot from Pro's admin entry, so
the free ZIP carries no third-party logo. A provider without a mark keeps the
Lucide fallback.

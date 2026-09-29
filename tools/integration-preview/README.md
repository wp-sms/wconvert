# Integration mapping preview

Run `npx vite --config tools/integration-preview/vite.config.mjs` from the repository root and open <http://127.0.0.1:5195/>.

This isolated page renders the real campaign `ExtraAnswerMapping` control with sample Mailchimp fields. It shows where account and audience setup ends and campaign question mapping begins, without a provider key or WordPress database. All field discovery and data preview responses come from `mock-api.ts`; a test-send attempt is refused. It does not verify provider API behavior or actual delivery.

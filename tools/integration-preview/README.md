# Integration mapping preview

Run `npx vite --config tools/integration-preview/vite.config.mjs` from the repository root and open <http://127.0.0.1:5195/>.

This isolated page renders the real campaign `ExtraAnswerMapping` control with sample Mailchimp fields. It shows where account and audience setup ends and campaign question mapping begins, without a provider key or WordPress database. All field discovery and data preview responses come from `mock-api.ts`; a test-send attempt is refused. It does not verify provider API behavior or actual delivery.

The scenario selector covers partially mapped and unmapped answers, a deleted target field, no compatible fields, a recoverable metadata error, and an unsupported service. The error scenario recovers with **Retry loading fields**. The shared mapping control stacks its rows in narrow containers. Sample previews omit blank answers, matching the real preview endpoint; test sends remain refused.

The source-to-destination pairing follows the familiar field-matching pattern documented by [WPForms](https://wpforms.com/how-to-create-a-mailchimp-subscribe-form-in-wordpress/) and [Zapier](https://help.zapier.com/hc/en-us/articles/8496343026701-Send-data-between-steps-by-mapping-fields). WConvert keeps supported contact fields automatic and limits this optional UI to extra answers. Layout and recovery copy follow ADRs 0039, 0042 and 0097.

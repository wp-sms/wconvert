<?php

namespace WConvert\Rest;

use WConvert\Lead\CaptureForm;
use WConvert\Lead\LeadCapture;
use WConvert\Lead\Refusal;
use WConvert\Lead\RefusalCode;
use WConvert\Optin\PublishedOptin;
use WConvert\Optin\PublishedSet;
use WConvert\Template\PolicyLink;
use WConvert\Template\TemplateVocabulary;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * The capture endpoint: a visitor submits, and a [[Lead]] lands in the log —
 * or is refused on screen while they are still there to fix it.
 *
 * **This is the one public route WConvert exposes**, and it is public by
 * nature rather than by omission: the visitor filling in a popup is not logged
 * in, and a nonce baked into a page the full-page cache serves byte-identically
 * to everyone is the same nonce for every visitor for the cache's lifetime, so
 * it authenticates nothing (ADR 0004).
 *
 * What follows from that is the shape of everything below: **nothing the
 * client sends is trusted to describe the Optin.** The fields, whether they
 * are required, whether consent was asked for and what its wording said are
 * all re-read from the server's own published copy — which is, definitionally,
 * what the visitor was shown, because the payload was projected from it.
 *
 * The refusal happens **in the request the visitor is still in**, never in a
 * queued job. WSMS's `assertE164()` throws and every push is queued, so an
 * uncanonicalisable phone accepted here becomes an exception inside a job
 * minutes later with the visitor gone and nothing on screen having failed
 * (ADR 0021). The form is the only place they can fix it.
 *
 * @since 0.1.0
 */
final class CaptureController implements RestController
{
    public function __construct(
        private readonly PublishedSet $publishedSet,
        private readonly LeadCapture $capture,
        private readonly TemplateVocabulary $vocabulary,
    ) {
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/capture', [
            [
                'methods' => 'POST',
                'callback' => [$this, 'capture'],
                'permission_callback' => [Routes::class, 'canCapture'],
                'args' => [
                    'optin_id' => [
                        'required' => true,
                        'type' => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    // `fields` and `consent` are DELIBERATELY not declared
                    // here. A declared `'type' => 'boolean'` runs
                    // `rest_sanitize_value_from_schema`, which coerces
                    // `"true"`, `"on"` and `"1"` into `true` — and consent read
                    // leniently is consent asserted on the visitor's behalf.
                    // {@see CaptureForm} requires the JSON boolean itself.
                ],
            ],
        ]);
    }

    /**
     * @return WP_REST_Response|WP_Error
     */
    public function capture(WP_REST_Request $request)
    {
        $optin = PublishedOptin::findInSet(
            $this->publishedSet->all(),
            (string) $request->get_param('optin_id')
        );

        // An Optin that is not in the published set has no form this server
        // ever showed anyone, so there is nothing to validate a submission
        // against — and a Lead attributed to it would name an Optin the
        // analytics join cannot interpret (ADR 0020).
        if ($optin === null) {
            return new WP_Error(
                'wconvert_optin_not_published',
                __('This form is no longer available.', 'wconvert'),
                ['status' => 404]
            );
        }

        // Resolved here for the same reason the payload resolves it: the
        // [[Consent Record]] is the wording exactly as it was SHOWN, and what
        // was shown depends on whether this site has a privacy policy
        // (ADR 0032).
        $payload = PolicyLink::into($optin->payload, get_privacy_policy_url());
        $form = CaptureForm::fromTemplate($payload['template'] ?? null, $this->vocabulary);
        $result = $form->validate(self::submitted($request));

        if ($result instanceof Refusal) {
            return self::refuse($result);
        }

        $lead = $this->capture->record($optin->id, $result);

        // 201 and the id of what was created, which is what a REST create
        // says. It is the visitor's own submission coming back to them, and
        // the browser needs nothing else: the success step is already in the
        // payload it rendered from.
        return new WP_REST_Response(['id' => $lead->id], 201);
    }

    /**
     * The posted body, as {@see CaptureForm} needs to see it.
     *
     * `get_json_params()` rather than `get_params()` because the merged
     * parameter set has been through the schema above, and the whole point of
     * declaring nothing there is to see exactly what the client sent — a
     * consent that arrived as the string `"false"` has to still be a string
     * when the form looks at it, or a lenient coercion asserts it.
     *
     * The field VALUES are sanitised, which is WordPress's own input side of
     * "sanitize on input, escape on output" and what every other WConvert
     * route does with a string. It is deliberately not applied to `consent`:
     * that is a boolean and running a string sanitiser over it is how a
     * boolean stops being one.
     *
     * @return array<string, mixed>
     */
    private static function submitted(WP_REST_Request $request): array
    {
        $body = $request->get_json_params();
        $body = is_array($body) ? $body : [];
        $fields = is_array($body['fields'] ?? null) ? $body['fields'] : [];

        $body['fields'] = array_map(
            static fn ($value): mixed => is_string($value) ? sanitize_text_field($value) : $value,
            $fields
        );

        return $body;
    }

    /**
     * A refusal, as something the form can render beside the input that caused
     * it.
     *
     * 422 rather than 400: the request was well-formed and understood, and
     * what failed is the content of it — which is precisely the thing the
     * visitor can correct.
     */
    private static function refuse(Refusal $refusal): WP_Error
    {
        return new WP_Error(
            $refusal->code->value,
            self::message($refusal),
            ['status' => 422, 'field' => $refusal->field]
        );
    }

    /**
     * What a refusal reads like on screen.
     *
     * The wording lives here rather than on {@see Refusal} because this is the
     * WordPress half: `__()` needs a text domain and a loaded translation, and
     * the domain types are pure so they can be tested without either. It is
     * also why the message comes from the SERVER at all rather than from the
     * loader — the loader is a raw IIFE with no `wp.i18n` runtime, so a string
     * it carried could never be translated.
     *
     * The uncanonicalisable case is told apart by field, because the two
     * halves need genuinely different sentences: an email is either an address
     * or it is not, while a phone number is usually a real number missing the
     * one thing WConvert cannot infer (ADR 0021).
     */
    private static function message(Refusal $refusal): string
    {
        // Exhaustive, with no `default` arm: a case added to {@see RefusalCode}
        // and forgotten here throws rather than silently reading as "this form
        // is not accepting submissions", which is the one wording that would
        // send a visitor away for a fixable typo.
        return match ($refusal->code) {
            RefusalCode::NotCanonical => $refusal->field === 'phone'
                ? __('Please include your country code, like +12025551234.', 'wconvert')
                : __('Please enter a valid email address.', 'wconvert'),
            RefusalCode::ConsentRequired => __('Please tick the box to continue.', 'wconvert'),
            RefusalCode::FieldRequired => __('Please fill this in.', 'wconvert'),
            RefusalCode::NoIdentifier => __('Please enter an email address or a phone number.', 'wconvert'),
            RefusalCode::NothingToCapture => __('This form is not accepting submissions.', 'wconvert'),
        };
    }
}

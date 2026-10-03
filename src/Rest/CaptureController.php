<?php

namespace WConvert\Rest;

use WConvert\Database\DatabaseException;
use WConvert\Lead\CaptureForm;
use WConvert\Lead\Refusal;
use WConvert\Lead\RefusalCode;
use WConvert\Optin\PublishedOptin;
use WConvert\Optin\PublishedSet;
use WConvert\Support\Ulid;
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
    public const MAX_BODY_BYTES = 16384;

    public function __construct(
        private readonly PublishedSet $publishedSet,
        private readonly \WConvert\Lead\JourneyCapture $capture,
        private readonly \WConvert\Optin\OptinRepository $optins,
        private readonly \WConvert\Lead\CaptureGrant $grants,
        private readonly TemplateVocabulary $vocabulary,
        private readonly CaptureRateLimit $rateLimit,
        private readonly ?\WConvert\Goal\GoalRegistry $goals = null,
        private readonly ?\WConvert\Protection\Protection $protection = null,
    ) {
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/capture', [
            [
                'methods' => 'POST',
                'callback' => [$this, 'capture'],
                'permission_callback' => [Routes::class, 'canCapture'],
                // Public and nonce-free on purpose — Routes::canCapture() says
                // why. What protects this route is below and in capture():
                // every value is re-checked against the server's own published
                // copy of the form.
                'args' => [
                    'optin_id' => [
                        'description' => 'The published Campaign this submission belongs to.',
                        'required' => true,
                        'type' => 'string',
                        'validate_callback' => static fn ($value): bool => is_string($value) && Ulid::isOne($value),
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    // `fields` and `consent` declare NO `type` and NO
                    // `sanitize_callback`, deliberately. A declared
                    // `'type' => 'boolean'` runs
                    // `rest_sanitize_value_from_schema`, which coerces
                    // `"true"`, `"on"` and `"1"` into `true` — and consent read
                    // leniently is consent asserted on the visitor's behalf.
                    // A validate_callback changes nothing it accepts, so
                    // `fields` has one; {@see CaptureForm} checks each value
                    // and requires consent as the JSON boolean itself.
                    'fields' => [
                        'description' => 'The values the visitor entered, keyed by form field.',
                        'validate_callback' => static fn ($value): bool => is_array($value),
                    ],
                    'consent' => [
                        'description' => 'Whether the visitor ticked the consent box: the JSON boolean, never coerced.',
                    ],
                ],
            ],
        ]);
    }

    /**
     * @return WP_REST_Response|WP_Error
     */
    public function capture(WP_REST_Request $request)
    {
        if (strlen($request->get_body()) > self::MAX_BODY_BYTES) {
            return new WP_Error(
                'wconvert_capture_too_large',
                __('This submission is too large. Please shorten it and try again.', 'wconvert'),
                ['status' => 413]
            );
        }

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

        // Only the address the web server identifies as the peer. Trusting a
        // caller-supplied forwarding header would let a bot choose its bucket.
        // Validated as an address: anything else buckets as the empty string.
        $address = (string) filter_var(wp_unslash($_SERVER['REMOTE_ADDR'] ?? ''), FILTER_VALIDATE_IP);

        if (!$this->rateLimit->allows($address, $optin->id, time())) {
            $this->protection?->diagnostics->record('rate_limit');
            return new WP_Error(
                'wconvert_capture_rate_limited',
                __('Too many submissions were received. Please wait a few minutes and try again.', 'wconvert'),
                ['status' => 429]
            );
        }

        // Resolved here for the same reason the payload resolves it: the
        // [[Consent Record]] is the wording exactly as it was SHOWN, and what
        // was shown depends on whether this site has a privacy policy
        // (ADR 0032).
        $saved = $this->optins->find($optin->id);
        if ($saved === null) { return new WP_Error('wconvert_unavailable', __('This form is no longer available.', 'wconvert'), ['status' => 404]); }
        $config = $saved->publishedConfig;
        if (\WConvert\Template\CaptureJourney::requiresPremium($config['template']['tree'] ?? [])
            && ($this->goals === null || !$this->goals->supportsJourneys())) {
            return new WP_Error('wconvert_journey_unavailable', __('This journey is temporarily unavailable. Please try again later.', 'wconvert'), ['status' => 503]);
        }
        $goal = $saved->goal;
        $policy = get_privacy_policy_url();
        $contract = \WConvert\Template\CaptureContract::fingerprint($config, $goal, $policy);
        $body = self::submitted($request);
        if (!is_string($body['contract'] ?? null) || !hash_equals($contract, $body['contract'])
            || \WConvert\Template\CaptureContract::issue($config, $goal, $policy) !== null) {
            return new WP_Error('wconvert_capture_changed', __('This form changed. Refresh the page to review it. Details already received remain saved.', 'wconvert'), ['status' => 409]);
        }
        $refusal = $this->protection?->honeypot($body);
        if ($refusal !== null) { return $refusal; }
        $protectedContract = $this->protection?->settings->contract($contract) ?? $contract;
        if (($body['phase'] ?? null) === 'start') {
            $challenge = $this->protection?->start($body);
            if ($challenge instanceof WP_Error) { return $challenge; }
            if (is_array($challenge)) { return new WP_REST_Response($challenge, 200); }
            return new WP_REST_Response(['grant' => $this->grants->issue($optin->id, $protectedContract, time())], 200);
        }
        $grant = $this->grants->verify(is_string($body['grant'] ?? null) ? $body['grant'] : '', $optin->id, $protectedContract, time());
        if ($grant === null) {
            return new WP_Error('wconvert_capture_expired', __('This form session has expired. Details already received remain saved. Refresh to start a new request.', 'wconvert'), ['status' => 409]);
        }
        $template = \WConvert\Template\CaptureContract::template($config, $goal, $policy);
        $id = is_string($body['submission'] ?? null) ? $body['submission'] : '';
        $settings = \WConvert\Template\CaptureContract::settings($config, $goal);
        if (!isset($settings[$id])) { return new WP_Error('wconvert_capture_invalid', __('This submission is unavailable.', 'wconvert'), ['status' => 422]); }
        $result = CaptureForm::fromTemplate($template, $this->vocabulary, $id)->validate($body);
        if ($result instanceof Refusal) { return self::refuse($result); }
        $questionAnswers = \WConvert\Lead\QuestionCapture::validate($template['tree'], $body['question_answers'] ?? [], $id);
        if ($questionAnswers instanceof Refusal) { return self::refuse($questionAnswers); }
        $result = new \WConvert\Lead\Submission($result->email, $result->phone, $result->fields, $questionAnswers);
        $refusal = $this->protection?->submission($result, $optin->id);
        if ($refusal !== null) { return $refusal; }
        try {
            $accepted = $this->capture->accept($optin->id, $contract, $grant, $template['tree'], $id, $result, $settings[$id]);
        } catch (\WConvert\Lead\CaptureConflict) {
            return new WP_Error('wconvert_capture_conflict', __('These details cannot be changed or resumed. Details already received remain saved.', 'wconvert'), ['status' => 409]);
        } catch (DatabaseException) {
            return new WP_Error('wconvert_capture_storage_failed', __('This submission could not be saved. Please try again.', 'wconvert'), ['status' => 500]);
        }
        return new WP_REST_Response($accepted, $accepted['replay'] ? 200 : 201);
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
            RefusalCode::FieldRequired => match ($refusal->field) {
                'email' => __('Please enter your email address.', 'wconvert'),
                'phone' => __('Please enter your phone number, including the country code.', 'wconvert'),
                'name' => __('Please enter your name.', 'wconvert'),
                'interest' => __('Please choose an option.', 'wconvert'),
                default => __('Please fill in this field.', 'wconvert'),
            },
            RefusalCode::FieldTooLong => __('Please shorten this field and try again.', 'wconvert'),
            RefusalCode::NoIdentifier => __('Please enter an email address or a phone number.', 'wconvert'),
            RefusalCode::ChoiceInvalid => __('Please choose one of the available options.', 'wconvert'),
            RefusalCode::NothingToCapture => __('This form is not accepting submissions.', 'wconvert'),
        };
    }
}

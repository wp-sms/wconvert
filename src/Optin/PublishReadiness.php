<?php

namespace WConvert\Optin;

use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationStore;
use WConvert\Destination\OptinBinding;
use WConvert\Goal\Goal;
use WConvert\Rules\DisplayPlan;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\Tier;
use WConvert\Support\WpProPresence;
use WConvert\Targeting\TargetingRule;
use WConvert\Template\CaptureContract;
use WConvert\Template\CaptureJourney;
use WConvert\Template\JourneySupport;
use WP_Error;

defined('ABSPATH') || exit;

/**
 * Why an Optin cannot be published yet, in the order the publish route asks.
 *
 * ============================================================================
 * ONE CHAIN, AND TWO READERS.
 * ============================================================================
 * `POST /optins/{id}/publish` refuses with the FIRST of these, exactly as it
 * did when the chain sat inline in the route. An agent's review reads ALL of
 * them without publishing anything (ADR 0154), so "what stops this going
 * live" has one answer and a dry run cannot disagree with the real one.
 *
 * Everything past the design check is about the design, so an Optin without
 * one stops there: the rest would only be asked of an empty tree.
 */
final class PublishReadiness
{
    private const NO_DESIGN = 'wconvert_optin_needs_a_design';

    public function __construct(
        private readonly OptinRepository $optins,
        private readonly RuleVocabulary $vocabulary,
        private readonly DestinationStore $destinations,
        private readonly DestinationRegistry $destinationTypes,
    ) {
    }

    /**
     * Every refusal publishing this Optin would meet.
     *
     * @return list<array{code: string, message: string, status: int, data: array<string, mixed>}>
     */
    public function issues(Optin $optin): array
    {
        $issues = [];
        foreach ($this->checks($optin) as $check) {
            $refusal = $check();
            if ($refusal === null) continue;
            $data = (array) $refusal->get_error_data();
            $issues[] = ['code' => (string) $refusal->get_error_code(), 'message' => $refusal->get_error_message(), 'status' => (int) ($data['status'] ?? 400), 'data' => $data];
            if ($refusal->get_error_code() === self::NO_DESIGN) break;
        }
        return $issues;
    }

    /** The refusal the publish route answers with, or null when it may publish. */
    public function firstRefusal(Optin $optin): ?WP_Error
    {
        foreach ($this->checks($optin) as $check) {
            $refusal = $check();
            if ($refusal !== null) return $refusal;
        }
        return null;
    }

    /**
     * Automatic inline placement, checked on every save as well as here.
     *
     * @param array<string, mixed> $config
     */
    public static function inlinePlacement(array $config): ?WP_Error
    {
        if (($config['display_type'] ?? null) !== 'inline' || ($config['inline_placement'] ?? null) === null) {
            return null;
        }
        if (InlinePlacement::normalize($config['inline_placement']) === null) {
            return new WP_Error('wconvert_inline_placement',
                __('Choose a valid inline position and a paragraph number from 1 to 100.', 'wconvert'), ['status' => 400]);
        }
        $triggers = DisplayPlan::compatibilityTriggers($config['display_rules'] ?? []);
        if (count($triggers) !== 1 || ($triggers[0]['type'] ?? null) !== 'page_load') {
            return new WP_Error('wconvert_inline_trigger',
                __('Automatic inline placement needs “When does it open?” set to Right away. Change it, or use manual placement.', 'wconvert'), ['status' => 400]);
        }
        return null;
    }

    /**
     * The checks in order, each answering a refusal or null.
     *
     * @return list<\Closure(): ?WP_Error>
     */
    private function checks(Optin $optin): array
    {
        $config = $optin->config;
        return [
            fn (): ?WP_Error => $this->display($config),
            static fn (): ?WP_Error => $optin->hasDesign() ? null : new WP_Error(
                self::NO_DESIGN,
                __('Choose a design before publishing. You can keep saving this campaign as a draft.', 'wconvert'),
                ['status' => 400]
            ),
            fn (): ?WP_Error => self::inlinePlacement($config) ?? $this->contentLock($config, $optin->id),
            static fn (): ?WP_Error => CaptureJourney::requiresPremium($config['template']['tree'] ?? []) && !JourneySupport::active()
                ? new WP_Error('wconvert_journey_unsupported', __('This design uses elements this site can’t display. You can keep saving this campaign as a draft.', 'wconvert'), ['status' => 400])
                : null,
            static fn (): ?WP_Error => self::form($config, $optin->goal),
            fn (): ?WP_Error => $this->goal($config, $optin->goal),
            static fn (): ?WP_Error => PhoneCountry::resolved($config) === null
                ? new WP_Error('wconvert_phone_country_required', __('Choose a site-wide starting country in Settings, or choose one for this phone field, before publishing.', 'wconvert'), ['status' => 400])
                : null,
            fn (): ?WP_Error => $this->signupDestinations($config, $optin->goal),
        ];
    }

    /** @param array<string, mixed> $config */
    private function display(array $config): ?WP_Error
    {
        $issues = apply_filters('wconvert_publish_issues', DisplayPlan::issues($config['display_rules'] ?? [], $this->vocabulary), $config);
        if (($config['targeting']['mode'] ?? '') === 'selected' && empty($config['targeting']['include'])) {
            $issues[] = __('Choose at least one included page.', 'wconvert');
        }
        foreach (['include', 'exclude'] as $axis) {
            foreach ($config['targeting'][$axis] ?? [] as $rule) {
                if (TargetingRule::fromArray($rule) === null || trim((string) ($rule['value'] ?? '')) === '' || (in_array($rule['type'] ?? '', ['post', 'term'], true) && (!is_numeric($rule['value'] ?? null) || (int) $rule['value'] < 1))) $issues[] = __('Complete the selected page rules.', 'wconvert');
            }
        }
        return $issues === [] ? null : new WP_Error('wconvert_display_incomplete', implode(' ', $issues), ['status' => 400]);
    }

    /**
     * Content lock on this Optin and across its test's arms; a transfer asks it too.
     *
     * @param array<string, mixed> $config
     */
    public function contentLock(array $config, string $id): ?WP_Error
    {
        $enabled = ContentLock::normalize($config['content_lock'] ?? null) !== null;
        if ($enabled && !ContentLock::compatible($config, DisplayPlan::compatibilityTriggers($config['display_rules'] ?? []))) {
            return new WP_Error('wconvert_content_lock', __('Content lock requires a complete inline submission form, manual placement, and only the page-load trigger.', 'wconvert'), ['status' => 400]);
        }
        foreach ($this->optins->otherArmsOf($id) as $arm) {
            $other = $arm->config;
            $otherEnabled = ContentLock::normalize($other['content_lock'] ?? null) !== null;
            if ($enabled !== $otherEnabled || ($otherEnabled && !ContentLock::compatible($other, DisplayPlan::compatibilityTriggers($other['display_rules'] ?? [])))) {
                return new WP_Error('wconvert_content_lock_family', __('Every A/B variant must use the same content-lock mode and a compatible inline submission form.', 'wconvert'), ['status' => 400]);
            }
        }
        return null;
    }

    /** @param array<string, mixed> $config */
    private static function form(array $config, string $goal): ?WP_Error
    {
        $issue = CaptureContract::issue($config, $goal, get_privacy_policy_url(), true);
        if ($issue === null) return null;
        $message = match ($issue) {
            'choices' => __('Add at least one choice to the interest field before publishing. You can keep saving this campaign as a draft.', 'wconvert'),
            'followup' => __('Give each resource link a label and address, and place it after the form. You can keep saving this campaign as a draft.', 'wconvert'),
            'consent' => __('Each signup needs its required contact field and its own consent wording.', 'wconvert'),
            // A free install names no product (ADR 0116 §3); it says what a question block says.
            'quiz_cart', 'commerce_products' => (new WpProPresence())->installedTier() === Tier::Free
                ? __('This design uses elements this site can’t display. You can keep saving this campaign as a draft.', 'wconvert')
                : ($issue === 'quiz_cart'
                    ? __('Quiz cart buttons need WConvert Pro and WooCommerce. Choose products for each result that uses them.', 'wconvert')
                    : __('Product recommendations need WConvert Pro and WooCommerce. Choose products in one recommendation block on a single offer screen before publishing.', 'wconvert')),
            'products' => __('Connect WooCommerce and choose products for each matching result before publishing.', 'wconvert'),
            'link' => __('A link in your text has no web address. Add one, or remove the link. You can keep saving this campaign as a draft.', 'wconvert'),
            'result_link' => __('Give each result link some words for its button, or remove its address.', 'wconvert'),
            'routes' => __('In Edit, connect every screen, give continuing screens a line for all other answers, and remove loops. You can keep saving this campaign as a draft.', 'wconvert'),
            'capture_paths' => __('In Edit, put the required form before the result, before every later question and before any second form.', 'wconvert'),
            'question_path_limit' => __('One line can ask at most ten questions. In Edit, remove questions from that line or move them to a separate line.', 'wconvert'),
            'conditions' => __('In Edit, complete each rule using a question available before it. You can keep saving this campaign as a draft.', 'wconvert'),
            'questions' => __('In Edit, complete the question text and answer choices. Choice questions need 2 to 12 named answers.', 'wconvert'),
            'results' => __('In Edit, give each result a heading and a condition, with one result for all other answers last.', 'wconvert'),
            'navigation' => __('Review each screen’s buttons in Edit. Continuing screens need either Continue or Save, not both. Optional saves also need No thanks.', 'wconvert'),
            default => __('Complete the screen order, navigation and submission fields before publishing. You can keep saving this campaign as a draft.', 'wconvert'),
        };
        return new WP_Error('wconvert_optin_form_incomplete', $message, ['status' => 400, 'issue' => $issue]);
    }

    /** @param array<string, mixed> $config */
    private function goal(array $config, string $goal): ?WP_Error
    {
        $outcome = Goal::tryFrom($goal)?->outcome();
        $goalIssue = $outcome?->designIssue($config);
        if ($goalIssue === null && $outcome !== null) {
            $readyTypes = [];
            $readyChannels = [];
            foreach (OptinBinding::ids($config) as $destinationId) {
                $destination = $this->destinations->find($destinationId);
                $type = $destination === null ? null : $this->destinationTypes->find($destination->type);
                if ($destination !== null && $type !== null && $this->destinationTypes->isDispatchable($destination->type)
                    && $type->requirements()->missingSettings($destination->settings) === []) {
                    $readyTypes[] = $destination->type;
                    array_push($readyChannels, ...$type->requirements()->audienceChannels);
                }
            }
            $goalIssue = $outcome->handoffIssue($readyTypes, OptinBinding::captureMode($config), $readyChannels);
        }
        return $goalIssue === null ? null : new WP_Error('wconvert_optin_goal_incomplete', $goalIssue, ['status' => 400]);
    }

    /** @param array<string, mixed> $config */
    private function signupDestinations(array $config, string $goal): ?WP_Error
    {
        $submissions = $config['template']['tree']['submissions'] ?? [];
        $primarySubmission = $submissions[0]['id'] ?? '';
        foreach (CaptureContract::settings($config, $goal) as $submissionId => $setting) {
            if (OptinBinding::captureMode($config) === 'local') { continue; }
            if ($setting['purpose'] !== 'request' && $setting['destination_ids'] === []) {
                return new WP_Error('wconvert_signup_destination', __('Choose a service for each form, or choose “Keep in WConvert only”.', 'wconvert'), ['status' => 400]);
            }
            $requiredValues = [];
            foreach ($submissions as $definition) {
                if ($definition['id'] !== $submissionId) { continue; }
                foreach ($config['template']['tree']['steps'] as $screen) {
                    foreach (CaptureJourney::nodes($screen['content']) as $node) {
                        if (in_array($node['id'] ?? null, $definition['fields'], true) && ($node['required'] ?? false)) {
                            $requiredValues[$node['name']] = 'present';
                        }
                    }
                }
            }
            foreach ($setting['destination_ids'] as $destinationId) {
                $destination = $this->destinations->find($destinationId);
                $type = $destination === null ? null : $this->destinationTypes->find($destination->type);
                // `phone`, as `CaptureContract` and every type's audience channels spell it.
                $channel = $setting['purpose'] === 'email_marketing' ? 'email' : 'phone';
                if ($destination === null || $type === null || !$this->destinationTypes->isDispatchable($destination->type)
                    || $type->requirements()->missingSettings($destination->settings) !== []
                    || !$type->requirements()->acceptsCapture($requiredValues)
                    || ($setting['purpose'] !== 'request' && !in_array($channel, $type->requirements()->audienceChannels, true)
                        && ($submissionId !== $primarySubmission || $type->requirements()->audienceChannels !== []))) {
                    return new WP_Error('wconvert_signup_destination', __('A selected signup service is unavailable or does not support its channel.', 'wconvert'), ['status' => 400]);
                }
            }
        }
        return null;
    }
}

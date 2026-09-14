<?php

namespace WConvert\Playbook;

use WConvert\Goal\Goal;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\Rejection;
use WConvert\Support\RejectionReason;
use WConvert\Support\Ulid;
use WConvert\Template\SlotRoles;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

defined('ABSPATH') || exit;

/**
 * The [[Playbook]] registry — and **the whole of Playbook validation**.
 *
 * ============================================================================
 * VALIDATION HAPPENS AT REGISTRATION, NEVER AT RUNTIME.
 * ============================================================================
 * These checks replace runtime warnings by design, so this is the only place
 * the guarantee lives. Registration is the last moment an author is present: a
 * Playbook is data and third parties add them, so a rule enforced at prefill
 * reaches its author as a merchant's bug report about a popup with no
 * headline.
 *
 * That is the same pattern ADR 0010 set for Templates and ADR 0020 restated
 * for the two-converting-acts case, and it is why nothing downstream —
 * {@see Prefill}, the gallery, the renderer — re-asks any of these questions.
 *
 * **Bundled entries are PHP files returning arrays; remote ones are JSON**
 * (ADR 0013). A Playbook is nothing but words and `wp i18n make-pot` cannot
 * see a JSON string, so a JSON bundled registry ships an English-only library;
 * remote entries stay JSON because remote PHP is Guideline 8 remote code
 * execution with no argument available. Installed JSON packs supply additional
 * entries through {@see self::fromEntries()} after strict catalog validation
 * (ADR 0083); the runtime reads local archives, never remote PHP.
 *
 * **The library carries no Availability of its own.** A Playbook serves one
 * Goal and the gallery is only ever reached *through* a Goal the merchant was
 * able to choose, so the question was already answered one level up
 * ({@see \WConvert\Goal\GoalRegistry}). A premium [[Display Type]] shown as an
 * upsell (ADR 0012) needs a Playbook naming a Template free does not ship,
 * which arrives with those Templates.
 *
 * @since 0.1.0
 */
final class PlaybookLibrary
{
    public const PATH = 'resources/playbooks';

    /** What a destination hint may say. Types and fields — never an id. */
    private const HINT_KEYS = ['types', 'fields'];

    /**
     * @param array<string, Playbook> $playbooks
     * @param list<Rejection> $rejections
     */
    private function __construct(
        private readonly array $playbooks,
        private readonly array $rejections,
    ) {
    }

    /**
     * The bundled library, off disk.
     *
     * Each file `return`s an array and the words inside it are wrapped in
     * `__()`, so `wp i18n make-pot` can see them — which is the whole reason
     * bundled entries are PHP rather than the JSON a Template ships as
     * (ADR 0013).
     *
     * @param iterable<array<string, mixed>> $additional Validated installed entries.
     */
    public static function fromDirectory(
        TemplateLibrary $templates,
        TemplateVocabulary $vocabulary,
        RuleVocabulary $rules,
        string $pluginDir = WCONVERT_DIR,
        iterable $additional = []
    ): self {
        $files = glob(rtrim($pluginDir, '/') . '/' . self::PATH . '/*.php');
        $entries = [];

        foreach ($files === false ? [] : $files as $file) {
            $entry = is_readable($file) ? require $file : null;

            if (is_array($entry)) {
                /** @var array<string, mixed> $entry */
                $entries[] = $entry;
            }
        }

        foreach ($additional as $entry) $entries[] = $entry;

        return self::fromEntries($entries, $templates, $vocabulary, $rules);
    }

    /**
     * Normalise and validate a set of entries — the one door in.
     *
     * @param iterable<array<string, mixed>> $entries
     */
    public static function fromEntries(
        iterable $entries,
        TemplateLibrary $templates,
        TemplateVocabulary $vocabulary,
        RuleVocabulary $rules
    ): self {
        $playbooks = [];
        $rejections = [];

        foreach ($entries as $entry) {
            $id = is_string($entry['id'] ?? null) ? $entry['id'] : '';
            $reason = isset($playbooks[$id])
                ? RejectionReason::DuplicateId
                : self::refuse($entry, $templates, $vocabulary, $rules);

            if ($reason !== null) {
                $rejections[] = new Rejection($id, $reason);
                continue;
            }

            $playbooks[$id] = self::normalize($entry, $templates);
        }

        ksort($playbooks);

        foreach ($rejections as $rejection) {
            $rejection->warn(__METHOD__);
        }

        return new self($playbooks, $rejections);
    }

    /**
     * @return array<string, Playbook>
     */
    public function all(): array
    {
        return $this->playbooks;
    }

    /**
     * The gallery, **filtered on Goal only**.
     *
     * Display Type is not the primary axis of the product: users arrive via a
     * Goal, and the type is prefilled by the chosen Playbook — selectable as
     * an override and a filter afterwards, never the first question asked
     * (CONTEXT.md, Display Type).
     *
     * @return list<Playbook>
     */
    public function servicing(Goal $goal): array
    {
        return array_values(array_filter(
            $this->playbooks,
            static fn (Playbook $playbook): bool => $playbook->goal === $goal
        ));
    }

    public function find(string $id): ?Playbook
    {
        return $this->playbooks[$id] ?? null;
    }

    /**
     * @return list<Rejection>
     */
    public function rejections(): array
    {
        return $this->rejections;
    }

    /**
     * Why this entry may not be registered, or null.
     *
     * @param array<string, mixed> $entry
     */
    public static function refuse(
        array $entry,
        TemplateLibrary $templates,
        TemplateVocabulary $vocabulary,
        RuleVocabulary $rules
    ): ?RejectionReason {
        if (!is_string($entry['id'] ?? null) || $entry['id'] === '') {
            return RejectionReason::Malformed;
        }

        $goal = is_string($entry['goal'] ?? null) ? Goal::tryFrom($entry['goal']) : null;
        $template = is_string($entry['template_id'] ?? null) ? $templates->find($entry['template_id']) : null;

        if ($goal === null || $template === null) {
            return RejectionReason::UnknownReference;
        }

        // ====================================================================
        // THERE IS NO PAIRING TO CHECK. THE ACT IS THE DESIGN'S (ADR 0059).
        // ====================================================================
        // This refused an entry whose default Template offered the other act
        // from the Goal it was filed under, and it was right while a Goal
        // declared an act. It no longer does — a Template offering exactly one
        // converting act IS the declaration, enforced at its own registration
        // by {@see TemplateLibrary::refuse()} — so there is no second source to
        // disagree with and nothing here to compare.
        //
        // What the check would cost now is real rather than theoretical: a
        // third party filing a capture design under the sale Goal is offering
        // a start the merchant can legitimately want, and refusing it at
        // registration would drop the card with nothing in any log.

        // One Template serves exactly one Display Type (CONTEXT.md, Template),
        // so an entry need not declare one — and one that does must agree with
        // the design it names, or the gallery files a popup under "floating
        // bar" with nobody told.
        $declared = $entry['display_type'] ?? null;

        if (is_string($declared) && $declared !== ($template['display_type'] ?? null)) {
            return RejectionReason::DisplayTypeMismatch;
        }

        // Every key every rule supplies, against the params its type
        // declares. A key no loader module reads is not an extension — it is
        // a rule that can never hold, on every Optin this entry prefills.
        //
        // Asked BEFORE the Trigger check below, because a misspelled param and
        // a missing Trigger are the same symptom with different causes:
        // `['type' => 'time_on_page', 'value' => 8]` has no `seconds` and so
        // has no Trigger that could fire, but "no Trigger" is not what its
        // author got wrong and not what they need to read.
        foreach (self::rulesNamedBy($entry) as [$type, $supplied]) {
            if (array_diff($supplied, array_keys($rules->paramsOf($type))) !== []) {
                return RejectionReason::UnknownRuleParam;
            }
        }

        // Every Optin has at least one [[Trigger]] and "shows immediately" is
        // the explicit `page_load` one rather than an empty list (CONTEXT.md,
        // Trigger). A Playbook naming none prefills an Optin that can never
        // fire — a silent, total loss of function with nothing in any log
        // (ADR 0012) — and this is the last moment an author is present. One
        // naming a Trigger with no value for a param the merchant was never
        // going to supply is the same Optin wearing a rule, which is why this
        // asks whether one could FIRE rather than counting them.
        if (!$rules->hasTrigger($entry['rules'] ?? [])) {
            return RejectionReason::NoTrigger;
        }

        $copy = is_array($entry['copy'] ?? null) ? $entry['copy'] : [];

        if (self::namesSomethingSiteLocal($entry, $copy, $rules, $vocabulary)) {
            return RejectionReason::SiteLocalReference;
        }

        // Every Role it fills, against every Role its default Template
        // declares. A Role the Template does not declare is dropped on prefill
        // and nobody is told (CONTEXT.md, Slot Role) — so it is caught here,
        // where there is still an author to tell.
        $declared = SlotRoles::declaredIn($template['tree'], $vocabulary);

        return array_diff(array_keys($copy), $declared) === [] ? null : RejectionReason::UnfilledSlotRole;
    }

    /**
     * Every rule this entry names, on all three axes, as `[type, keys it
     * supplies]`.
     *
     * One walk for both checks above, because both ask a question about the
     * SAME set — "does any rule name a param it may not" and "does any rule
     * name a param that does not exist" differ only in which list they compare
     * against. Two walks would be two chances for a `split`-shaped omission:
     * the exclude list is exactly where a second reader forgets to look.
     *
     * Targeting rules are `{type, value}` and client rules are `{type,
     * ...params}` ({@see \WConvert\Targeting\TargetingRule}), so the keys
     * are simply everything that is not `type` in either case.
     *
     * @param array<string, mixed> $entry
     * @return list<array{string, list<string>}>
     */
    private static function rulesNamedBy(array $entry): array
    {
        $targeting = is_array($entry['targeting'] ?? null) ? $entry['targeting'] : [];
        $lists = [is_array($entry['rules'] ?? null) ? $entry['rules'] : []];

        foreach (['include', 'exclude'] as $list) {
            $lists[] = is_array($targeting[$list] ?? null) ? $targeting[$list] : [];
        }

        $named = [];

        foreach ($lists as $rules) {
            foreach ($rules as $rule) {
                if (is_array($rule) && is_string($rule['type'] ?? null)) {
                    $named[] = [$rule['type'], array_values(array_diff(array_map('strval', array_keys($rule)), ['type']))];
                }
            }
        }

        return $named;
    }

    /**
     * **A Playbook can express nothing site-local.**
     *
     * Three shapes, and the reasoning is one: an entry is written once and
     * runs on every install, so anything naming a row on one of them is wrong
     * everywhere else.
     *
     * - **A param the manifest marks `authored`.** Which those are is read off
     *   the manifest rather than listed here: a post id and a term id name a
     *   row only one site has, and `click_element`'s CSS selector names markup
     *   only one site has — the same fact, so the same declaration. That is
     *   also the whole of "`click_element`'s selector is author-only and blank
     *   in any Playbook-prefilled Optin" (ADR 0012): a registered entry cannot
     *   carry one, so prefill has nothing to blank. `post_type` and
     *   `path_glob` mean the same thing everywhere and are not marked.
     * - **A [[Destination]] id.** A hint names Destination *types* and the
     *   [[Lead]] fields the Playbook needs; prefill never binds a Destination
     *   invisibly. Anything beyond those two keys is refused rather than
     *   ignored — and so is a ULID sitting *inside* them, which is the shape
     *   an id actually arrives in: `types: ['01JQ…']` is a Destination id
     *   wearing a type's clothes. The test is {@see Ulid::isOne()}, which is
     *   the one spelling of "this is a ULID" and does not gain a second copy
     *   here.
     * - **A [[Slot Role]] the manifest marks `authored_roles`.** Which those
     *   are is read off the manifest for the reason the rule params above are:
     *   `code_value` holds a coupon code that exists in one merchant's
     *   WooCommerce and nowhere else, so a Playbook filling it would ship a
     *   dead code to every install that used the entry — the same failure a
     *   post id is, in a different key. Without this the check one level up
     *   catches only half of it: a Playbook filling `code_value` on a design
     *   that does not DECLARE the Role is already refused as an unfilled Role,
     *   and one filling it on a design that does was accepted.
     * - **A privacy-policy link.** A link that declares a label and names no
     *   destination is asking for the one destination only the site can name,
     *   and the renderer resolves it from `get_privacy_policy_url()`
     *   (ADR 0032). A Playbook supplying the href instead is naming a page on
     *   one particular site — so a Playbook's copy carries labels and never
     *   hrefs.
     *
     * @param array<string, mixed> $entry
     * @param array<string, mixed> $copy
     */
    private static function namesSomethingSiteLocal(
        array $entry,
        array $copy,
        RuleVocabulary $rules,
        TemplateVocabulary $vocabulary
    ): bool {
        foreach (self::rulesNamedBy($entry) as [$type, $supplied]) {
            if (array_intersect($supplied, $rules->authoredParamsOf($type)) !== []) {
                return true;
            }
        }

        $hint = is_array($entry['destination_hint'] ?? null) ? $entry['destination_hint'] : [];

        if (array_diff(array_keys($hint), self::HINT_KEYS) !== []) {
            return true;
        }

        foreach ($hint as $values) {
            foreach (is_array($values) ? $values : [$values] as $value) {
                if (is_string($value) && Ulid::isOne($value)) {
                    return true;
                }
            }
        }

        if (array_intersect(array_keys($copy), $vocabulary->authoredRoles()) !== []) {
            return true;
        }

        foreach ($copy as $words) {
            if (is_array($words) && is_array($words['link'] ?? null) && array_key_exists('href', $words['link'])) {
                return true;
            }
        }

        return false;
    }

    /**
     * One validated entry, in the one in-memory shape.
     *
     * @param array<string, mixed> $entry
     */
    private static function normalize(array $entry, TemplateLibrary $templates): Playbook
    {
        $templateId = (string) $entry['template_id'];
        $template = (array) $templates->find($templateId);

        return new Playbook(
            (string) $entry['id'],
            is_string($entry['name'] ?? null) ? $entry['name'] : (string) $entry['id'],
            (Goal::from((string) $entry['goal'])),
            $templateId,
            (string) ($template['display_type'] ?? 'popup'),
            is_array($entry['copy'] ?? null) ? $entry['copy'] : [],
            array_values(array_filter(
                is_array($entry['rules'] ?? null) ? $entry['rules'] : [],
                'is_array'
            )),
            is_array($entry['targeting'] ?? null) ? $entry['targeting'] : [],
            is_array($entry['destination_hint'] ?? null) ? $entry['destination_hint'] : [],
            is_string($entry['notes'] ?? null) ? $entry['notes'] : '',
            is_array($entry['collection'] ?? null) ? $entry['collection'] : null,
        );
    }
}

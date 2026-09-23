<?php
namespace WConvert\Rules;

use WConvert\Targeting\RequestContext;

defined('ABSPATH') || exit;

/** Fixed-depth authored display policy. Draft validation never discards a restriction. */
final class DisplayPlan
{
    /**
     * @return array<string, mixed> */
    public static function immediate(): array
    {
        return ['audience' => ['mode' => 'everyone'], 'opening' => ['mode' => 'immediate']];
    }

    /**
     * @param mixed $input
     * @return array<string, mixed> */
    public static function normalize($input, RuleVocabulary $vocabulary): array
    {
        if (!is_array($input) || !is_array($input['audience'] ?? null) || !is_array($input['opening'] ?? null)) {
            throw new \InvalidArgumentException(__('Choose a current display plan. Older development rules must be replaced.', 'wconvert'));
        }
        self::onlyKeys($input, ['audience', 'opening']);
        $ids = [];
        $audience = $input['audience'];
        self::onlyKeys($audience, ($audience['mode'] ?? '') === 'everyone' ? ['mode'] : ['mode', 'groups']);
        if (($audience['mode'] ?? '') === 'everyone') {
            $audience = ['mode' => 'everyone'];
        } elseif (($audience['mode'] ?? '') === 'groups') {
            $groups = $audience['groups'] ?? null;
            if (!is_array($groups) || !array_is_list($groups) || count($groups) > 5) {
                throw new \InvalidArgumentException(__('Use up to five audience groups.', 'wconvert'));
            }
            $audience = ['mode' => 'groups', 'groups' => array_map(
                static function ($group) use ($vocabulary, &$ids): array {
                    if (!is_array($group)) throw new \InvalidArgumentException(__('Invalid audience group.', 'wconvert'));
                    self::onlyKeys($group, ['id', 'match', 'rules']);
                    return ['id' => self::id($group, $ids), 'match' => self::operator($group)] +
                        ['rules' => self::leaves($group['rules'] ?? null, 'audience', $vocabulary, $ids)];
                }, $groups)];
        } else {
            throw new \InvalidArgumentException(__('Choose Everyone or Specific visitors.', 'wconvert'));
        }
        $opening = $input['opening'];
        $mode = $opening['mode'] ?? '';
        self::onlyKeys($opening, $mode === 'immediate' ? ['mode'] : ($mode === 'click' ? ['mode', 'rules'] : ['mode', 'rules', 'match', 'minimum_seconds']));
        if ($mode === 'immediate') {
            $opening = ['mode' => $mode];
        } elseif ($mode === 'automatic' || $mode === 'click') {
            $opening = ['mode' => $mode, 'rules' => self::leaves($opening['rules'] ?? null, $mode, $vocabulary, $ids)] +
                ($mode === 'automatic' ? ['match' => self::operator($opening), 'minimum_seconds' => $opening['minimum_seconds'] ?? 0] : []);
            if ($mode === 'automatic' && (!is_numeric($opening['minimum_seconds'] ?? null) || !is_finite((float) $opening['minimum_seconds']) || $opening['minimum_seconds'] < 0 || $opening['minimum_seconds'] > 3600)) {
                throw new \InvalidArgumentException(__('Minimum time must be between 0 and 3600 seconds.', 'wconvert'));
            }
        } else {
            throw new \InvalidArgumentException(__('Choose a supported opening mode.', 'wconvert'));
        }
        return ['audience' => $audience, 'opening' => $opening];
    }

    /** @param array<string, mixed> $value
     * @param list<string> $keys
     */
    private static function onlyKeys(array $value, array $keys): void
    {
        if (array_diff(array_keys($value), $keys) !== []) throw new \InvalidArgumentException(__('Unknown display settings cannot be silently removed.', 'wconvert'));
    }

    /**
     * @param array<string, mixed> $group */
    private static function operator(array $group): string
    {
        if (!in_array($group['match'] ?? '', ['all', 'any'], true)) throw new \InvalidArgumentException(__('Choose ALL or ANY.', 'wconvert'));
        return $group['match'];
    }

    /**
     * @param array<string, mixed> $row
     * @param array<string, bool> $ids */
    private static function id(array $row, array &$ids): string
    {
        $id = $row['id'] ?? null;
        if (!is_string($id) || !preg_match('/^[a-zA-Z0-9_-]{1,64}$/D', $id) || isset($ids[$id])) {
            throw new \InvalidArgumentException(__('Every display group and rule needs a unique identifier.', 'wconvert'));
        }
        $ids[$id] = true;
        return $id;
    }

    /**
     * @param mixed $rows
     * @param array<string, bool> $ids
     * @return list<array<string, mixed>> */
    private static function leaves($rows, string $slot, RuleVocabulary $vocabulary, array &$ids): array
    {
        if (!is_array($rows) || !array_is_list($rows) || count($rows) > 8) throw new \InvalidArgumentException(__('Use up to eight rules per group.', 'wconvert'));
        $result = [];
        foreach ($rows as $row) {
            if (!is_array($row) || !is_string($row['type'] ?? null) || isset($row['rules']) || isset($row['groups'])) {
                throw new \InvalidArgumentException(__('Rules cannot contain nested groups.', 'wconvert'));
            }
            if (array_diff(array_keys($row), ['id', 'type', RuleVocabulary::DEGRADED_FROM, ...array_keys($vocabulary->paramsOf($row['type']))]) !== []) throw new \InvalidArgumentException(__('Unknown rule parameter.', 'wconvert'));
            $kind = $vocabulary->kindOf($row['type']);
            $allowed = $slot === 'audience' ? in_array($kind, [RuleKind::Condition, RuleKind::Visitor], true)
                : ($kind === RuleKind::Trigger && ($slot === 'click' ? $row['type'] === 'click_element' : !in_array($row['type'], ['click_element', 'page_load'], true)));
            if (!$allowed) throw new \InvalidArgumentException(__('This rule is unknown or belongs in a different section.', 'wconvert'));
            $out = ['id' => self::id($row, $ids), 'type' => $row['type']];
            foreach ($vocabulary->paramsOf($row['type']) as $name => $param) {
                if (!array_key_exists($name, $row)) continue;
                $value = $row[$name];
                if (is_object($value) || (is_array($value) && array_filter($value, static fn ($v) => !is_scalar($v)) !== [])) {
                    throw new \InvalidArgumentException(__('Rule parameters must be simple values.', 'wconvert'));
                }
                $out[$name] = $value;
            }
            if (isset($row[RuleVocabulary::DEGRADED_FROM])) $out[RuleVocabulary::DEGRADED_FROM] = $row[RuleVocabulary::DEGRADED_FROM];
            $result[] = $out;
        }
        return $result;
    }

    /** Publish readiness, also used when compiling; incomplete drafts can be saved.
     *
     * @param array<string, mixed> $plan
     * @return list<string>
     */
    public static function issues(array $plan, RuleVocabulary $vocabulary): array
    {
        try { $plan = self::normalize($plan, $vocabulary); }
        catch (\InvalidArgumentException $error) { return [$error->getMessage()]; }
        $issues = [];
        $groups = $plan['audience']['groups'] ?? [];
        if ($plan['audience']['mode'] === 'groups' && !$groups) $issues[] = __('Add an audience group or choose Everyone.', 'wconvert');
        if ($plan['opening']['mode'] !== 'immediate') $groups[] = $plan['opening'];
        foreach ($groups as $group) {
            if (!$group['rules']) $issues[] = __('Add a rule to each group.', 'wconvert');
            $devices = null;
            $signedIn = [];
            $gestures = 0;
            $idle = false;
            foreach ($group['rules'] as $rule) {
                if ($vocabulary->signalOf($rule['type']) === 'gesture' && $rule['type'] !== 'click_element') ++$gestures;
                $idle = $idle || $rule['type'] === 'inactivity';
                if ($rule['type'] === 'device' && is_array($rule['in'] ?? null)) $devices = $devices === null ? $rule['in'] : array_intersect($devices, $rule['in']);
                if ($rule['type'] === 'logged_in') $signedIn[] = $rule['value'] ?? null;
                foreach ($vocabulary->paramsOf($rule['type']) as $name => $param) {
                    $value = $rule[$name] ?? null;
                    if ($rule['type'] === 'query_param' && $name === 'value' && ($value === null || $value === [])) continue;
                    $control = $param['control'] ?? '';
                    $valid = $value !== null && $value !== '' && $value !== [];
                    if ($valid) $valid = match ($control) {
                        'seconds' => is_numeric($value) && $value >= 1 && $value <= 3600,
                        'percent' => is_numeric($value) && (float) (int) $value === (float) $value && $value >= 1 && $value <= 100,
                        'amount' => is_numeric($value) && $value >= 0 && is_finite((float) $value),
                        'boolean' => is_bool($value),
                        'device_set', 'referrer_set', 'role_set', 'text_set' => is_array($value) && array_is_list($value)
                            && count(array_filter($value, static fn ($v) => is_string($v) && trim($v) !== '')) === count($value)
                            && (!isset($param['options']) || array_diff($value, $param['options']) === []),
                        'selector' => is_string($value) && self::validSelector($value),
                        'hours' => is_string($value) && (bool) preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]-(?:[01][0-9]|2[0-3]):[0-5][0-9]$/D', $value),
                        default => is_string($value) && trim($value) !== '',
                    };
                    if (!$valid) $issues[] = sprintf(__('%1$s: complete the %2$s value.', 'wconvert'), RuleLabels::types()[$rule['type']] ?? $rule['type'], $name);
                }
            }
            if (($group['match'] ?? 'any') === 'all' && ($devices === [] || (in_array(true, $signedIn, true) && in_array(false, $signedIn, true)))) $issues[] = __('These audience requirements contradict each other. Use ANY or change the values.', 'wconvert');
            if (($group['match'] ?? 'any') === 'all' && ($gestures > 1 || ($idle && $gestures > 0))) {
                $issues[] = __('Use ANY for alternative gestures. Inactivity and a leaving gesture cannot be required together.', 'wconvert');
            }
        }
        return $issues;
    }

    /** A portable selector: tag, ID, classes and attribute tests, with combinators.
     * Advanced CSS pseudo-functions are deliberately outside this authoring contract.
     */
    public static function validSelector(string $value): bool
    {
        $name = '[a-zA-Z_][a-zA-Z0-9_-]*';
        $attribute = '\[' . $name . '(?:\s*(?:[\~|^$*]?=)\s*(?:"[^"\r\n]*"|\'[^\'\r\n]*\'|[a-zA-Z0-9_-]+))?\s*\]';
        $atom = '(?:[.#]' . $name . '|' . $attribute . ')';
        $compound = '(?:(?:' . $name . '|\*)' . $atom . '*|' . $atom . '+)';
        return strlen($value) <= 512 && preg_match('~^\s*' . $compound . '(?:\s*(?:[>+\~,]\s*|\s+)' . $compound . ')*\s*$~D', $value) === 1;
    }

    /**
     * @param array<string, mixed> $plan
     * @return list<array<string, mixed>> */
    public static function rules(array $plan): array
    {
        $rules = $plan['opening']['rules'] ?? [];
        foreach ($plan['audience']['groups'] ?? [] as $group) array_push($rules, ...($group['rules'] ?? []));
        return $rules;
    }

    /** Existing format constraints ask whether opening is exclusively immediate.
     *
     * @param array<string, mixed> $plan
     * @return list<array<string, mixed>>
     */
    public static function compatibilityTriggers(array $plan): array
    {
        return ($plan['opening']['mode'] ?? '') === 'immediate' ? [['type' => 'page_load']] : ($plan['opening']['rules'] ?? []);
    }

    /** Only for catalog definitions, never a saved-data interpreter.
     *
     * @param list<array<string, mixed>> $rules
     * @return array<string, mixed>
     */
    public static function fromCatalogue(array $rules, RuleVocabulary $vocabulary): array
    {
        $parts = $vocabulary->partition($rules);
        $id = 0;
        $identify = static function (array $rule) use (&$id): array { return ['id' => 'rule-' . ++$id] + $rule; };
        $triggers = array_map($identify, $parts['triggers']);
        $conditions = array_map($identify, $parts['conditions']);
        $immediate = array_filter($triggers, static fn ($rule) => $rule['type'] === 'page_load') !== [];
        $click = $triggers !== [] && count(array_filter($triggers, static fn ($rule) => $rule['type'] === 'click_element')) === count($triggers);
        return ['audience' => $conditions === [] ? ['mode' => 'everyone'] : ['mode' => 'groups', 'groups' => [
            ['id' => 'audience', 'match' => 'all', 'rules' => $conditions],
        ]], 'opening' => $immediate ? ['mode' => 'immediate'] : (['mode' => $click ? 'click' : 'automatic', 'rules' => $triggers] + ($click ? [] : ['match' => 'any', 'minimum_seconds' => 0]))];
    }

    /** Reduce account facts inside their original groups. No role names reach public HTML.
     *
     * @param array<string, mixed> $plan
     * @return array<string, mixed>|null
     */
    public static function forRequest(array $plan, RequestContext $context): ?array
    {
        if (($plan['audience']['mode'] ?? '') === 'everyone') return $plan;
        $survivors = [];
        foreach ($plan['audience']['groups'] ?? [] as $group) {
            $leaves = [];
            $resolved = null;
            foreach ($group['rules'] as $rule) {
                $answer = match ($rule['type']) {
                    'logged_in' => $context->isLoggedIn === $rule['value'],
                    'role' => array_intersect($context->roles, $rule['value']) !== [],
                    default => null,
                };
                if ($answer === null) $leaves[] = $rule;
                elseif ($group['match'] === 'all' && !$answer) { $resolved = false; break; }
                elseif ($group['match'] === 'any' && $answer) { $resolved = true; break; }
            }
            if ($resolved === null && !$leaves) $resolved = $group['rules'] !== [] && $group['match'] === 'all';
            if ($resolved === true) { $plan['audience'] = ['mode' => 'everyone']; return $plan; }
            if ($resolved !== false) { $group['rules'] = $leaves; $survivors[] = $group; }
        }
        if (!$survivors) return null;
        $plan['audience']['groups'] = $survivors;
        return $plan;
    }
}

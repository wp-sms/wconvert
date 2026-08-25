<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * The template manifest, read as a vocabulary — and the validation that reads
 * it.
 *
 * **This is what replaces `wp_kses`.** A template is configuration, not a
 * document: a JSON node tree plus a token set, with no HTML and no CSS
 * anywhere in it. There is nothing to sanitise, so the only thing left to
 * enforce is closure — an unknown node type, an unknown token, an unknown
 * param and an unknown Slot Role are all DROPPED here, on the way in
 * (ADR 0010).
 *
 * Dropping rather than rejecting, and on the way IN rather than at publish, is
 * the same posture {@see \WConvert\Rules\RuleVocabulary} takes: the vocabulary
 * is closed, so what arrives outside it is a mistake rather than an extension,
 * and one caught at write cannot sit in `config` until the day someone
 * publishes it.
 *
 * Note what this is NOT. It is not the renderer's unknown-node rule. The
 * renderer skips an unrecognised node because a SNAPSHOT outlives the
 * vocabulary it was drawn from; this drops one because it was never in the
 * vocabulary to begin with. Both are needed and they answer different
 * questions.
 *
 * @since 0.1.0
 */
final class TemplateVocabulary
{
    /** Where a layout keeps its children. `split` is the one with two. */
    private const PANES = ['start', 'end'];

    /**
     * The Slot Roles a `field` declares, named for what it captures.
     *
     * A Role is unique across a Template's whole tree (CONTEXT.md, Slot Role),
     * so a field cannot carry a `field_label` Role — two fields would collide
     * on it. Naming them for the kind makes uniqueness a property of the
     * vocabulary rather than a rule to check.
     */
    private const FIELD_ROLE_SUFFIXES = ['_label', '_placeholder'];

    /** The only schemes a link may carry (ADR 0013). */
    private const SAFE_SCHEMES = ['http', 'https', 'mailto'];

    /**
     * @param array<string, array{children: string, params: list<string>}> $layouts
     * @param array<string, array{content: list<string>, params: list<string>, roles: list<string>}> $nodes
     * @param list<string> $tokens
     * @param list<string> $roles
     * @param list<string> $fields
     */
    private function __construct(
        private readonly array $layouts,
        private readonly array $nodes,
        private readonly array $tokens,
        private readonly array $roles,
        private readonly array $fields,
    ) {
    }

    public static function fromManifest(string $pluginDir = WCONVERT_DIR): self
    {
        return self::fromArray(TemplateManifest::load($pluginDir));
    }

    /**
     * @param array<string, mixed> $manifest The decoded manifest, whole.
     */
    public static function fromArray(array $manifest): self
    {
        $layouts = [];
        $nodes = [];

        foreach (self::section($manifest, 'layouts') as $type => $entry) {
            $layouts[(string) $type] = [
                'children' => is_array($entry) && is_string($entry['children'] ?? null) ? $entry['children'] : 'list',
                'params' => self::strings(is_array($entry) ? ($entry['params'] ?? []) : []),
            ];
        }

        foreach (self::section($manifest, 'nodes') as $type => $entry) {
            $nodes[(string) $type] = [
                'content' => self::strings(is_array($entry) ? ($entry['content'] ?? []) : []),
                'params' => self::strings(is_array($entry) ? ($entry['params'] ?? []) : []),
                'roles' => self::strings(is_array($entry) ? ($entry['roles'] ?? []) : []),
            ];
        }

        return new self(
            $layouts,
            $nodes,
            array_map('strval', array_keys(self::section($manifest, 'tokens'))),
            self::strings($manifest['roles'] ?? []),
            self::strings($manifest['fields'] ?? []),
        );
    }

    /**
     * A whole template — tree and tokens — with everything outside the
     * vocabulary already gone.
     *
     * Both keys are always present, including empty. A template that
     * normalises to nothing is a template that renders nothing, which is a
     * visible failure; one missing its `steps` key would be an undefined index
     * somewhere downstream instead.
     *
     * @param mixed $template
     * @return array{tree: array{steps: list<array<string, mixed>>}, tokens: array<string, string>}
     */
    public function normalize($template): array
    {
        $template = is_array($template) ? $template : [];
        $tree = $template['tree'] ?? [];
        $steps = is_array($tree) ? ($tree['steps'] ?? []) : [];

        // Roles are unique across the whole tree, not per step: a Playbook
        // binds one word to one Role, and the terminal step's success headline
        // is a different Role from the first step's headline for exactly that
        // reason.
        $seenRoles = [];
        $normalized = [];

        foreach (is_array($steps) ? $steps : [] as $step) {
            $node = $this->node($step, $seenRoles);

            if ($node !== null) {
                $normalized[] = $node;
            }
        }

        return [
            'tree' => ['steps' => $normalized],
            'tokens' => $this->tokens($template['tokens'] ?? []),
        ];
    }

    /**
     * Every Slot Role a tree declares, in tree order.
     *
     * The Playbook registry validates a Playbook's copy against this at
     * registration: a Playbook's default Template must declare every Role it
     * fills, which is what makes a dropped word a build-time failure rather
     * than a blank slot on a live popup (CONTEXT.md, Slot Role).
     *
     * @param mixed $tree
     * @return list<string>
     */
    public function rolesIn($tree): array
    {
        $tree = is_array($tree) ? $tree : [];
        $steps = is_array($tree['steps'] ?? null) ? $tree['steps'] : [];
        $roles = [];

        foreach ($steps as $step) {
            $this->collectRoles($step, $roles);
        }

        return $roles;
    }

    /**
     * @param mixed $node
     * @param list<string> $roles
     */
    private function collectRoles($node, array &$roles): void
    {
        if (!is_array($node) || !is_string($node['type'] ?? null)) {
            return;
        }

        $role = $node['role'] ?? null;

        if (is_string($role) && in_array($role, $this->roles, true)) {
            $roles[] = $role;
        }

        // A field's Roles are IMPLIED by what it captures rather than written
        // on it, so `email_label` exists the moment an email field does.
        if ($node['type'] === 'field' && is_string($node['name'] ?? null) && in_array($node['name'], $this->fields, true)) {
            foreach (self::FIELD_ROLE_SUFFIXES as $suffix) {
                $roles[] = $node['name'] . $suffix;
            }
        }

        foreach ($this->childListsOf($node) as $children) {
            foreach ($children as $child) {
                $this->collectRoles($child, $roles);
            }
        }
    }

    /**
     * One node, validated — or null, where it names nothing the vocabulary
     * declares.
     *
     * @param mixed $node
     * @param list<string> $seenRoles
     * @return array<string, mixed>|null
     */
    private function node($node, array &$seenRoles): ?array
    {
        if (!is_array($node) || !is_string($node['type'] ?? null)) {
            return null;
        }

        $type = $node['type'];
        $layout = $this->layouts[$type] ?? null;
        $leaf = $this->nodes[$type] ?? null;

        if ($layout === null && $leaf === null) {
            return null;
        }

        $kept = ['type' => $type];

        // Only the keys this member declares survive. Everything else is a
        // param the vocabulary does not have, which under a configuration
        // model is the only shape an injection could take.
        $allowed = $layout !== null
            ? $layout['params']
            : array_merge($leaf['content'], $leaf['params']);

        foreach ($allowed as $key) {
            if (array_key_exists($key, $node)) {
                $kept[$key] = $key === 'link' ? $this->link($node[$key]) : $node[$key];
            }
        }

        $role = $node['role'] ?? null;

        if (
            $leaf !== null
            && $leaf['roles'] !== []
            && is_string($role)
            && in_array($role, $this->roles, true)
            && !in_array($role, $seenRoles, true)
        ) {
            $seenRoles[] = $role;
            $kept['role'] = $role;
        }

        if ($layout !== null) {
            foreach ($this->childKeysOf($layout['children']) as $key) {
                $kept[$key] = $this->children($node[$key] ?? [], $seenRoles);
            }
        }

        return $kept;
    }

    /**
     * @param mixed $children
     * @param list<string> $seenRoles
     * @return list<array<string, mixed>>
     */
    private function children($children, array &$seenRoles): array
    {
        $kept = [];

        foreach (is_array($children) ? $children : [] as $child) {
            $node = $this->node($child, $seenRoles);

            if ($node !== null) {
                $kept[] = $node;
            }
        }

        return $kept;
    }

    /**
     * A link inside a sentence, expressed as structure rather than markup.
     *
     * The scheme is validated HERE, at write, which is the one thing ADR 0013
     * asks PHP to do about a link: it closes `javascript:`, and it is honest
     * that it does not stop a link to a bad destination. An href that fails is
     * dropped and the link renders nothing, never a dead `#`.
     *
     * @param mixed $link
     * @return array<string, string>
     */
    private function link($link): array
    {
        if (!is_array($link)) {
            return [];
        }

        $kept = [];

        if (is_string($link['label'] ?? null)) {
            $kept['label'] = $link['label'];
        }

        $href = $link['href'] ?? null;

        if (is_string($href) && in_array(strtolower((string) parse_url($href, PHP_URL_SCHEME)), self::SAFE_SCHEMES, true)) {
            $kept['href'] = $href;
        }

        return $kept;
    }

    /**
     * @param mixed $tokens
     * @return array<string, string>
     */
    private function tokens($tokens): array
    {
        $kept = [];

        foreach (is_array($tokens) ? $tokens : [] as $name => $value) {
            // Values are strings and nothing else. A token lands as a CSS
            // custom property, so anything that is not a scalar has no
            // spelling there at all.
            if (in_array((string) $name, $this->tokens, true) && (is_string($value) || is_numeric($value))) {
                $kept[(string) $name] = (string) $value;
            }
        }

        return $kept;
    }

    /**
     * @param array<string, mixed> $node
     * @return list<list<mixed>>
     */
    private function childListsOf(array $node): array
    {
        $layout = $this->layouts[(string) ($node['type'] ?? '')] ?? null;

        if ($layout === null) {
            return [];
        }

        $lists = [];

        foreach ($this->childKeysOf($layout['children']) as $key) {
            $lists[] = is_array($node[$key] ?? null) ? array_values($node[$key]) : [];
        }

        return $lists;
    }

    /**
     * @return list<string>
     */
    private function childKeysOf(string $shape): array
    {
        return $shape === 'panes' ? self::PANES : ['children'];
    }

    /**
     * @param array<string, mixed> $manifest
     * @return array<string, mixed>
     */
    private static function section(array $manifest, string $name): array
    {
        $section = $manifest[$name] ?? [];

        return is_array($section) ? $section : [];
    }

    /**
     * @param mixed $values
     * @return list<string>
     */
    private static function strings($values): array
    {
        return array_values(array_filter(is_array($values) ? $values : [], 'is_string'));
    }
}

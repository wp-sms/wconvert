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
 * **One key is ADDED here rather than dropped, and it is the only one.** Every
 * leaf leaves with an `id` — its own where it had a usable one, a minted one
 * where it did not ({@see NodeIdentities}). That inverts the usual direction
 * for a reason worth stating: an id is what a translation is attached to, and
 * a tree that acquires ids only when someone remembers to write them is a tree
 * where some strings are addressable and others are not. Minting on the way in
 * makes it true of every tree this plugin stores, including the ones written
 * before the key existed — which is a data migration this does not have to run.
 *
 * @since 0.1.0
 */
final class TemplateVocabulary
{
    /** Where a layout keeps its children. `split` is the one with two. */
    private const PANES = ['start', 'end'];

    /**
     * @param array<string, array{children: string, params: list<string>}> $layouts
     * @param array<string, array{content: list<string>, copy: list<string>, params: list<string>, roles: list<string>}> $nodes
     * @param list<string> $tokens
     * @param list<string> $roles
     * @param list<string> $authoredRoles
     * @param list<string> $schemes
     * @param list<string> $fields
     * @param array<string, list<string>> $facets
     * @param string $identity The key a leaf carries to name itself, or '' where the manifest declares none.
     * @param array<string, mixed> $fieldOptions Constraints on the interest field's stable values and labels.
     */
    private function __construct(
        private readonly array $layouts,
        private readonly array $nodes,
        private readonly array $tokens,
        private readonly array $roles,
        private readonly array $authoredRoles,
        private readonly array $schemes,
        private readonly array $fields,
        private readonly array $facets = [],
        private readonly string $identity = '',
        private readonly array $fieldOptions = [],
    ) {
    }

    /**
     * The key every leaf carries to name itself — `id`.
     *
     * Declared in the manifest rather than hardcoded on both sides, for the
     * reason every other member of the vocabulary is: the admin has to strip it
     * when it duplicates a block, and a second spelling of the key is a second
     * place for it to drift ({@see NodeIdentities}).
     */
    public function identity(): string
    {
        return $this->identity;
    }

    /**
     * What a `field` node may capture.
     *
     * Read by the capture path, which has to require exactly the fields the
     * renderer DREW — `resources/renderer/src/render.ts` skips a field whose
     * name it has no kind for, and a server requiring an input the browser
     * never rendered refuses every submission of a form that could not contain
     * it. `tests/js/renderer-manifest-parity.test.ts` holds the renderer to
     * this same list, so reading it here is what puts both sides on one
     * source rather than on two that agree today.
     *
     * @return list<string>
     */
    public function fields(): array
    {
        return $this->fields;
    }

    /** @param mixed $options
     * @return list<array{value: string, label: string}>
     */
    public function choiceOptions($options): array
    {
        return ChoiceOptions::normalize($options, $this->fieldOptions);
    }

    /**
     * The schemes an `<a>` may carry.
     *
     * Exposed for the same reason as {@see self::fields()}: the [[Consent
     * Record]] is the wording exactly as SHOWN, and the renderer drops an
     * href outside this list and renders no anchor at all. A record composed
     * against a different list would assert wording nobody read.
     *
     * @return list<string>
     */
    public function schemes(): array
    {
        return $this->schemes;
    }

    /**
     * The facets a gallery OFFERS as filters, and what each one enumerates.
     *
     * ADR 0010's rule, read literally: a control that ENUMERATES reads its
     * enumeration from the manifest. The chip strip over the picker is such a
     * control, so the manifest declares which facets it draws and which values
     * each offers — and {@see TemplateFacets} derives exactly those keys from a
     * tree, with {@see \WConvert\Tests\Unit\Template\TemplateLabelParityTest}
     * failing in both directions.
     *
     * **It is not a list of every facet.** `act`, `asks_consent` and
     * `display_type` are derived and travel with an index entry, and none of
     * them is a chip — see {@see TemplateFacets} for why each is not.
     *
     * Unvalidated as VALUES, exactly as `choices` is: `shape` enumerates the
     * layouts the manifest already declares, and holding this to them is the
     * parity test's job rather than this class's.
     *
     * @return array<string, list<string>>
     */
    public function facets(): array
    {
        return $this->facets;
    }

    /**
     * Every Slot Role the vocabulary declares.
     *
     * Exposed for {@see SlotRoles}, which derives a `field` node's Roles from
     * what it captures and checks the result against this list rather than
     * asserting a naming convention holds. A field kind whose Roles nobody
     * declared then offers none, instead of a name only one file knows.
     *
     * @return list<string>
     */
    public function roles(): array
    {
        return $this->roles;
    }

    /**
     * The [[Slot Role]]s a [[Playbook]] may **not** supply.
     *
     * ========================================================================
     * THE SAME DECLARATION `authored` IS FOR A RULE PARAM, ONE MANIFEST OVER.
     * ========================================================================
     * {@see \WConvert\Rules\RuleVocabulary::authoredParamsOf()} marks the
     * params that name something only one site has — a post id, a term id, a
     * CSS selector — and that single mark is what refuses a Playbook carrying
     * one. A Role can be site-local in exactly the same way and for exactly the
     * same reason: `code_value` holds a coupon code that exists in one
     * merchant's WooCommerce and nowhere else, so a Playbook filling it would
     * ship a dead code to every install that used it.
     *
     * Declared in the manifest rather than listed in
     * {@see \WConvert\Playbook\PlaybookLibrary}, so the fact lives where both
     * runtimes already read and a second Role of this kind arrives enforced
     * rather than arriving as a rule somebody remembered to add.
     *
     * @return list<string>
     */
    public function authoredRoles(): array
    {
        return $this->authoredRoles;
    }

    /**
     * Which of a node type's keys are WORDS.
     *
     * The same source {@see self::withoutCopy()} strips against, read from the
     * other side: what a snapshot takes out is exactly what a [[Playbook]]
     * puts back. Two lists would be one place for a Role to bind to a key a
     * snapshot had already removed, which renders as an empty slot and says
     * nothing.
     *
     * @return list<string>
     */
    public function copyKeysOf(string $type): array
    {
        return $this->nodes[$type]['copy'] ?? [];
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
                'copy' => self::strings(is_array($entry) ? ($entry['copy'] ?? []) : []),
                'params' => self::strings(is_array($entry) ? ($entry['params'] ?? []) : []),
                'roles' => self::strings(is_array($entry) ? ($entry['roles'] ?? []) : []),
            ];
        }

        return new self(
            $layouts,
            $nodes,
            array_map('strval', array_keys(self::section($manifest, 'tokens'))),
            self::strings($manifest['roles'] ?? []),
            self::strings($manifest['authored_roles'] ?? []),
            self::strings($manifest['schemes'] ?? []),
            self::strings($manifest['fields'] ?? []),
            array_map(
                static fn ($values): array => self::strings($values),
                array_filter(self::section($manifest, 'facets'), 'is_array')
            ),
            is_string($manifest['identity'] ?? null) ? $manifest['identity'] : '',
            self::section($manifest, 'field_options'),
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
     * @return array{tree: array{v: int, steps: list<array<string, mixed>>, submissions: list<array<string, mixed>>}, tokens: array<string, string>}
     */
    public function normalize($template): array
    {
        $template = is_array($template) ? $template : [];
        $tree = $template['tree'] ?? [];
        $steps = is_array($tree) ? ($tree['steps'] ?? []) : [];

        $normalized = [];

        // Pre-scanned over the whole tree before a single node is rewritten, so
        // a leaf with no id cannot be minted one that a leaf further down
        // already holds ({@see NodeIdentities::in()}).
        $ids = NodeIdentities::in($steps, $this->identity);

        foreach (is_array($steps) ? $steps : [] as $step) {
            $node = is_array($step) && is_array($step['content'] ?? null) ? $this->node($step['content'], $ids) : null;

            if ($node !== null) {
                $normalized[] = [
                    'id' => is_string($step['id'] ?? null) ? $step['id'] : '',
                    'name' => is_string($step['name'] ?? null) ? mb_substr($step['name'], 0, 120) : '',
                    'kind' => is_string($step['kind'] ?? null) ? $step['kind'] : '',
                    'content' => $node,
                ];
            }
        }

        return [
            // Stamped with the vocabulary version that produced it, so a
            // narrowing change one day has a fact to migrate FROM rather than
            // a guess about what each stored design meant ({@see TemplateTree::VERSION}).
            'tree' => TemplateTree::stamped(['steps' => $normalized, 'submissions' => self::submissions($tree['submissions'] ?? [])]),
            'tokens' => $this->tokens($template['tokens'] ?? []),
        ];
    }

    /**
     * The same tree with every WORD taken out of it.
     *
     * **A Template does not carry copy.** The words come from the Playbook
     * that prefilled the Optin, or from the user, and whatever placeholder
     * text a Template carries exists so the gallery has something to show —
     * it "is never copied into an Optin" (CONTEXT.md, Template). That
     * boundary is what keeps the library small: copy is what makes an Optin
     * serve a particular Goal, so with the copy held elsewhere a Template is
     * goal-agnostic, and the gallery is a set of designs per Display Type
     * rather than a design for every pairing of Display Type and Goal.
     *
     * What survives is everything that is NOT words: the arrangement, the
     * params, the Slot Roles that say which words go where — and the image,
     * because "a template's image slot keeps the template's own asset or stays
     * empty" and Playbooks never supply one (ADR 0013). Which keys are words
     * is declared per node in the manifest rather than guessed at here.
     *
     * @param mixed $tree
     * @return array{v: int, steps: list<array<string, mixed>>, submissions: list<array<string, mixed>>}
     */
    public function withoutCopy($tree): array
    {
        $tree = is_array($tree) ? $tree : [];
        $steps = is_array($tree['steps'] ?? null) ? $tree['steps'] : [];
        $stripped = [];

        foreach ($steps as $step) {
            $node = is_array($step) ? $this->stripNode($step['content'] ?? null) : null;

            if ($node !== null) {
                $stripped[] = array_replace($step, ['content' => $node]);
            }
        }

        return TemplateTree::stamped(['steps' => $stripped, 'submissions' => self::submissions($tree['submissions'] ?? [])]);
    }

    /** @param mixed $input
     * @return list<array<string, mixed>>
     */
    private static function submissions($input): array
    {
        $result = [];
        foreach (is_array($input) ? $input : [] as $submission) {
            if (!is_array($submission)) { continue; }
            $result[] = [
                'id' => is_string($submission['id'] ?? null) ? $submission['id'] : '',
                'required' => ($submission['required'] ?? null) === true,
                'fields' => array_values(array_filter(is_array($submission['fields'] ?? null) ? $submission['fields'] : [], 'is_string')),
                'consents' => array_values(array_filter(is_array($submission['consents'] ?? null) ? $submission['consents'] : [], 'is_string')),
            ];
        }
        return $result;
    }

    /**
     * @param mixed $node
     * @return array<string, mixed>|null
     */
    private function stripNode($node): ?array
    {
        if (!is_array($node) || !is_string($node['type'] ?? null)) {
            return null;
        }

        $leaf = $this->nodes[$node['type']] ?? null;

        foreach ($leaf === null ? [] : $leaf['copy'] as $key) {
            unset($node[$key]);
        }

        foreach ($this->childKeysOf($this->layouts[$node['type']]['children'] ?? '') as $key) {
            if (array_key_exists($key, $node)) {
                $node[$key] = array_values(array_filter(array_map(
                    fn ($child): ?array => $this->stripNode($child),
                    is_array($node[$key]) ? $node[$key] : []
                )));
            }
        }

        return $node;
    }

    /**
     * One node, validated — or null, where it names nothing the vocabulary
     * declares.
     *
     * @param mixed $node
     * @return array<string, mixed>|null
     */
    private function node($node, NodeIdentities $ids): ?array
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
            if (!array_key_exists($key, $node)) {
                continue;
            }

            if ($key === 'options') {
                if ($type === 'field' && ($node['name'] ?? null) === 'interest') {
                    $kept[$key] = $this->choiceOptions($node[$key]);
                }
                continue;
            }

            if ($key === 'link') {
                $kept[$key] = $this->link($node[$key]);

                continue;
            }

            // A CTA's own destination, scheme-validated exactly as a link
            // inside a sentence is. It is the merchant's to type — the
            // settings panel offers it, because a click-metered Optin with no
            // href is a button that goes nowhere — so it is the merchant's to
            // get wrong, and `javascript:` is the way it gets wrong.
            if ($key === 'href') {
                $href = $this->href($node[$key]);

                if ($href !== null) {
                    $kept[$key] = $href;
                }

                continue;
            }

            /*
             * ================================================================
             * THE ONLY NESTED STRUCTURE A PARAM MAY BE, AND THERE ARE TWO.
             * ================================================================
             * Every other param is a scalar, so `$kept[$key] = $node[$key]`
             * below is safe by the shape of what it copies. A token bag is not
             * a scalar — it is a map — and copied verbatim it would reach
             * `element.style.setProperty('--wc-' + name, value)` in the
             * renderer carrying names nobody declared. That is a property-name
             * injection in the one place ADR 0010 says none exists, so it goes
             * through the same closure the DESIGN's tokens already go through:
             * an undeclared name is dropped, and a value that is not a scalar
             * has no spelling as a custom property at all.
             */
            /*
             * **`narrow` is the same bag at a second width**, so it takes the
             * same closure and the same drop-when-empty. Two keys rather than
             * one nested `{wide, narrow}` object, because the wide bag is what
             * every design already carries and every design already stored —
             * wrapping it would be a migration over every saved Optin to
             * express a key most designs never set.
             */
            if ($key === 'tokens' || $key === 'narrow') {
                $tokens = $this->tokens($node[$key]);

                if ($tokens !== []) {
                    $kept[$key] = $tokens;
                }

                continue;
            }

            $kept[$key] = $node[$key];
        }

        // Every leaf carries one, minted here where it has none. Layouts do
        // not: an id names a STRING for a translator, and a `stack` says
        // nothing (ADR 0010, amended).
        if ($leaf !== null && $this->identity !== '') {
            $kept[$this->identity] = $ids->claim($node[$this->identity] ?? null);
        }

        $role = $node['role'] ?? null;

        /*
         * ====================================================================
         * A ROLE REPEATS. IT IS NO LONGER UNIQUE ACROSS THE TREE (ADR 0051).
         * ====================================================================
         * This clause used to carry `!in_array($role, $seenRoles)`, and the
         * drop was silent: a second node claiming a Role kept the NODE and
         * lost the Role. What that cost is not "those words cannot be filled"
         * — {@see self::withoutCopy()} strips `text` from every text node at
         * snapshot and {@see SlotRoles::bind()} writes back only where a Role
         * binds, so a role-less paragraph reached a real Optin as an EMPTY
         * `<p>`. A three-benefit row showed one benefit and two blank lines,
         * while the gallery card looked right because the library entry keeps
         * its placeholder text.
         *
         * The names stay closed and the binding stays BY NAME, which is the
         * guarantee Roles exist for — words survive switching Template. What
         * changed is only that a name may be claimed more than once, and a
         * Playbook supplying a list fills them in tree order.
         */
        if (
            $leaf !== null
            && $leaf['roles'] !== []
            && is_string($role)
            && in_array($role, $this->roles, true)
        ) {
            $kept['role'] = $role;
        }

        if ($layout !== null) {
            foreach ($this->childKeysOf($layout['children']) as $key) {
                $kept[$key] = $this->children($node[$key] ?? [], $ids);
            }
        }

        return $kept;
    }

    /**
     * @param mixed $children
     * @return list<array<string, mixed>>
     */
    private function children($children, NodeIdentities $ids): array
    {
        $kept = [];

        foreach (is_array($children) ? $children : [] as $child) {
            $node = $this->node($child, $ids);

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

        $href = $this->href($link['href'] ?? null);

        if ($href !== null) {
            $kept['href'] = $href;
        }

        return $kept;
    }

    /**
     * One href, or null where its scheme is not one the vocabulary allows.
     *
     * The one thing ADR 0013 asks PHP to do about a link: it closes
     * `javascript:`, and it is honest that it does not stop a link to a bad
     * destination. Dropped rather than emptied, so the renderer draws no
     * anchor at all rather than a dead `#`.
     *
     * A scheme-less href — `/offers`, `#terms` — is kept. A relative URL names
     * a page on this site, which is the ordinary case for a CTA, and it can
     * express nothing a scheme can.
     *
     * @param mixed $href
     */
    private function href($href): ?string
    {
        if (!is_string($href) || $href === '') {
            return null;
        }

        $scheme = wp_parse_url($href, PHP_URL_SCHEME);

        if ($scheme === null || $scheme === false) {
            return $href;
        }

        return in_array(strtolower((string) $scheme), $this->schemes, true) ? $href : null;
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
     * Where a member keeps its children, or nothing where it keeps none.
     *
     * @return list<string>
     */
    private function childKeysOf(string $shape): array
    {
        return match ($shape) {
            'panes' => self::PANES,
            'list' => ['children'],
            default => [],
        };
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

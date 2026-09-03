<?php

/**
 * verify-templates.php — the design library, against the vocabulary that eats it.
 *
 *     php bin/verify-templates.php [tree ...]
 *
 * Exit 0 = every file survives registration intact, 1 = something did not.
 *
 * ============================================================================
 * AUTHORING A TEMPLATE HAS SIX SILENT FAILURES AND THIS IS THE FEEDBACK LOOP.
 * ============================================================================
 * ADR 0010 assumed designs come out of the builder's dev-only export, which is
 * why nothing on the way in ever had to explain itself: the export produces a
 * tree the panel already drew, so it cannot be wrong. A gallery worth having is
 * thirty designs, and thirty hand-written JSON files meet a validator whose
 * entire posture is *drop it and carry on* — correct at runtime, useless at a
 * keyboard.
 *
 * Three of the six actually cost a day each:
 *
 * - **A JSON syntax error skips the file entirely.** {@see JsonFile::read()}
 *   returns null and {@see BundledTemplates} never passes it to the library, so
 *   no {@see Rejection} is recorded and `Rejection::warn()` never fires. The
 *   design is simply not in the gallery, with nothing anywhere saying why.
 * - **A missing or misspelled `tree` key silently becomes a Pro upsell card.**
 *   No `tree` is the whole discriminator for *"a design this install did not
 *   get"* ({@see TemplateLibrary::from()}), so one typo turns a free design
 *   into an advertisement for itself — complete with a `Pro` badge and a
 *   *"See this design"* link to a page that does not exist.
 * - **A dropped Slot Role, node, param or token goes without a word.**
 *   `withoutCopy()` strips `text` from EVERY text node at snapshot and `bind()`
 *   writes back only where a Role binds, so a node that lost its Role reaches a
 *   real Optin as an empty `<p>`. The gallery card looks right, because the
 *   entry keeps its placeholder text.
 *
 * ============================================================================
 * IT DIFFS RATHER THAN RE-VALIDATING, SO IT CANNOT DRIFT FROM THE VALIDATOR.
 * ============================================================================
 * Every check below is *"what did {@see TemplateVocabulary::normalize()} keep,
 * and what did the file say?"* — the raw decode walked beside the normalised
 * one, node for node, key for key. Nothing here knows what a param is or which
 * Roles a `heading` may carry; asking the vocabulary is the only way this stays
 * true of a vocabulary it has not been updated for.
 *
 * `tests/unit/Template/TemplateLibraryTest.php` looked like the linter for this
 * and is not: it normalises an ALREADY-NORMALISED tree, so it asserts
 * idempotence and cannot fail for an authoring mistake.
 * `tests/unit/Template/LibraryLintTest.php` is the one that runs this program.
 *
 * ============================================================================
 * NO WORDPRESS, DELIBERATELY — UNLIKE EVERY OTHER `bin/verify-*.php`.
 * ============================================================================
 * The others prove a WordPress-facing line (a real `wp_timezone()`, a real
 * `$wpdb`) and are `wp eval-file` scripts for that reason. This one reads JSON
 * off disk and runs it through pure PHP, so requiring an install would be
 * requiring one to lint a text file — and an authoring check nobody can run
 * from the directory they are authoring in is an authoring check nobody runs.
 */

declare(strict_types=1);

use WConvert\Optin\DisplayType;
use WConvert\Support\Tier;
use WConvert\Template\BundledTemplates;
use WConvert\Template\ConvertingAct;
use WConvert\Template\TemplateTree;
use WConvert\Template\TemplateVocabulary;

require_once dirname(__DIR__) . '/vendor/autoload.php';

/*
 * The plugin's files guard themselves with `defined('ABSPATH') || exit`, and
 * the vocabulary reaches four WordPress functions. Each stub below is the real
 * function's documented behaviour for the arguments this path actually passes
 * — the same bargain `tests/bootstrap.php` makes, and for the same reason: a
 * class that needed more of WordPress than this is a class whose WordPress
 * touchpoints should have been passed in.
 */
if (!defined('ABSPATH')) {
    define('ABSPATH', '/');
}

if (!function_exists('wp_parse_url')) {
    /** @return array<string, int|string>|string|int|false|null */
    function wp_parse_url(string $url, int $component = -1)
    {
        return parse_url($url, $component);
    }
}

if (!function_exists('__')) {
    function __(string $text, string $domain = 'default'): string
    {
        return $text;
    }
}

/**
 * Every problem one file has, and the file it has them in.
 *
 * An object rather than a global for `bin/verify-lead-log.php`'s reason: `bin/`
 * is analysed at PHPStan level 7 like everything else, and a global mutated
 * inside a function is a value static analysis cannot follow.
 */
final class TemplateLint
{
    /** @var list<string> */
    public array $problems = [];

    /** @var list<string> */
    public array $inspected = [];

    /**
     * Which [[Slot Role]]s the manifest declares for each node type.
     *
     * Carried on the object rather than in a constant because `bin/` is
     * analysed at PHPStan level 7 like everything else, and a runtime `define()`
     * is a symbol static analysis cannot see. It rides here because {@see
     * TemplateLint} is already threaded through the whole walk.
     *
     * Read off the manifest rather than through the vocabulary, which does not
     * expose per-node Roles — the admin's own `structure/catalogue.ts` reads the
     * same section for the same reason.
     *
     * @param array<string, list<string>> $rolesByNode
     */
    public function __construct(
        public readonly array $rolesByNode = [],
    ) {
    }

    public function fault(string $file, string $said): void
    {
        $this->problems[] = sprintf('  ✗ %s: %s', $file, $said);
    }

    public function inspect(string $file): void
    {
        $this->inspected[] = $file;
    }
}

/**
 * Which keys of a node hold children, from the manifest rather than a list.
 *
 * {@see TemplateTree::CHILD_KEYS} is the union across every layout, which is
 * exactly right here: this walks a RAW tree, where a `split` may well have been
 * written with `children` by somebody who meant `start` — and reporting that as
 * a dropped key is the whole job.
 *
 * @param array<string, mixed> $node
 * @return list<string>
 */
function childKeysHeldBy(array $node): array
{
    return array_values(array_filter(
        TemplateTree::CHILD_KEYS,
        static fn (string $key): bool => is_array($node[$key] ?? null)
    ));
}

/**
 * The raw tree beside the normalised one, node for node.
 *
 * ============================================================================
 * ALIGNED BY ORDER, WHICH IS SOUND BECAUSE NORMALISE ONLY EVER DROPS.
 * ============================================================================
 * `normalize()` preserves order and never inserts, so walking both lists with
 * two cursors and matching on `type` is exact: a raw node whose type does not
 * match the normalised node under the cursor is a node that was dropped, and
 * every node after it still lines up. Comparing by index instead would report
 * every sibling after the first casualty as wrong too.
 *
 * @param list<mixed> $raw
 * @param list<array<string, mixed>> $kept
 */
function diffNodes(array $raw, array $kept, string $where, string $file, TemplateLint $lint): void
{
    $at = 0;

    foreach ($raw as $index => $node) {
        $here = $where . '[' . $index . ']';

        if (!is_array($node) || !is_string($node['type'] ?? null)) {
            $lint->fault($file, sprintf('%s is not a node — every node is an object with a `type`', $here));

            continue;
        }

        $match = $kept[$at] ?? null;

        if (!is_array($match) || ($match['type'] ?? null) !== $node['type']) {
            $lint->fault($file, sprintf(
                '%s is a `%s`, which the vocabulary does not declare — it was dropped, with the whole subtree under it',
                $here,
                $node['type']
            ));

            continue;
        }

        ++$at;
        diffNode($node, $match, $here . ' (' . $node['type'] . ')', $file, $lint);
    }
}

/**
 * One matched pair: which of the raw node's keys survived.
 *
 * @param array<string, mixed> $raw
 * @param array<string, mixed> $kept
 */
function diffNode(array $raw, array $kept, string $where, string $file, TemplateLint $lint): void
{
    $children = childKeysHeldBy($raw);

    foreach ($raw as $key => $value) {
        $key = (string) $key;

        if (in_array($key, $children, true) || array_key_exists($key, $kept)) {
            continue;
        }

        /*
         * A dropped `role` is called out by name because it is the one whose
         * cost is invisible: the node stays, the design still renders in the
         * gallery, and the words go missing only once a real Optin snapshots
         * it — `withoutCopy()` strips the text from every text node and
         * `bind()` writes back only where a Role binds, so what a visitor sees
         * is an empty paragraph (CONTEXT.md, Slot Role).
         */
        $lint->fault($file, $key === 'role'
            ? sprintf(
                '%s claims the Slot Role `%s`, which the vocabulary did not accept — it was dropped, so this slot reaches a real Optin as an empty element',
                $where,
                is_string($value) ? $value : gettype($value)
            )
            : sprintf('%s carries `%s`, which the vocabulary does not declare for it — it was dropped', $where, $key));
    }

    /*
     * AND A ROLE THAT SURVIVED AND SHOULD NOT HAVE. `normalize()` checks a
     * role against the vocabulary's WHOLE list rather than against the ones
     * the manifest declares for this node type, so a `text` node claiming
     * `cta_label` is kept — and binds, and puts a button's label into a
     * paragraph. That is a validator posture rather than a bug (the closed
     * list is what it exists to enforce), and it is an authoring mistake
     * nothing else will ever mention, which is exactly this program's job.
     *
     * Read off the manifest here rather than through the vocabulary, because
     * the vocabulary does not expose per-node Roles — the admin's own
     * `structure/catalogue.ts` reads the same section for the same reason.
     */
    $role = $kept['role'] ?? null;
    $suits = $lint->rolesByNode[is_string($kept['type'] ?? null) ? $kept['type'] : ''] ?? [];

    if (is_string($role) && $suits !== [] && !in_array($role, $suits, true)) {
        $lint->fault($file, sprintf(
            '%s claims the Slot Role `%s`, which the manifest declares for %s and not for this node type — it is kept, and binds the wrong words into it',
            $where,
            $role,
            implode('/', array_keys(array_filter(
                $lint->rolesByNode,
                static fn (array $roles): bool => in_array($role, $roles, true)
            ))) ?: 'no node type'
        ));
    }

    foreach ($children as $key) {
        $under = is_array($kept[$key] ?? null) ? $kept[$key] : [];

        diffNodes(
            array_values(is_array($raw[$key]) ? $raw[$key] : []),
            array_values(array_filter($under, 'is_array')),
            $where . '.' . $key,
            $file,
            $lint
        );
    }
}

/**
 * One file, from the bytes on disk to the entry the gallery would show.
 *
 * @param array<string, mixed> $ids Every id claimed so far, and the file that claimed it.
 */
function lintFile(string $file, string $label, TemplateVocabulary $vocabulary, TemplateLint $lint, array &$ids): void
{
    $lint->inspect($label);

    $raw = file_get_contents($file);

    if ($raw === false) {
        $lint->fault($label, 'cannot be read');

        return;
    }

    /** @var mixed $decoded */
    $decoded = json_decode($raw, true);

    /*
     * THE FAILURE THAT IS OTHERWISE TOTALLY SILENT. `JsonFile::read()` hands
     * back null and `BundledTemplates` never passes null to the library, so no
     * Rejection is ever constructed and nothing is warned. The design is
     * missing from the gallery and no log anywhere mentions it.
     */
    if (json_last_error() !== JSON_ERROR_NONE) {
        $lint->fault($label, sprintf(
            'is not valid JSON (%s) — the library skips it silently, with no rejection recorded and nothing logged',
            json_last_error_msg()
        ));

        return;
    }

    if (!is_array($decoded)) {
        $lint->fault($label, 'is not a JSON object');

        return;
    }

    $id = $decoded['id'] ?? null;

    if (!is_string($id) || $id === '') {
        $lint->fault($label, 'has no `id`, so the library refuses it as malformed');

        return;
    }

    if (isset($ids[$id])) {
        $lint->fault($label, sprintf('claims the id `%s`, which %s already claimed', $id, (string) $ids[$id]));
    }

    $ids[$id] = $label;

    if (!is_string($decoded['name'] ?? null)) {
        $lint->fault($label, 'has no `name`, so the gallery card is headed with its id');
    }

    /*
     * A TYPO HERE IS AN ADVERTISEMENT FOR THE DESIGN YOU JUST WROTE. No `tree`
     * is the discriminator for "a design this install did not get", so
     * `"trees"` or `"steps"` at the top level does not fail — it produces a
     * locked stub wearing a Pro badge and a dead preview link.
     */
    if (!is_array($decoded['tree'] ?? null)) {
        $lint->fault($label, 'has no `tree`, so the library files it as a LOCKED design — a Pro upsell card for a design this file contains');

        return;
    }

    $displayType = $decoded['display_type'] ?? null;

    if (!is_string($displayType) || DisplayType::tryFrom($displayType) === null) {
        $lint->fault($label, sprintf(
            '`display_type` is %s, which is not one of: %s',
            is_string($displayType) ? '`' . $displayType . '`' : 'missing',
            implode(', ', array_column(DisplayType::cases(), 'value'))
        ));
    }

    $tier = $decoded['tier'] ?? null;

    if (!is_string($tier) || Tier::tryFrom($tier) === null) {
        $lint->fault($label, '`tier` is missing or is not `free` or `pro`, so the library assumes free');
    }

    $normalized = $vocabulary->normalize($decoded);

    diffNodes(
        array_values(is_array($decoded['tree']['steps'] ?? null) ? $decoded['tree']['steps'] : []),
        $normalized['tree']['steps'],
        'steps',
        $label,
        $lint
    );

    foreach (is_array($decoded['tokens'] ?? null) ? $decoded['tokens'] : [] as $token => $value) {
        if (!array_key_exists((string) $token, $normalized['tokens'])) {
            $lint->fault($label, sprintf(
                'sets the token `%s`, which the vocabulary does not declare — it was dropped, so the design renders with the default',
                (string) $token
            ));
        }
    }

    /*
     * And the two questions registration itself asks, spelled by asking it:
     * exactly one converting act, and a step count that follows from it. A
     * design failing either IS recorded as a Rejection at runtime — this is
     * here so the author meets it at the keyboard rather than as a card
     * missing from a gallery.
     */
    $acts = ConvertingAct::offeredIn($normalized['tree']);
    $steps = count($normalized['tree']['steps']);

    if (count($acts) > 1) {
        $lint->fault($label, 'offers two converting acts — a submit AND a link. An Optin has exactly one');
    } elseif ($acts === []) {
        $lint->fault($label, 'offers no converting act, so an Optin on it would report zero forever');
    } elseif ($steps !== $acts[0]->steps()) {
        $lint->fault($label, sprintf(
            'converts on a %s, which takes %d step(s), and has %d',
            $acts[0]->value,
            $acts[0]->steps(),
            $steps
        ));
    }
}

// -----------------------------------------------------------------------------

/** @var list<string> $arguments */
$arguments = is_array($_SERVER['argv'] ?? null) ? array_values($_SERVER['argv']) : [];
$roots = array_slice($arguments, 1);

if ($roots === []) {
    $roots = [dirname(__DIR__), dirname(__DIR__) . '/pro'];
}

/** @var array<string, mixed> $manifest */
$manifest = (array) json_decode(
    (string) file_get_contents(dirname(__DIR__) . '/resources/templates/manifest.json'),
    true
);

$vocabulary = TemplateVocabulary::fromArray($manifest);

$lint = new TemplateLint(array_map(
    static fn ($node): array => array_values(array_filter(
        is_array($node) && is_array($node['roles'] ?? null) ? $node['roles'] : [],
        'is_string'
    )),
    array_filter(is_array($manifest['nodes'] ?? null) ? $manifest['nodes'] : [], 'is_array')
));

/** @var array<string, mixed> $ids */
$ids = [];

foreach ($roots as $root) {
    $directory = rtrim((string) $root, '/') . '/' . BundledTemplates::PATH;
    $files = glob($directory . '/*.json');

    echo sprintf("==> verify-templates: %s\n", $directory);

    /*
     * A DIRECTORY WITH NOTHING IN IT IS NOT A DIRECTORY WITH NOTHING WRONG IN
     * IT. Free's library is never empty, so an empty glob means the tree was
     * pointed at the wrong place — and "inspected nothing" reading as "clean"
     * is the failure ADR 0029 is about. Pro's tree is allowed to be absent
     * altogether, which is a different fact from being there and empty.
     */
    if ($files === false || $files === []) {
        if (is_dir($directory)) {
            $lint->fault($directory, 'holds no designs — nothing was inspected, so nothing is proven');
        } else {
            echo "  ! no library here, so nothing was inspected\n";
        }

        continue;
    }

    foreach ($files as $file) {
        lintFile($file, basename((string) $root) . '/' . basename($file), $vocabulary, $lint, $ids);
    }
}

echo sprintf("  · %d design(s) inspected\n", count($lint->inspected));

foreach ($lint->problems as $problem) {
    echo $problem . "\n";
}

if ($lint->problems !== []) {
    echo sprintf("\nverify-templates: %d problem(s).\n", count($lint->problems));

    exit(1);
}

echo "verify-templates: every design survives registration intact.\n";

exit(0);

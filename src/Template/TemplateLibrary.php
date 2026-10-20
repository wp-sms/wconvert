<?php

namespace WConvert\Template;

use WConvert\Support\Rejection;
use WConvert\Support\RejectionReason;
use WConvert\Support\Tier;

defined('ABSPATH') || exit;

/**
 * The shipped Templates — the gallery's contents, as data.
 *
 * A Template is the DESIGN of an Optin, with no words in it: it declares which
 * slots exist, how they are arranged and how they are styled, and the copy
 * comes from the Playbook that prefilled the Optin. Sample text supplies the
 * gallery examples and can be copied explicitly with "Use this design’s sample
 * content" (ADR 0075). Keeping
 * existing content remains the default.
 *
 * **An Optin takes a COPY.** This registry is not consulted at render time and
 * never appears in the payload: `template_id` is provenance, exactly as
 * `playbook_id` is, so improving an entry never restyles an Optin already
 * running on it and deleting one leaves every Optin it started untouched
 * (ADR 0010).
 *
 * Entries are JSON rather than PHP arrays, which is the opposite of the choice
 * ADR 0013 makes for Playbooks — and for the reason that decision gives: a
 * Playbook is nothing but words, so `wp i18n make-pot` not seeing a JSON
 * string ships an English-only library. A Template is structure with editable
 * sample copy; merchants may explicitly use it in a draft (ADR 0075).
 *
 * @since 0.1.0
 */
final class TemplateLibrary
{
    /**
     * @param array<string, array<string, mixed>> $templates Registered designs, with trees.
     * @param list<Rejection> $rejections
     */
    private function __construct(
        private readonly TemplateVocabulary $vocabulary,
        private readonly array $templates,
        private readonly array $rejections = [],
        private readonly ?\Closure $build = null,
    ) {
    }

    private ?self $loaded = null;

    /**
     * A library whose sources are not read until a consumer asks for data.
     *
     * Route registration constructs every REST controller, including the
     * authoring controllers, on public capture and beacon requests. Keeping
     * the deferral inside the library preserves those controllers' typed
     * dependencies while avoiding a directory scan for a route that will not
     * use the gallery. Only a successfully built library is retained; an
     * exception leaves the deferred instance retryable.
     *
     * @param \Closure(): self $build
     */
    public static function deferred(TemplateVocabulary $vocabulary, \Closure $build): self
    {
        return new self($vocabulary, [], [], $build);
    }

    /**
     * The library this install ships: the bundled designs.
     *
     * The convenience constructor over {@see self::from()}, kept because it is
     * what the container and every test calls and because "one ZIP" is still
     * the common case. What changed under it is that the glob is now one
     * {@see TemplateSource} among several rather than the only one there can be
     * — [[Pro]] composes its own beside these, and installed downloads are a
     * third (ADR 0043, ADR 0156). A design this install did not get is no
     * longer a bundled stub: it is a catalogue entry ({@see Catalog\TemplateCatalog}).
     */
    public static function fromDirectory(TemplateVocabulary $vocabulary, string $pluginDir = WCONVERT_DIR): self
    {
        return self::from($vocabulary, new BundledTemplates($pluginDir));
    }

    /**
     * Every source, composed, validated identically.
     *
     * ========================================================================
     * A SHIPPED TEMPLATE GETS NO EXEMPTION, AND NEITHER DOES A FETCHED ONE.
     * ========================================================================
     * Whatever produced a candidate, it is normalised against the vocabulary
     * and then asked {@see self::refuse()}. That is what makes the vocabulary
     * self-testing for the bundled set (ADR 0010) and what makes a *fetched*
     * set structurally bounded. Remote value/shape/media validation must happen
     * first in Catalog\PackValidator (ADR 0082); normalization alone is not a
     * security boundary: `normalize()` drops
     * every node, token, param and Slot Role outside the manifest, so a remote
     * index can deliver **content and never capability**, which is the
     * constraint issue #7 recorded.
     *
     * **Order decides collisions of id.** The first source to claim an id
     * keeps it and a later claim is a {@see RejectionReason::DuplicateId} — a
     * second entry silently replacing the first is a gallery that lost a card
     * with nothing to read.
     *
     * **The highest revision decides which copy of a DESIGN is current**
     * (ADR 0156). Bundled, Pro's and installed copies of one design share a
     * `design_key` and carry distinct ids, so every revision stays resolvable
     * for source baselines while exactly one — the highest, the first source
     * on a tie — is `catalog_current` and offered to new campaigns. That
     * replaces "first source wins", which let a stale bundled copy hide a
     * newer download.
     */
    public static function from(TemplateVocabulary $vocabulary, TemplateSource ...$sources): self
    {
        $templates = [];
        $rejections = [];

        foreach ($sources as $source) {
            foreach ($source->entries() as $candidate) {
                $id = is_string($candidate['id'] ?? null) ? $candidate['id'] : '';

                if ($id === '' || !is_array($candidate['tree'] ?? null)) {
                    $rejections[] = new Rejection($id, RejectionReason::Malformed);
                    continue;
                }

                if (isset($templates[$id])) {
                    $rejections[] = new Rejection($id, RejectionReason::DuplicateId);
                    continue;
                }

                $entry = self::read($id, $candidate, $vocabulary);
                $reason = self::refuse($entry['tree']);

                if ($reason !== null) {
                    $rejections[] = new Rejection($id, $reason);
                    continue;
                }

                $templates[$id] = $entry;
            }
        }

        $current = [];
        foreach ($templates as $id => $entry) {
            $key = $entry['design_key'];
            if (!isset($current[$key]) || $entry['revision'] > $templates[$current[$key]]['revision']) $current[$key] = $id;
        }
        foreach ($templates as $id => &$entry) {
            $entry['catalog_current'] = $current[$entry['design_key']] === $id;
        }
        unset($entry);

        ksort($templates);
        usort($rejections, static fn (Rejection $a, Rejection $b): int => strcmp($a->id, $b->id));

        foreach ($rejections as $rejection) {
            $rejection->warn(__METHOD__);
        }

        return new self($vocabulary, $templates, $rejections);
    }

    /**
     * Every entry, keyed by id.
     *
     * @return array<string, array<string, mixed>>
     */
    public function all(): array
    {
        $loaded = $this->materialized();
        if ($loaded !== $this) {
            return $loaded->all();
        }

        return $this->templates;
    }

    /**
     * Every entry this install refused, and why.
     *
     * Recorded rather than thrown, and rather than dropped in silence. One
     * malformed entry must not take the gallery down; an entry that simply
     * vanished from it looks exactly like a gallery that failed to load
     * ({@see Rejection}).
     *
     * @return list<Rejection>
     */
    public function rejections(): array
    {
        $loaded = $this->materialized();
        if ($loaded !== $this) {
            return $loaded->rejections();
        }

        return $this->rejections;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function find(string $id): ?array
    {
        $loaded = $this->materialized();
        if ($loaded !== $this) {
            return $loaded->find($id);
        }

        return $this->templates[$id] ?? null;
    }

    /**
     * Why this tree may not be registered, or null.
     *
     * **One converting act, exactly**, and a step count that follows from it.
     * A Template offering both a form and a click-through CTA is rejected here
     * rather than disambiguated at runtime, because an Optin with two
     * candidate Conversions has no honest number to report; one offering
     * neither reports zero forever, which is the same rule read the other way
     * (ADR 0020, CONTEXT.md Conversion).
     *
     * The step count is the act's, not the entry's: a submit-metered design
     * has two steps because the post-submit success state is a terminal step,
     * and a click-metered one has one because the click navigates the visitor
     * away and an interstitial is worse than the navigation it delays
     * (ADR 0010, corrected by ADR 0025).
     *
     * @param array{steps: list<array<string, mixed>>} $tree
     */
    private static function refuse(array $tree): ?RejectionReason
    {
        $acts = ConvertingAct::offeredIn($tree);

        if (count($acts) > 1) {
            return RejectionReason::TwoConvertingActs;
        }

        if ($acts === []) {
            return RejectionReason::NoConvertingAct;
        }

        $issue = TemplateTree::isGraph($tree)
            ? GraphCaptureContract::issue($tree, in_array('result', array_column($tree['steps'], 'kind'), true) ? 'find_match' : 'grow_email_list')
            : CaptureJourney::issue($tree);
        return $issue === null ? null : RejectionReason::WrongStepCount;
    }

    /**
     * Take the copy.
     *
     * **The snapshot is of the DESIGN, never of the words.** A Template
     * declares which slots exist, how they are arranged and how they are
     * styled; the copy comes from the Playbook that prefilled the Optin, or
     * from the user. Whatever placeholder text an entry carries is for the
     * gallery and "is never copied into an Optin" (CONTEXT.md, Template) — so
     * what lands here is the tree with every word taken out of it and the
     * Slot Roles left in, which is the seam a Playbook binds to.
     *
     * **It happens when, and only when, the design changes.** An Optin that
     * already holds a copy of the Template it names keeps it untouched
     * whatever the entry says now, so improving a Template never restyles an
     * Optin already running on it and `template_id` stays what CONTEXT.md
     * calls it: provenance. Repicking is the other case and is not the same
     * one — a merchant who chooses a different Template gets a fresh copy,
     * because otherwise the id would say one design and the payload would
     * render another (ADR 0010) — and the WORDS they had written are carried
     * across by [[Slot Role]], which is what those Roles are for.
     *
     * The renderer and the vocabulary are the other side of the arrangement.
     * They stay a LIVE reference, so a release that fixes accessibility or RTL
     * reaches every existing Optin, while a release that restyles a Template
     * reaches none.
     *
     * **`$pickedBefore` is the id the copy in `$config` was TAKEN FOR**, which
     * on an update is the stored row's and on a create is whatever the
     * incoming config asserts — a create has no stored row, so the config that
     * arrived is the prior state. That is what lets a prefilled Optin keep the
     * [[Playbook]] words already written into its copy: re-snapshotting on the
     * way in would strip them, because a snapshot is of the design and a
     * Template carries no copy.
     *
     * @param array<string, mixed> $config
     * @param string|null $pickedBefore The `template_id` the copy in `$config` was taken for.
     * @return array<string, mixed>
     */
    public function snapshotInto(array $config, ?string $pickedBefore = null): array
    {
        $id = $config['template_id'] ?? null;

        if (!is_string($id)) {
            return $config;
        }

        if (isset($config['template']) && $id === $pickedBefore) {
            return $config;
        }

        $loaded = $this->materialized();
        if ($loaded !== $this) {
            return $loaded->snapshotInto($config, $pickedBefore);
        }

        $entry = $this->find($id);

        // A `template_id` naming nothing this install ships is left alone
        // rather than blanked: the id is provenance, and an Optin that arrived
        // from an entry we no longer carry is not a broken Optin.
        if ($entry === null) {
            return $config;
        }

        // **The words survive switching Template** (CONTEXT.md, Playbook).
        // Copy is keyed to [[Slot Role]]s rather than to one Template's
        // structure precisely so it can be carried across, and a merchant who
        // has written their headline and then finds a design they prefer must
        // not have to retype every slot — that cost is what makes a gallery
        // something you use once.
        //
        // The TOKENS are not carried, and that is the same boundary read the
        // other way: a Role names what a slot SAYS, and tokens are what the
        // design LOOKS like. Picking a new design and keeping the old one's
        // colours is picking neither.
        $heldTemplate = $config['template'] ?? [];
        $carried = SlotRoles::copyFrom($config['template']['tree'] ?? [], $this->vocabulary);

        // Button destinations travel beside words. Pictures (including painted
        // backgrounds) are compared and matched by PictureTransfer below.
        $mine = MerchantsOwn::changedIn(
            $config['template']['tree'] ?? [],
            $pickedBefore === null ? [] : ($this->find($pickedBefore)['tree'] ?? null)
        );

        $config['template'] = [
            'tree' => MerchantsOwn::writeInto(
                SlotRoles::bind($this->vocabulary->withoutCopy($entry['tree']), $carried, $this->vocabulary),
                $mine
            ),
            'tokens' => $entry['tokens'],
        ];

        $config['template'] = PictureTransfer::prepare(
            $heldTemplate,
            $pickedBefore === null ? ['tree' => ['steps' => []], 'tokens' => []] : $this->find($pickedBefore),
            $config['template']
        )['template'];

        return $config;
    }

    private function materialized(): self
    {
        if ($this->build === null) {
            return $this;
        }

        if ($this->loaded === null) {
            $loaded = ($this->build)();
            if ($loaded === $this) {
                throw new \LogicException('A deferred template library cannot build itself.');
            }
            $this->loaded = $loaded;
        }

        return $this->loaded;
    }

    /**
     * One entry, validated against the vocabulary like anything else.
     *
     * A shipped Template gets no exemption, which is what makes the vocabulary
     * self-testing: an entry that normalises to something different from what
     * it says is an entry the settings panel could not have produced, and
     * `tests/unit/Template/TemplateLibraryTest.php` fails on it (ADR 0010).
     *
     * **`tier` is the ONE authored fact and `facets` is the one derived fact**,
     * and the two are opposite on purpose. A tier is a statement about
     * distribution that no tree can answer; every facet is read off the tree
     * precisely so it cannot drift from the design it describes
     * ({@see TemplateFacets}).
     *
     * @param array<string, mixed> $decoded
     * @return array<string, mixed>
     */
    private static function read(string $id, array $decoded, TemplateVocabulary $vocabulary): array
    {
        $normalized = $vocabulary->normalize($decoded);

        return [
            'id' => $id,
            'name' => is_string($decoded['name'] ?? null) ? $decoded['name'] : $id,
            // One Template serves exactly one Display Type (CONTEXT.md,
            // Template), so this is a property of the entry rather than
            // something the merchant picks afterwards.
            'display_type' => is_string($decoded['display_type'] ?? null) ? $decoded['display_type'] : 'popup',
            'tier' => self::tierOf($decoded, Tier::Free),
            'facets' => TemplateFacets::of($normalized['tree'], $vocabulary->fields(), $normalized['tokens']),
            'tree' => $normalized['tree'],
            'tokens' => $normalized['tokens'],
            // Which copy of a design this is, and the design it is a copy of
            // (ADR 0156). Every source supplies both; a bare entry — a test,
            // an import — is revision 1 of itself.
            'revision' => is_int($decoded['revision'] ?? null) && $decoded['revision'] >= 1 ? $decoded['revision'] : 1,
            'design_key' => is_string($decoded['design_key'] ?? null) ? $decoded['design_key'] : 'registered:' . $id,
        ];
    }

    /**
     * Which tier declared this entry, defaulting to the caller's expectation.
     *
     * `Tier` is shared rather than spelled per registry, so the rule manifest,
     * the [[Goal]] registry and the library cannot disagree about what "pro" is
     * spelled like (ADR 0015). An unrecognised word takes the default rather
     * than inventing a tier.
     *
     * @param array<string, mixed> $decoded
     */
    private static function tierOf(array $decoded, Tier $fallback): string
    {
        $tier = $decoded['tier'] ?? null;

        return (is_string($tier) ? Tier::tryFrom($tier) ?? $fallback : $fallback)->value;
    }
}

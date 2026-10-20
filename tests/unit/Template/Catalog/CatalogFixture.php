<?php

namespace WConvert\Tests\Unit\Template\Catalog;

use RuntimeException;

/**
 * A v3 catalogue served from memory (ADR 0156): designs, setups, a release,
 * its pages and the pointer, laid out exactly as the publisher lays them out.
 */
final class CatalogFixture
{
    public const BASE = 'https://catalog.example/v3/';
    public const SOURCE = self::BASE . 'manifest.json';

    /** @var list<array<string, mixed>> */
    public array $designs = [];
    /** @var list<array<string, mixed>> */
    public array $setups = [];
    /** @var list<array<string, mixed>> */
    public array $withdrawn = [];
    /** @var list<array<string, mixed>> */
    public array $collections = [];
    /** @var array<string, mixed> extra keys a later publisher may add */
    public array $extraPointer = [];
    /** @var array<string, int>|null */
    public ?array $popularity = null;
    /** @var positive-int */
    public int $designsPerPage = 1000;

    public function __construct(public readonly FakeCatalogTransport $http)
    {
    }

    /**
     * A design object built from a bundled design file.
     *
     * @param array<string, mixed> $changes merged into the object
     * @param array<string, mixed> $entry merged into its index entry
     * @return array{object: array<string, mixed>, entry: array<string, mixed>}
     */
    public function design(string $file, string $id, int $revision = 1, array $changes = [], array $entry = []): array
    {
        $source = json_decode((string) file_get_contents(WCONVERT_DIR . $file), true, 64, JSON_THROW_ON_ERROR);
        $tree = $source['tree'];
        $tree['v'] ??= 2;
        $object = array_replace(['schema' => 3, 'minor' => 0, 'id' => $id, 'revision' => $revision, 'name' => $source['name'],
            'display_type' => $source['display_type'], 'tier' => $source['tier'],
            'requires' => ['plugin' => '1.0.0', 'tree' => $tree['v'], 'capabilities' => ['capture-journey:1', 'template-tree:' . $tree['v']]],
            'assets' => [], 'tree' => $tree, 'tokens' => $source['tokens']], $changes);
        if (!isset($changes['requires'])) {
            // Declare exactly what the content uses, as the publisher does.
            $probe = ['schema' => 2, 'id' => $id, 'version' => '1.0.0', 'name' => $object['name'], 'description' => '',
                'requires' => ['plugin' => '1.0.0', 'tree' => $tree['v'], 'capabilities' => \WConvert\Template\Catalog\PackValidator::CAPABILITIES], 'assets' => [],
                'templates' => [['id' => $id, 'name' => $object['name'], 'display_type' => $object['display_type'], 'tier' => $object['tier'], 'tree' => $object['tree'], 'tokens' => $object['tokens']]]];
            $required = [];
            try {
                (new \WConvert\Template\Catalog\PackValidator(\WConvert\Template\TemplateManifest::load(), \WConvert\Template\TemplateVocabulary::fromManifest(), \WConvert\Support\Tier::Pro))->validate($probe, $required);
                $object['requires']['capabilities'] = array_values(array_unique(array_merge($required, ['campaign-starts:1'])));
            } catch (RuntimeException) { /* A deliberately broken fixture keeps its naive list. */ }
        }
        $design = ['object' => $object, 'entry' => array_replace(['id' => $id, 'revision' => $revision, 'name' => $object['name'], 'format' => $object['display_type'],
            'tier' => $object['tier'], 'requires' => ['plugin' => '1.0.0', 'capabilities' => $object['requires']['capabilities']],
            'facets' => ['act' => 'submit', 'captures' => ['email'], 'shape' => 'stack'], 'tags' => ['industry:food']], $entry)];
        $this->designs[] = $design;
        return $design;
    }

    /**
     * @param array<string, mixed> $design
     * @param array<string, mixed> $playbook
     */
    public function setup(string $id, array $design, array $playbook, int $revision = 1, string $tier = 'free'): void
    {
        $this->setups[] = ['object' => ['schema' => 3, 'minor' => 0, 'id' => $id, 'revision' => $revision, 'name' => $playbook['name'], 'tier' => $tier,
            'design' => ['id' => $design['object']['id'], 'revision' => $design['object']['revision']],
            'requires' => ['plugin' => '1.0.0', 'capabilities' => ['campaign-starts:1']],
            'playbook' => array_diff_key($playbook, array_flip(['id', 'name', 'template_id']))], 'tier' => $tier, 'goal' => $playbook['goal']];
    }

    /** Serve everything; returns the release digest. */
    public function publish(): string
    {
        $entries = [];
        foreach ($this->designs as $design) {
            $json = json_encode($design['object'], JSON_THROW_ON_ERROR);
            $sha = hash('sha256', $json);
            $this->http->responses[self::BASE . ($design['object']['tier'] === 'free' ? '' : 'premium/') . 'designs/' . $sha . '.json'] = $json;
            $entries[] = $design['entry'] + ['sha256' => $sha, 'bytes' => strlen($json)];
        }
        $setups = [];
        foreach ($this->setups as $setup) {
            $json = json_encode($setup['object'], JSON_THROW_ON_ERROR);
            $sha = hash('sha256', $json);
            $this->http->responses[self::BASE . ($setup['tier'] === 'free' ? '' : 'premium/') . 'setups/' . $sha . '.json'] = $json;
            $setups[] = ['id' => $setup['object']['id'], 'revision' => $setup['object']['revision'], 'sha256' => $sha, 'bytes' => strlen($json),
                'name' => $setup['object']['name'], 'goal' => $setup['goal'], 'tier' => $setup['tier'], 'design' => $setup['object']['design'],
                'requires' => $setup['object']['requires']];
        }
        $pages = [];
        foreach (array_chunk($entries, $this->designsPerPage) ?: [[]] as $i => $chunk) {
            $page = json_encode(['schema' => 3, 'designs' => $chunk, 'setups' => $i === 0 ? $setups : []], JSON_THROW_ON_ERROR);
            $pages[] = $this->serveIndex($page);
        }
        $release = json_encode(['schema' => 3, 'minor' => 0, 'pages' => $pages, 'collections' => $this->collections,
            'taxonomy' => ['industry' => [['id' => 'food', 'label' => 'Food & drink']]]], JSON_THROW_ON_ERROR);
        $releaseSha = hash('sha256', $release);
        $this->http->responses[self::BASE . 'releases/' . $releaseSha . '.json'] = $release;
        $pointer = array_replace(['schema' => 3, 'minor' => 0, 'release' => $releaseSha, 'withdrawn' => $this->withdrawn], $this->extraPointer);
        if ($this->popularity !== null) $pointer['popularity'] = $this->serveIndex(json_encode(['schema' => 3, 'downloads' => $this->popularity], JSON_THROW_ON_ERROR));
        $this->http->responses[self::SOURCE] = json_encode($pointer, JSON_THROW_ON_ERROR);
        $this->http->etags[self::SOURCE] = '"' . hash('crc32b', $this->http->responses[self::SOURCE]) . '"';
        return $releaseSha;
    }

    /** The served bytes of a design, by id and revision. */
    public function sha(string $id, int $revision = 1): string
    {
        foreach ($this->designs as $design) {
            if ($design['object']['id'] === $id && $design['object']['revision'] === $revision) return hash('sha256', json_encode($design['object'], JSON_THROW_ON_ERROR));
        }
        throw new RuntimeException('No such fixture design');
    }

    public function setupSha(string $id): string
    {
        foreach ($this->setups as $setup) {
            if ($setup['object']['id'] === $id) return hash('sha256', json_encode($setup['object'], JSON_THROW_ON_ERROR));
        }
        throw new RuntimeException('No such fixture setup');
    }

    private function serveIndex(string $json): string
    {
        $sha = hash('sha256', $json);
        $this->http->responses[self::BASE . 'index/' . $sha . '.json'] = $json;
        return $sha;
    }
}

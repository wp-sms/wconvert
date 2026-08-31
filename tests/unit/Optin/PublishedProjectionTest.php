<?php

namespace WConvert\Tests\Unit\Optin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Optin\PublishedProjection;
use WConvert\Rules\RuleVocabulary;

/**
 * The published set: the projection of every published, non-deleted Optin
 * (ADR 0003).
 *
 * The exclusion set is the part later tickets extend — a suspended Optin joins
 * it in the degradation ticket — so its shape is pinned here rather than left
 * to be rediscovered.
 */
#[CoversClass(PublishedProjection::class)]
final class PublishedProjectionTest extends TestCase
{
    private static function vocabulary(): RuleVocabulary
    {
        return RuleVocabulary::fromManifest(__DIR__ . '/../../..');
    }

    /**
     * @param iterable<array<string, mixed>> $rows
     * @return list<array<string, mixed>>
     */
    private static function build(iterable $rows): array
    {
        return PublishedProjection::build($rows, self::vocabulary());
    }

    /**
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private static function row(array $overrides = []): array
    {
        return array_merge([
            'id' => '01JQ0000000000000000000001',
            'goal' => 'grow_email_list',
            'config' => '{"targeting":{"include":[{"type":"url","value":"/draft"}]},"note":"working draft"}',
            'published_config' => '{"targeting":{"include":[{"type":"post","value":12}]},"display_type":"popup"}',
            'published_at' => '2026-08-24 10:00:00',
            'deleted_at' => null,
        ], $overrides);
    }

    public function testAPublishedRowProjectsItsTargetingSeparablyFromItsPayload(): void
    {
        $set = self::build([self::row()]);

        $this->assertSame([[
            'id' => '01JQ0000000000000000000001',
            // Beside the payload, never inside it: PHP resolves the cart URL
            // from it at enqueue and the browser never sees it (ADR 0025).
            'goal' => 'grow_email_list',
            'targeting' => ['include' => [['type' => 'post', 'value' => 12]]],
            'payload' => ['display_type' => 'popup', 'triggers' => [], 'conditions' => []],
        ]], $set);
    }

    /**
     * The set is derived from `published_config`, never from `config`. Leaking
     * the working draft onto the page is the whole reason the two columns are
     * separate — a merchant editing an Optin must not be publishing as they
     * type.
     */
    public function testTheWorkingDraftNeverReachesTheSet(): void
    {
        $set = self::build([self::row()]);

        $this->assertStringNotContainsString('working draft', json_encode($set) ?: '');
        $this->assertStringNotContainsString('/draft', json_encode($set) ?: '');
    }

    /**
     * The exclusion set, stated as one list because that is what later tickets
     * extend: a suspended Optin joins it in the degradation ticket.
     *
     * @return iterable<string, array{array<string, mixed>}>
     */
    public static function excludedRows(): iterable
    {
        yield 'never published' => [self::row(['published_config' => null, 'published_at' => null])];
        yield 'unpublished, last live version kept' => [self::row(['published_at' => null])];
        yield 'soft-deleted' => [self::row(['deleted_at' => '2026-08-24 11:00:00'])];
        yield 'soft-deleted while published' => [
            self::row(['deleted_at' => '2026-08-24 11:00:00', 'published_at' => '2026-08-24 10:00:00']),
        ];
    }

    /**
     * @param array<string, mixed> $row
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('excludedRows')]
    public function testExcludedRowsProduceNoEntry(array $row): void
    {
        $this->assertSame([], self::build([$row]));
    }

    public function testTheSetHoldsOnlyTheRowsThatSurvive(): void
    {
        $set = self::build([
            self::row(['id' => '01JQ0000000000000000000001']),
            self::row(['id' => '01JQ0000000000000000000002', 'published_at' => null]),
            self::row(['id' => '01JQ0000000000000000000003', 'deleted_at' => '2026-08-24 11:00:00']),
            self::row(['id' => '01JQ0000000000000000000004']),
        ]);

        $this->assertSame(
            ['01JQ0000000000000000000001', '01JQ0000000000000000000004'],
            array_column($set, 'id')
        );
    }

    /**
     * ADR 0005: rules are partitioned into `triggers` and `conditions` **at
     * publish time**, not at evaluation time. Kind is a fixed property of the
     * type, so the manifest already knows the answer and the client should not
     * re-derive it per page view.
     */
    /**
     * **The keys a payload may carry, pinned.**
     *
     * The projection ships `published_config` WHOLE, minus a denylist — which
     * fails open: a key added to `config` for the builder's benefit reaches
     * every visitor of every matching page unless somebody remembers to add it
     * to `PublishedProjection::NOT_SHIPPED`. `template_id` rode the payload
     * that way from the day it was written, and `destination_hint` did the
     * same the day it was.
     *
     * So the direction is reversed here: adding a key to the payload fails
     * this test until somebody writes it down, the same way
     * `SchemaTest::INDEX_BUDGET` makes a new index a decision in a diff. The
     * budget it protects is real — ≤2KB gzipped per page, measured
     * (ADR 0010).
     */
    public function testThePayloadCarriesOnlyTheKeysSomebodyWroteDown(): void
    {
        $config = [
            'targeting' => ['include' => [['type' => 'url', 'value' => '/*']]],
            'rules' => [['type' => 'page_load']],
            'template' => ['tree' => ['steps' => []], 'tokens' => []],
            'display_type' => 'popup',
            // The shape `resources/loader/src/types.ts` declares and
            // `frequency.ts` reads — which this fixture did NOT carry until
            // #83. It said `['once_per' => 'session']`, a key nothing has ever
            // read on either side, and the test passed anyway because it
            // asserts which keys travel rather than what is in them.
            'frequency' => ['maxImpressions' => 3],
            'priority' => 10,
            // Everything below is authoring state. None of it renders.
            'template_id' => 'centred-card',
            'playbook_id' => 'welcome-discount',
            'destination_hint' => ['types' => ['wsms'], 'fields' => ['email']],
        ];

        $payload = self::build([self::row(['published_config' => (string) json_encode($config)])])[0]['payload'];

        $this->assertSame(
            ['template', 'display_type', 'frequency', 'priority', 'triggers', 'conditions'],
            array_keys($payload),
            'a key reaching the browser is a decision; add it here and say why it renders'
        );
    }

    public function testTheFlatRuleListIsPartitionedIntoTheTwoClientAxes(): void
    {
        $set = self::build([self::row(['published_config' => (string) json_encode([
            'display_type' => 'popup',
            'rules' => [
                ['type' => 'device', 'in' => ['desktop']],
                ['type' => 'time_on_page', 'seconds' => 10],
            ],
        ])])]);

        $this->assertSame([
            'display_type' => 'popup',
            'triggers' => [['type' => 'time_on_page', 'seconds' => 10]],
            'conditions' => [['type' => 'device', 'in' => ['desktop']]],
        ], $set[0]['payload']);
    }

    /**
     * The flat list is CONSUMED, not shipped alongside its own partition. Two
     * spellings of the same rules in one payload is a second source of truth
     * the loader would have to choose between, and bytes on every page view.
     */
    public function testTheFlatRuleListDoesNotTravelBesideItsPartition(): void
    {
        $set = self::build([self::row(['published_config' => (string) json_encode([
            'rules' => [['type' => 'page_load']],
        ])])]);

        $this->assertArrayNotHasKey('rules', $set[0]['payload']);
    }

    /**
     * An Optin with no rules at all still carries both keys. The loader reads
     * "no triggers" as "never fires" (ADR 0012's zero-trigger loss), and it can
     * only read that from a key that is present and empty.
     */
    public function testBothAxesArePresentEvenWhenTheOptinHasNoRules(): void
    {
        $set = self::build([self::row(['published_config' => '{"display_type":"popup"}'])]);

        $this->assertSame(['triggers' => [], 'conditions' => []], array_intersect_key(
            $set[0]['payload'],
            ['triggers' => null, 'conditions' => null]
        ));
    }

    /**
     * The partition OVERWRITES. `published_config` is a config blob, so it can
     * carry a `triggers` key of its own — hand-written, or left by an older
     * shape — and PHP's `+` would let that win and discard the real answer
     * silently. The manifest decides what the two axes hold.
     */
    public function testAConfigCarryingItsOwnAxisKeysDoesNotBeatThePartition(): void
    {
        $set = self::build([self::row(['published_config' => (string) json_encode([
            'triggers' => [['type' => 'page_load']],
            'conditions' => 'whatever this is',
            'rules' => [['type' => 'time_on_page', 'seconds' => 10]],
        ])])]);

        $this->assertSame([
            'triggers' => [['type' => 'time_on_page', 'seconds' => 10]],
            'conditions' => [],
        ], $set[0]['payload']);
    }
}

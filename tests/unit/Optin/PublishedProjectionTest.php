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

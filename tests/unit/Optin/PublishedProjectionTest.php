<?php

namespace WConvert\Tests\Unit\Optin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Optin\PublishedProjection;

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
        $set = PublishedProjection::build([self::row()]);

        $this->assertSame([[
            'id' => '01JQ0000000000000000000001',
            'targeting' => ['include' => [['type' => 'post', 'value' => 12]]],
            'payload' => ['display_type' => 'popup'],
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
        $set = PublishedProjection::build([self::row()]);

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
        $this->assertSame([], PublishedProjection::build([$row]));
    }

    public function testTheSetHoldsOnlyTheRowsThatSurvive(): void
    {
        $set = PublishedProjection::build([
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
}

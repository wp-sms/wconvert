<?php

namespace WConvert\Tests\Unit\Milestone;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;
use WConvert\Milestone\EditedPart;
use WConvert\Milestone\FirstEdit;
use WConvert\Milestone\MilestoneStore;
use WConvert\Tests\Unit\Support\FakeOptionStore;

/**
 * ============================================================================
 * WHAT WAS STORED, READ BACK — AND WHAT IS NOT IN IT.
 * ============================================================================
 * `readme.txt` promises **no licence key, no analytics sent anywhere, and no
 * visitor identifier**, and #94 must not put an asterisk on that sentence.
 *
 * This is written the way `bin/verify-stats.php` writes the same class of
 * claim, and the shape is the point. That script does not assert that a sender
 * was never called — it plants two addresses in a request, drives the real
 * path, and then reads the OPTIONS TABLE back looking for them, key or value.
 * A test that mocks the transport and asserts it was idle passes on the day
 * somebody adds a second transport; a test that reads storage back and finds
 * nothing identifying in it does not care how the value would have travelled.
 *
 * So: every identifying thing a real WordPress request carries is planted
 * before the milestones are recorded, and then the whole store is serialised
 * and searched.
 *
 * **It asserts a presence too.** An absence-only check passes just as happily
 * against a store that recorded nothing at all, which is the same fail-closed
 * posture the source contract takes (ADR 0029) and the reason
 * `NoCountComesFromTheLeadLogTest` asserts its roots are IN the closure.
 */
#[CoversNothing]
final class NothingLeavesTheSiteTest extends TestCase
{
    /**
     * Everything about a request that names somebody, planted where WordPress
     * would really put it.
     *
     * The values are distinctive strings rather than realistic ones so that a
     * hit is unambiguous — `203.0.113.42` appearing in a serialised option can
     * only have come from `REMOTE_ADDR`.
     */
    private const IDENTIFYING = [
        'REMOTE_ADDR' => '203.0.113.42',
        'HTTP_X_FORWARDED_FOR' => '198.51.100.7',
        'HTTP_USER_AGENT' => 'Mozilla/5.0 (Macintosh) MilestoneProbe/1.0',
        'HTTP_REFERER' => 'https://example.test/a-page-they-came-from',
        'REQUEST_URI' => '/wp-admin/admin.php?page=wconvert',
        'HTTP_HOST' => 'the-merchants-shop.test',
    ];

    /** What a merchant types that is theirs, and what a visitor would be. */
    private const PERSONAL = [
        'merchant@the-merchants-shop.test',
        '+15550100',
        'wp_user_7',
    ];

    private FakeOptionStore $options;

    protected function setUp(): void
    {
        $this->options = new FakeOptionStore();

        foreach (self::IDENTIFYING as $key => $value) {
            $_SERVER[$key] = $value;
        }
    }

    protected function tearDown(): void
    {
        foreach (array_keys(self::IDENTIFYING) as $key) {
            unset($_SERVER[$key]);
        }
    }

    /** Everything the store holds, as one searchable string. */
    private function storedBytes(): string
    {
        return (string) json_encode($this->options->all());
    }

    /**
     * **The claim.** Drive the real recorders with a request that names
     * everybody, then read the store back and find none of them.
     */
    public function testNothingIdentifyingIsAnywhereInWhatWasStored(): void
    {
        $milestones = new MilestoneStore($this->options);

        $milestones->recordFirstPublish('2026-03-04');
        $milestones->recordFirstEdit(new FirstEdit('2026-03-05', 'welcome-discount', EditedPart::Rules));

        $stored = $this->storedBytes();

        foreach (self::IDENTIFYING as $key => $value) {
            $this->assertStringNotContainsString(
                $value,
                $stored,
                "a milestone stored {$key}; every one of these is a fact about the SITE (ADR 0017)"
            );
        }

        foreach (self::PERSONAL as $value) {
            $this->assertStringNotContainsString($value, $stored);
        }
    }

    /**
     * And the check can fail. A guard that cannot is a comment with a green
     * tick beside it.
     */
    public function testTheSearchWouldFindAnAddressIfOneWereStored(): void
    {
        $this->options->set('wconvert_pretend', ['seen_from' => self::IDENTIFYING['REMOTE_ADDR']]);

        $this->assertStringContainsString(self::IDENTIFYING['REMOTE_ADDR'], $this->storedBytes());
    }

    /**
     * **The presence half.** What a milestone IS: two days, a [[Playbook]] id
     * and one of five words. Asserted so that a store which recorded nothing
     * cannot pass the absences above by being empty.
     */
    public function testWhatIsStoredIsTwoDaysAPlaybookAndOneOfFiveWords(): void
    {
        $milestones = new MilestoneStore($this->options);

        $milestones->recordFirstPublish('2026-03-04');
        $milestones->recordFirstEdit(new FirstEdit('2026-03-05', 'welcome-discount', EditedPart::Rules));

        $this->assertSame(
            [
                MilestoneStore::OPTION => [
                    'first_edit' => [
                        'on' => '2026-03-05',
                        'playbook' => 'welcome-discount',
                        'part' => 'rules',
                    ],
                    'first_publish' => '2026-03-04',
                ],
            ],
            $this->options->all(),
            'the whole record, spelled out — a new key here is a new fact about the site'
        );
    }

    /**
     * **And no milestone class can transmit anything**, which is the half a
     * read of storage cannot see.
     *
     * Tokenised rather than grepped, for the reason
     * {@see \WConvert\Tests\Unit\Stats\NoCountComesFromTheLeadLogTest} gives:
     * these classes DISCUSS the rule at length — *"no analytics sent
     * anywhere"* is in two of their docblocks — and a check that flags the
     * explanation for a rule earns an exception list, which is the one thing
     * it must never acquire.
     */
    public function testNoMilestoneClassNamesAWayOffTheSite(): void
    {
        $outbound = [
            'wp_remote_get',
            'wp_remote_post',
            'wp_remote_request',
            'wp_remote_head',
            'wp_safe_remote_get',
            'wp_safe_remote_post',
            'wp_safe_remote_request',
            'curl_init',
            'curl_exec',
            'fsockopen',
            'stream_socket_client',
            'file_get_contents',
            'fopen',
        ];

        $offenders = [];

        foreach ($this->milestoneSources() as $file) {
            foreach (self::functionsCalledIn($file) as $line => $called) {
                if (in_array($called, $outbound, true)) {
                    $offenders[] = basename($file) . ':' . $line . ' ' . $called;
                }
            }
        }

        $this->assertSame(
            [],
            $offenders,
            'a milestone is a local, site-owned fact; readme.txt promises no analytics are sent anywhere'
        );
    }

    /**
     * The scan is real — an empty one is a tree this check cannot speak for.
     */
    public function testTheScanActuallyReadsTheMilestoneModule(): void
    {
        $names = array_map('basename', $this->milestoneSources());

        sort($names);

        $this->assertSame(
            ['EditedPart.php', 'FirstEdit.php', 'MilestoneStore.php', 'Milestones.php'],
            $names
        );
    }

    /**
     * @return list<string>
     */
    private function milestoneSources(): array
    {
        $files = glob(dirname(__DIR__, 3) . '/src/Milestone/*.php');

        return $files === false ? [] : $files;
    }

    /**
     * Every function this file's CODE calls, by line — comments dropped.
     *
     * @return array<int, string>
     */
    private static function functionsCalledIn(string $file): array
    {
        $tokens = array_values(array_filter(
            token_get_all((string) file_get_contents($file)),
            static fn ($token): bool => !is_array($token)
                || !in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)
        ));

        $called = [];

        foreach ($tokens as $index => $token) {
            if (is_array($token) && $token[0] === T_STRING && ($tokens[$index + 1] ?? null) === '(') {
                $called[$token[2]] = $token[1];
            }
        }

        return $called;
    }
}

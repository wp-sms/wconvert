<?php

namespace WConvert\Tests\Unit\Contract;

use PHPUnit\Framework\TestCase;
use WConvert\Tests\Unit\Support\PhpSource;

/**
 * ============================================================================
 * FREE'S CAPTURE PATH MAKES NO OUTBOUND HTTP REQUEST, AND IT NEVER WRITES A
 * [[Contact]]'s LIFECYCLE STATE.
 * ============================================================================
 * Two promises, one file, because they are the same promise about the same
 * code: what free's [[Destination]]s may reach, and what they may do when they
 * get there.
 *
 * **The first is what `readme.txt` prints in bold** — *"no account, no
 * phone-home"* — and it is ADR 0007's tier line drawn as code rather than as
 * policy: a Destination that calls out over HTTP is [[Pro]]'s, and free
 * therefore registers exactly three types that are each in-process for the
 * same reason. WSMS is a sibling plugin in this process, `wp_mail()` is
 * WordPress's own, and MailPoet stores its subscribers in this database. That
 * is the whole argument that admits MailPoet to free (#87), so it deserves an
 * assertion rather than a code review.
 *
 * **The second is ADR 0022 at the one place a fake cannot see it.** MailPoet's
 * public `subscribeToLists()` sets a non-subscribed subscriber's global status
 * on the way past, so a well-meaning simplification of
 * {@see \WConvert\Destination\MailPoet\WpMailPoetSubscribers} — replacing four
 * container lookups with the one documented facade call — would silently
 * resurrect everybody who unsubscribed. No test written against a fake can
 * catch that, because the fake is on the far side of the seam that changed.
 *
 * **Both read SOURCE rather than behaviour**, for the reason
 * {@see NoLicenceOnTheFrontEndTest} gives: what they guard against is a line
 * someone ADDS, and no assertion about output can see a rule that is
 * currently being kept. Comments are stripped first ({@see PhpSource}),
 * because this codebase explains at length why it does not do these things and
 * the explanation must not read as the violation.
 *
 * **Scoped to the capture path and its dispatch, not to all of `src/`.**
 * ADR 0043 leaves room for a WConvert-hosted template index over the
 * `TemplateSource` seam, transient-cached and disclosed in `readme.txt` — an
 * admin-time library the merchant asked for, which is a different
 * conversation from a capture that phones home. A total assertion would refuse
 * that on this test's authority rather than on a decision anybody took.
 */
final class TheFreeCapturePathStaysInProcessTest extends TestCase
{
    /**
     * Everything a capture reaches: the [[Lead]] write, the queue it puts a
     * job on, the worker that runs it, every free Destination type, and the
     * counters the whole thing moves.
     */
    private const CAPTURE_PATH = ['src/Lead', 'src/Destination', 'src/Queue', 'src/Stats'];

    /**
     * Every way PHP or WordPress reaches the network, by the name it is
     * spelled with.
     *
     * `file_get_contents` and `fopen` are here **unqualified**, which is
     * deliberately wider than the two that take a URL: neither belongs on a
     * capture path that touches no files at all, so the wider rule costs
     * nothing and closes the reading where a scheme arrives in a variable.
     */
    private const OUTBOUND = [
        'wp_remote_get',
        'wp_remote_post',
        'wp_remote_head',
        'wp_remote_request',
        'wp_safe_remote_get',
        'wp_safe_remote_post',
        'wp_safe_remote_head',
        'wp_safe_remote_request',
        'WP_Http',
        'curl_init',
        'curl_exec',
        'fsockopen',
        'stream_socket_client',
        'file_get_contents',
        'fopen',
    ];

    /**
     * MailPoet's own writes that move a person's lifecycle state.
     *
     * `subscribeToLists` is the one that matters and the rest are its
     * neighbours: a list membership is only ever ADDED, so the calls that
     * remove one are as absent as the calls that confirm one (ADR 0016,
     * ADR 0022).
     */
    private const MAILPOET_LIFECYCLE_WRITES = [
        'subscribeToLists',
        'subscribeToList',
        'unsubscribeFromLists',
        'unsubscribeFromList',
        'unsubscribe',
        'updateSubscriber',
        'setStatus',
    ];

    public function testNothingOnTheCapturePathReachesTheNetwork(): void
    {
        $found = [];

        foreach ($this->capturePathFiles() as $file) {
            $code = PhpSource::code($file);

            foreach (self::OUTBOUND as $call) {
                if (preg_match('/\b' . preg_quote($call, '/') . '\b/', $code) === 1) {
                    $found[] = basename($file) . ' names ' . $call;
                }
            }
        }

        self::assertSame(
            [],
            $found,
            "free's capture path must reach nothing over the network — that is why its Destinations are free (ADR 0007)"
        );
    }

    /**
     * The MailPoet adapter, specifically.
     *
     * It is the file the rule is easiest to break in and the only one where
     * breaking it is a plausible clean-up rather than a mistake — MailPoet's
     * facade offers exactly the method this refuses, and it is the obvious
     * one to reach for.
     */
    public function testTheMailPoetAdapterWritesNoLifecycleState(): void
    {
        $code = PhpSource::code(
            dirname(__DIR__, 3) . '/src/Destination/MailPoet/WpMailPoetSubscribers.php'
        );

        foreach (self::MAILPOET_LIFECYCLE_WRITES as $call) {
            self::assertDoesNotMatchRegularExpression(
                '/\b' . preg_quote($call, '/') . '\b/',
                $code,
                sprintf(
                    'the MailPoet adapter names %s(), which writes state the owning system owns (ADR 0022)',
                    $call
                )
            );
        }

        // And the write it DOES make is the status-preserving one, so this
        // test cannot be satisfied by an adapter that stopped adding lists.
        self::assertStringContainsString('subscribeToSegments', $code);
    }

    /**
     * @return list<string>
     */
    private function capturePathFiles(): array
    {
        $root = dirname(__DIR__, 3);
        $files = [];

        foreach (self::CAPTURE_PATH as $directory) {
            $found = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($root . '/' . $directory, \FilesystemIterator::SKIP_DOTS)
            );

            foreach ($found as $file) {
                if ($file instanceof \SplFileInfo && $file->getExtension() === 'php') {
                    $files[] = $file->getPathname();
                }
            }
        }

        // A scan that inspected nothing is a scan that proves nothing — the
        // same fail-closed posture bin/verify-source-contract.sh takes.
        self::assertNotEmpty($files);

        return $files;
    }
}

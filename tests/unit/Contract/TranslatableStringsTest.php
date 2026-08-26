<?php

namespace WConvert\Tests\Unit\Contract;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Every translatable string is ONE STRING LITERAL.
 *
 * `wp i18n make-pot` extracts a literal and not an expression, so
 * `__('first half ' . 'second half', 'wconvert')` puts nothing in the POT at
 * all: the sentence is not merely awkward to translate, it is **absent from
 * the catalogue**, and the string ships English-only on every install in every
 * locale. Nothing at runtime says so — `__()` returns the concatenation
 * unchanged and the page looks right, which is why this went unnoticed through
 * seven Playbooks and three privacy paragraphs until wp.org's own Plugin Check
 * read the source
 * ([#60](https://github.com/navidkashani/wconvert/issues/60)).
 *
 * **Held here rather than left to the release gate.** Plugin Check runs at
 * release, needs Docker and takes minutes; this is a token scan that runs on
 * every pull request, so the sentence that cannot be translated is caught by
 * whoever wrote it. It is the same argument `bin/verify-source-contract.sh`
 * makes for the free contract (ADR 0029) — a property of the source text is
 * cheapest to prove against the source text.
 *
 * {@see \WConvert\Tests\Unit\Playbook\BundledPlaybooksTest::testEveryShippedWordIsTranslatable()}
 * is the narrower half: it walks the PARSED library, so it also catches a word
 * that reached a Playbook without going through `__()` at all — which no scan
 * of call sites can see.
 */
#[CoversNothing]
final class TranslatableStringsTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    /**
     * Where shipped PHP lives, free's tree and Pro's.
     *
     * Both, because the rule is a property of translation tooling rather than
     * of either artifact: a concatenated `__()` in `pro/src/` is exactly as
     * untranslatable, and Pro's release runs the same checker.
     *
     * The same scope `bin/verify-source-contract.sh` walks — `src/`,
     * `resources/` and **the plugin files at the tree root**, which is the
     * whole of what ADR 0029 calls free's tree. The root files ship and are
     * the first thing every install executes: `wconvert.php` alone holds an
     * `esc_html__()` in the notice that fires when the autoloader is missing,
     * so a scan scoped to subdirectories would leave the earliest translatable
     * string in the plugin entirely unread.
     */
    private const DIRECTORIES = ['src', 'resources', 'pro/src', 'pro/resources'];

    private const ROOTS = ['', 'pro'];

    /**
     * The gettext calls WConvert uses, with how many leading arguments of each
     * are text rather than context or a count.
     *
     * `_n()` takes TWO — a plural form spelled as a concatenation is as
     * invisible to `make-pot` as a singular one, and it is the easier of the
     * two to write by accident because it is the second argument along.
     *
     * WConvert calls four of these twelve today. The rest are listed anyway
     * because the cost is a line each and the alternative is a check that
     * silently stops covering a call the day somebody reaches for `_x()` —
     * which is precisely how the ten findings this file exists for survived.
     */
    private const TEXT_ARGUMENTS = [
        '__' => 1,
        '_e' => 1,
        '_x' => 1,
        '_ex' => 1,
        '_n' => 2,
        '_nx' => 2,
        'esc_html__' => 1,
        'esc_html_e' => 1,
        'esc_html_x' => 1,
        'esc_attr__' => 1,
        'esc_attr_e' => 1,
        'esc_attr_x' => 1,
    ];

    /**
     * @return array<string, array{string}>
     */
    public static function shippedPhpFiles(): array
    {
        $paths = [];

        foreach (self::DIRECTORIES as $directory) {
            $root = self::PLUGIN_DIR . '/' . $directory;

            if (!is_dir($root)) {
                continue;
            }

            /** @var iterable<\SplFileInfo> $found */
            $found = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root));

            foreach ($found as $file) {
                if ($file->isFile() && $file->getExtension() === 'php') {
                    $paths[] = $file->getPathname();
                }
            }
        }

        // Opportunistic, exactly as collect_root_php() is: it scans the plugin
        // files that are there and does not insist any of them exists. The
        // fail-closed line is the one below, drawn across the whole scan.
        foreach (self::ROOTS as $root) {
            $paths = array_merge($paths, glob(rtrim(self::PLUGIN_DIR . '/' . $root, '/') . '/*.php') ?: []);
        }

        $files = [];

        foreach ($paths as $path) {
            // Keyed on the path RELATIVE TO THE PLUGIN, never the basename.
            // Three basenames repeat across these roots — Bootstrap.php,
            // Connection.php and constants.php — so a basename key silently
            // dropped three files from the scan and the fail-closed guard
            // below could not see it, because the provider was not empty.
            $files[str_replace(self::PLUGIN_DIR . '/', '', $path)] = [$path];
        }

        // Fail closed, on the posture bin/verify-source-contract.sh takes: a
        // scan that inspected nothing must not read as a scan that found
        // nothing. An empty provider is a green suite proving zero files.
        self::assertNotSame([], $files, 'the translatable-string scan found no PHP to read');

        return $files;
    }

    #[DataProvider('shippedPhpFiles')]
    public function testEveryTranslatableStringIsASingleLiteral(string $path): void
    {
        // Every offending call, not the first: they arrive in batches — three
        // of the ten in #60 sat in one file — and a report naming one per run
        // costs a run per finding to see the shape.
        $this->assertSame(
            [],
            array_map(
                static fn (array $call): string => sprintf('line %d: %s()', $call['line'], $call['function']),
                self::concatenationsIn($path)
            ),
            sprintf(
                '%s passes an expression where a text argument must be one string literal. `make-pot` '
                    . 'extracts a literal and not an expression, so those strings reach no catalogue.',
                str_replace(self::PLUGIN_DIR . '/', '', $path)
            )
        );
    }

    /**
     * Every gettext call in one file whose text argument is not a lone literal.
     *
     * Tokenised rather than matched with a regex. A `__(` inside a comment or
     * a string reads identically to a call, and this file's own prose is full
     * of both — the thing that tells them apart is the tokeniser PHP already
     * ships.
     *
     * @return list<array{function: string, line: int}>
     */
    private static function concatenationsIn(string $path): array
    {
        $tokens = array_values(array_filter(
            token_get_all((string) file_get_contents($path)),
            static fn ($token): bool => !is_array($token)
                || !in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)
        ));

        $found = [];

        foreach ($tokens as $index => $token) {
            if (!is_array($token)) {
                continue;
            }

            // `\__('a' . 'b')` is the same call one backslash away, and PHP 8
            // tokenises it as T_NAME_FULLY_QUALIFIED rather than T_STRING — so
            // matching only T_STRING is a one-character hole in the check.
            if ($token[0] !== T_STRING && $token[0] !== T_NAME_FULLY_QUALIFIED) {
                continue;
            }

            $arguments = self::TEXT_ARGUMENTS[ltrim($token[1], '\\')] ?? null;

            if ($arguments === null || ($tokens[$index + 1] ?? null) !== '(') {
                continue;
            }

            // `$this->__(...)`, `$maybe?->__(...)` and `Foo::__(...)` are
            // somebody else's method and not a gettext call at all.
            $before = $tokens[$index - 1] ?? null;
            $notACall = [T_OBJECT_OPERATOR, T_NULLSAFE_OBJECT_OPERATOR, T_DOUBLE_COLON, T_FUNCTION];

            if (is_array($before) && in_array($before[0], $notACall, true)) {
                continue;
            }

            $at = $index + 2;

            for ($argument = 0; $argument < $arguments; $argument++) {
                $text = $tokens[$at] ?? null;
                $next = $tokens[$at + 1] ?? null;

                // One literal, and the argument ends right after it —  at a
                // comma, or at the closing paren when it is the call's last.
                // `__('x')` with no domain is a different bug and not this
                // file's, and a check that cries wolf is a check that gets
                // deleted.
                //
                // Anything else — a concatenation, a variable, an interpolated
                // double-quoted string — is an expression make-pot cannot
                // read. **A named argument is flagged deliberately**, not
                // missed: WP-CLI's extractor reads gettext arguments
                // POSITIONALLY, so `__(text: 'x', domain: 'wconvert')` is as
                // absent from the catalogue as a concatenation is.
                if (!is_array($text) || $text[0] !== T_CONSTANT_ENCAPSED_STRING
                    || ($next !== ',' && $next !== ')')) {
                    $found[] = ['function' => $token[1], 'line' => is_array($text) ? $text[2] : $token[2]];
                    break;
                }

                $at += 2;
            }
        }

        return $found;
    }
}

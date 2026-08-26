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
     */
    private const ROOTS = ['src', 'resources', 'pro/src', 'pro/resources'];

    /**
     * The gettext calls WConvert uses, with how many leading arguments of each
     * are text rather than context or a count.
     *
     * `_n()` takes TWO — a plural form spelled as a concatenation is as
     * invisible to `make-pot` as a singular one, and it is the easier of the
     * two to write by accident because it is the second argument along.
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
        $files = [];

        foreach (self::ROOTS as $root) {
            $directory = self::PLUGIN_DIR . '/' . $root;

            if (!is_dir($directory)) {
                continue;
            }

            /** @var iterable<\SplFileInfo> $found */
            $found = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($directory));

            foreach ($found as $file) {
                if ($file->isFile() && $file->getExtension() === 'php') {
                    $files[$root . '/' . $file->getBasename()] = [$file->getPathname()];
                }
            }
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
            if (!is_array($token) || $token[0] !== T_STRING) {
                continue;
            }

            $arguments = self::TEXT_ARGUMENTS[$token[1]] ?? null;

            if ($arguments === null || ($tokens[$index + 1] ?? null) !== '(') {
                continue;
            }

            // `$this->__(...)` and `Foo::__(...)` are somebody else's method.
            $before = $tokens[$index - 1] ?? null;

            if (is_array($before) && in_array($before[0], [T_OBJECT_OPERATOR, T_DOUBLE_COLON, T_FUNCTION], true)) {
                continue;
            }

            $at = $index + 2;

            for ($argument = 0; $argument < $arguments; $argument++) {
                $text = $tokens[$at] ?? null;
                $next = $tokens[$at + 1] ?? null;

                // One literal, and the argument ends right after it. Anything
                // else — a concatenation, a variable, an interpolated
                // double-quoted string — is an expression make-pot cannot read.
                if (!is_array($text) || $text[0] !== T_CONSTANT_ENCAPSED_STRING || $next !== ',') {
                    $found[] = ['function' => $token[1], 'line' => is_array($text) ? $text[2] : $token[2]];
                    break;
                }

                $at += 2;
            }
        }

        return $found;
    }
}

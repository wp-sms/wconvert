<?php

namespace WConvert\Tests\Unit\Milestone;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/**
 * ============================================================================
 * THE FIRST-EDIT MILESTONE IS STAMPED AT THE ROUTE. THIS IS WHAT MAKES THAT
 * SAFE.
 * ============================================================================
 * The activation milestone sits inside
 * {@see \WConvert\Optin\OptinRepository::publish()} on purpose: that method IS
 * the event, so a stamp written in a REST controller instead would be one a
 * WP-CLI command or a bulk action silently missed (ADR 0057).
 *
 * **The mirror rule would put the first edit in `saveDraft()`, and it does
 * not.** Working out which suggestion a merchant overrode means reading a
 * [[Template]]'s words by [[Slot Role]], which needs
 * {@see \WConvert\Template\TemplateVocabulary} — a whole design grammar handed
 * to a class whose job is projections and columns, to serve one date. So the
 * diff stays where the grammar already is.
 *
 * That leaves exactly the risk ADR 0057 named, and this is the guard rather
 * than the promise: **the route is the only writer of a draft**, so a second
 * one cannot arrive quietly and take the milestone with it.
 *
 * Tokenised rather than grepped, for the reason
 * {@see \WConvert\Tests\Unit\Stats\NoCountComesFromTheLeadLogTest} gives at
 * length: the rule is DISCUSSED in prose in both files it is about, and a
 * check that flags the explanation for a rule earns an exception list — which
 * is the one thing it must never acquire.
 */
#[CoversNothing]
final class TheRouteIsTheOnlyEditorTest extends TestCase
{
    /** The one class allowed to call it, and the one that records the milestone. */
    private const THE_EDITOR = 'src/Rest/OptinController.php';

    private static function root(): string
    {
        return dirname(__DIR__, 3);
    }

    /**
     * Every shipped PHP file, in both trees.
     *
     * @return list<string>
     */
    private static function shippedSources(): array
    {
        $files = [];

        foreach (['/src', '/pro/src', '/pro/modules'] as $tree) {
            if (!is_dir(self::root() . $tree)) {
                continue;
            }

            $directory = new \RecursiveDirectoryIterator(self::root() . $tree);

            /** @var \SplFileInfo $file */
            foreach (new \RecursiveIteratorIterator($directory) as $file) {
                if ($file->getExtension() === 'php') {
                    $files[] = $file->getPathname();
                }
            }
        }

        sort($files);

        return $files;
    }

    /**
     * Every line on which a file's CODE calls `$something->$method(`.
     *
     * Comments are dropped, so the paragraphs above — which name both methods —
     * are not findings.
     *
     * @return list<int>
     */
    private static function callsTo(string $php, string $method): array
    {
        $tokens = array_values(array_filter(
            token_get_all($php),
            static fn ($token): bool => !is_array($token)
                || !in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)
        ));

        $found = [];

        foreach ($tokens as $index => $token) {
            $previous = $tokens[$index - 1] ?? null;

            if (
                is_array($token)
                && $token[0] === T_STRING
                && $token[1] === $method
                && is_array($previous)
                && in_array($previous[0], [T_OBJECT_OPERATOR, T_NULLSAFE_OBJECT_OPERATOR], true)
                && ($tokens[$index + 1] ?? null) === '('
            ) {
                $found[] = $token[2];
            }
        }

        return $found;
    }

    /**
     * **The claim.** One caller of `saveDraft()` in the shipped source, and it
     * is the file that records the milestone.
     */
    public function testTheRouteIsTheOnlyThingThatWritesADraft(): void
    {
        $callers = [];

        foreach (self::shippedSources() as $file) {
            $lines = self::callsTo((string) file_get_contents($file), 'saveDraft');

            if ($lines !== []) {
                $callers[] = str_replace(self::root() . '/', '', $file);
            }
        }

        $this->assertSame(
            [self::THE_EDITOR],
            $callers,
            'a second writer of a draft would silently miss the first-edit milestone, which is recorded at the route'
        );
    }

    /**
     * **And the reason it is at the route rather than in the repository.**
     *
     * `OptinRepository` does not know what a [[Template]] is, and the diff
     * cannot be computed without knowing. If that ever stops being true the
     * argument in ADR 0057 has expired and the milestone should move down
     * beside the activation one — so this fails rather than going quiet.
     */
    public function testTheRepositoryDoesNotKnowWhatATemplateIs(): void
    {
        $repository = (string) file_get_contents(self::root() . '/src/Optin/OptinRepository.php');

        $tokens = array_values(array_filter(
            token_get_all($repository),
            static fn ($token): bool => !is_array($token)
                || !in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)
        ));

        $named = array_values(array_filter(
            $tokens,
            static fn ($token): bool => is_array($token)
                && in_array($token[0], [T_STRING, T_NAME_QUALIFIED, T_NAME_FULLY_QUALIFIED], true)
                && str_contains($token[1], 'TemplateVocabulary')
        ));

        $this->assertSame([], $named, 'the repository can read a design now, so the milestone can move to saveDraft()');
    }

    /**
     * The scan can fail — a guard that cannot is a comment with a green tick
     * beside it.
     */
    public function testTheScannerFindsACallAndIgnoresTheRuleBeingDiscussed(): void
    {
        $offending = <<<'PHP'
        <?php
        /** Nothing but OptinController may call $optins->saveDraft() — see ADR 0057. */
        // not even here: $repository->saveDraft($id, null, null, $config);
        $optin = $this->optins->saveDraft($id, $name, $goal, $config);
        PHP;

        $this->assertSame([4], self::callsTo($offending, 'saveDraft'));
    }
}

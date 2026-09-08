<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;
use WConvert\Template\DesignBudget;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

/**
 * bin/verify-templates.php, against the shipped library and against fixtures.
 *
 * ============================================================================
 * THE SHIPPED LIBRARY IS LINTED ON EVERY PULL REQUEST, WHICH IS THE POINT.
 * ============================================================================
 * An authoring check that only runs when somebody remembers to run it catches
 * nothing on the day it matters — the day a design lands in a pull request with
 * a role that will be dropped. So the program is a `bin/` program because that
 * is where an author reaches for it, and this test is what makes it a gate.
 *
 * ============================================================================
 * AND THE FIXTURES ARE THE THREE FAILURES THAT ARE OTHERWISE TOTALLY SILENT.
 * ============================================================================
 * A green run over the shipped library proves the program does not shout at
 * good input, which is the weaker half: a program that printed nothing would
 * pass it. What the fixtures assert is that each of the three silent failures
 * is actually reported — a file that fails to decode, a `tree` key that became
 * a Pro upsell card, and a Slot Role dropped on the way in.
 *
 * {@see TemplateLibraryTest} is not this test and never was: it normalises an
 * already-normalised tree, so it asserts idempotence and cannot fail for an
 * authoring mistake.
 */
#[CoversNothing]
final class LibraryLintTest extends TestCase
{
    private const SCRIPT = __DIR__ . '/../../../bin/verify-templates.php';

    private string $tree = '';

    protected function tearDown(): void
    {
        if ($this->tree === '' || !is_dir($this->tree)) {
            return;
        }

        foreach ((array) glob($this->tree . '/resources/templates/library/*.json') as $file) {
            unlink((string) $file);
        }

        foreach (['/resources/templates/library', '/resources/templates', '/resources', ''] as $directory) {
            @rmdir($this->tree . $directory);
        }
    }

    /**
     * @param array<string, string> $files Filename => contents, verbatim, so a syntax error survives.
     */
    private function library(array $files): string
    {
        $this->tree = sys_get_temp_dir() . '/wconvert-templates-' . bin2hex(random_bytes(6));

        $directory = $this->tree . '/resources/templates/library';
        mkdir($directory, 0777, true);

        foreach ($files as $name => $contents) {
            file_put_contents($directory . '/' . $name, $contents);
        }

        return $this->tree;
    }

    /**
     * @return array{status: int, output: string}
     */
    private function lint(?string $tree = null): array
    {
        $output = [];
        $status = 0;

        exec(
            sprintf(
                'php %s %s 2>&1',
                escapeshellarg(self::SCRIPT),
                $tree === null ? '' : escapeshellarg($tree)
            ),
            $output,
            $status
        );

        return ['status' => $status, 'output' => implode("\n", $output)];
    }

    public function testEveryShippedDesignSurvivesRegistrationIntact(): void
    {
        $result = $this->lint();

        $this->assertSame(0, $result['status'], $result['output']);
    }

    /**
     * ========================================================================
     * A CAP PER DESIGN, BECAUSE THE PAGE BUDGET CANNOT NAME THE CULPRIT.
     * ========================================================================
     * {@see \WConvert\Tests\Unit\Frontend\PayloadBudgetTest} holds ADR 0010's
     * ≤2KB gzipped **per page**, which is the number a visitor actually pays and
     * the right thing to defend. What it cannot do is say *which design* did it:
     * it measures ten Optins together, and a failure there names the page.
     *
     * That mattered less while every design was one layout and eight slots. It
     * matters now: a scoped token bag is repeatable and nests (ADR 0062), so a
     * reference-class design can carry three to four times the copy and a
     * handful of bags, and the first thing anyone would know about it is a
     * budget test going red two commits later on a fixture that names something
     * else.
     *
     * **The SNAPSHOT, not the file.** What a page pays for is the tree with the
     * gallery's placeholder words taken out of it, plus the tokens — which is
     * what `snapshotInto()` produces and what an Optin stores. A pretty-printed
     * file with a docblock in it is not what a visitor downloads.
     *
     * **Gzipped alone**, which is deliberately harsher than reality: on a page
     * ten snapshots compress against each other. A design that fits on its own
     * fits beside its siblings.
     *
     * The cap is `DesignBudget::PER_DESIGN`, which the builder's own payload
     * meter reads over the wire — so a merchant and this test are measuring
     * against one number rather than two that agree today.
     */
    public function testNoShippedDesignIsOverItsOwnByteCap(): void
    {
        $vocabulary = TemplateVocabulary::fromManifest(dirname(self::SCRIPT, 2));
        $library = TemplateLibrary::fromDirectory($vocabulary, dirname(self::SCRIPT, 2));

        $entries = $library->all();

        $this->assertNotSame([], $entries, 'the library ships nothing, so this test asserts nothing');

        foreach (array_keys($entries) as $id) {
            $snapshot = $library->snapshotInto(['template_id' => (string) $id]);
            $bytes = strlen((string) gzencode((string) json_encode($snapshot['template'] ?? []), 9));

            $this->assertLessThanOrEqual(
                DesignBudget::PER_DESIGN,
                $bytes,
                sprintf('%s is %d B gzipped against a %d B cap', $id, $bytes, DesignBudget::PER_DESIGN)
            );
        }
    }

    /**
     * The failure with nothing at all behind it: `JsonFile::read()` hands back
     * null, `BundledTemplates` never passes null to the library, so no
     * Rejection is constructed and `Rejection::warn()` never fires.
     */
    public function testReportsAFileThatFailedToDecode(): void
    {
        $result = $this->lint($this->library([
            'broken.json' => '{ "id": "broken", "name": "Broken",',
        ]));

        $this->assertSame(1, $result['status']);
        $this->assertStringContainsString('not valid JSON', $result['output']);
    }

    /**
     * A typo in one key turns a free design into an advertisement for itself:
     * no `tree` is the whole discriminator for a design this install did not
     * get, so the entry becomes a locked stub with a Pro badge on it.
     */
    public function testReportsADesignWhoseTreeKeyIsMisspelled(): void
    {
        $result = $this->lint($this->library([
            'upsell.json' => (string) json_encode([
                'id' => 'upsell',
                'name' => 'Typo',
                'display_type' => 'popup',
                'tier' => 'free',
                'trees' => ['steps' => []],
            ]),
        ]));

        $this->assertSame(1, $result['status']);
        $this->assertStringContainsString('LOCKED', $result['output']);
    }

    /**
     * The one whose cost is invisible on the card. The design still renders in
     * the gallery with its placeholder text; the Role is what a real Optin
     * binds words to, so without it the slot arrives empty.
     */
    public function testReportsANodeThatLostItsSlotRoleAndOneThatKeptTheWrongOne(): void
    {
        $result = $this->lint($this->library([
            'roles.json' => (string) json_encode([
                'id' => 'roles',
                'name' => 'Roles',
                'display_type' => 'popup',
                'tier' => 'free',
                'tree' => ['steps' => [
                    ['type' => 'stack', 'children' => [
                        ['type' => 'heading', 'role' => 'nonsense', 'text' => 'One'],
                        ['type' => 'text', 'role' => 'cta_label', 'text' => 'Two'],
                        ['type' => 'button', 'label' => 'Go', 'action' => 'link', 'href' => '/x'],
                    ]],
                ]],
            ]),
        ]));

        $this->assertSame(1, $result['status']);
        // Dropped: `nonsense` is not in the vocabulary at all.
        $this->assertStringContainsString('`nonsense`', $result['output']);
        // Kept, and worse for it: `cta_label` is a real Role the manifest
        // declares for `button`, so a `text` node carrying it binds a button's
        // label into a paragraph.
        $this->assertStringContainsString('and not for this node type', $result['output']);
    }

    /**
     * An empty library is not a clean library. "Inspected nothing" reading as
     * "nothing wrong" is the failure ADR 0029 is about, and this program fails
     * closed on it exactly as `check-loader.mjs` does.
     */
    public function testFailsOnALibraryDirectoryWithNothingInIt(): void
    {
        $result = $this->lint($this->library([]));

        $this->assertSame(1, $result['status']);
        $this->assertStringContainsString('nothing was inspected', $result['output']);
    }
}

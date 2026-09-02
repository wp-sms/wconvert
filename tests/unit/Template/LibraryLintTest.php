<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

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

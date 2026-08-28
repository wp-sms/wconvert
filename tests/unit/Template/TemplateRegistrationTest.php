<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Support\RejectionReason;
use WConvert\Template\BundledTemplates;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

/**
 * **Validation happens at registration, never at runtime.**
 *
 * A [[Template]] offering both a form and a click-through CTA is rejected when
 * it is registered, because an Optin with two candidate Conversions has no
 * honest number to report (ADR 0020, CONTEXT.md Conversion). Runtime is the
 * wrong moment twice over: by then a merchant has a published Optin, and the
 * only refusal available to the renderer is a blank popup.
 *
 * **The rejection is recorded rather than silent.** A shipped entry that
 * vanished from the gallery with nothing said is the same symptom as a gallery
 * that failed to load, and this is the one place an author is still present to
 * be told.
 */
#[CoversClass(TemplateLibrary::class)]
final class TemplateRegistrationTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    private string $tree = '';

    protected function setUp(): void
    {
        $this->tree = (string) tempnam(sys_get_temp_dir(), 'wconvert');

        unlink($this->tree);
        mkdir($this->tree . '/' . BundledTemplates::PATH, 0o777, true);
    }

    protected function tearDown(): void
    {
        foreach ((array) glob($this->tree . '/' . BundledTemplates::PATH . '/*.json') as $file) {
            unlink((string) $file);
        }

        foreach (['/' . BundledTemplates::PATH, '/resources/templates', '/resources', ''] as $suffix) {
            @rmdir($this->tree . $suffix);
        }
    }

    /**
     * @param list<array<string, mixed>> $steps
     */
    private function ship(string $id, array $steps): void
    {
        file_put_contents($this->tree . '/' . BundledTemplates::PATH . '/' . $id . '.json', (string) json_encode([
            'id' => $id,
            'name' => ucfirst($id),
            'display_type' => 'popup',
            'tokens' => ['bg' => '#ffffff'],
            'tree' => ['steps' => $steps],
        ]));
    }

    /**
     * @param list<array<string, mixed>> $children
     * @return array<string, mixed>
     */
    private static function step(array $children): array
    {
        return ['type' => 'stack', 'children' => $children];
    }

    /**
     * The terminal success state a submit-metered Template ends on.
     *
     * @return array<string, mixed>
     */
    private static function successStep(): array
    {
        return self::step([['type' => 'heading', 'role' => 'success_headline', 'text' => 'Done']]);
    }

    private function library(): TemplateLibrary
    {
        return TemplateLibrary::fromDirectory(TemplateVocabulary::fromManifest(self::PLUGIN_DIR), $this->tree);
    }

    public function testATemplateWithOneConvertingActRegisters(): void
    {
        $this->ship('one-act', [
            self::step([['type' => 'button', 'label' => 'Join', 'action' => 'submit']]),
            self::successStep(),
        ]);

        $this->assertIsArray($this->library()->find('one-act'));
        $this->assertSame([], $this->library()->rejections());
    }

    /**
     * The rejection the acceptance criterion names.
     */
    public function testATemplateOfferingTwoCandidateConvertingActsIsRejected(): void
    {
        $this->ship('two-acts', [
            self::step([
                ['type' => 'button', 'label' => 'Join', 'action' => 'submit'],
                ['type' => 'button', 'label' => 'Shop', 'action' => 'link', 'href' => 'https://x.test'],
            ]),
            self::successStep(),
        ]);

        $this->assertNull($this->library()->find('two-acts'));
        $this->assertSame(
            [['id' => 'two-acts', 'reason' => RejectionReason::TwoConvertingActs->value]],
            array_map(
                static fn (\WConvert\Support\Rejection $r): array => ['id' => $r->id, 'reason' => $r->reason->value],
                $this->library()->rejections()
            )
        );
    }

    /**
     * And a Template offering NONE. It is the same rule read the other way —
     * an Optin whose Template can never be converted reports zero forever,
     * which is the countability failure the [[Goal]] test exists to prevent
     * (CONTEXT.md, Goal). One act, exactly.
     */
    public function testATemplateOfferingNoConvertingActIsRejectedToo(): void
    {
        $this->ship('no-act', [self::step([['type' => 'heading', 'text' => 'Hello']])]);

        $this->assertNull($this->library()->find('no-act'));
        $this->assertSame(RejectionReason::NoConvertingAct, $this->library()->rejections()[0]->reason);
    }

    /**
     * The step count follows from the act, so it is checked where the act is
     * (ADR 0025). A click-metered Template carrying a success step describes a
     * moment that cannot happen: the click has already navigated the visitor
     * away.
     */
    public function testAClickMeteredTemplateCarryingASuccessStepIsRejected(): void
    {
        $this->ship('two-step-click', [
            self::step([['type' => 'button', 'label' => 'Shop', 'action' => 'link', 'href' => 'https://x.test']]),
            self::successStep(),
        ]);

        $this->assertNull($this->library()->find('two-step-click'));
        $this->assertSame(RejectionReason::WrongStepCount, $this->library()->rejections()[0]->reason);
    }
}

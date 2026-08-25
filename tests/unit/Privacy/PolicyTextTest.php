<?php

namespace WConvert\Tests\Unit\Privacy;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Privacy\PolicyText;
use WConvert\Retention\RetentionPeriod;
use WConvert\Tests\Unit\Support\FakeOptionStore;

/**
 * The privacy-policy text WConvert suggests, and the two things it has to say.
 *
 * **It states the configured retention period** (ADR 0018), so a merchant who
 * sets one gets the disclosure written for them rather than discovering they
 * needed to write it.
 *
 * **It says the merchant is the controller of exported files.** A CSV already
 * downloaded is out of WConvert's reach permanently, and tracking exports so
 * that it would not be means logging who exported what — more personal data,
 * to solve a personal-data problem. Saying so is the honest alternative.
 */
#[CoversClass(PolicyText::class)]
final class PolicyTextTest extends TestCase
{
    private RetentionPeriod $retention;

    private PolicyText $policy;

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestPolicyContent'] = [];

        $this->retention = new RetentionPeriod(new FakeOptionStore());
        $this->policy = new PolicyText($this->retention);
    }

    public function testWithNoPeriodConfiguredItSaysLeadsAreKeptUntilDeleted(): void
    {
        $text = $this->policy->content();

        $this->assertStringContainsString('until you delete them', $text);
        $this->assertStringNotContainsString('days', $text);
    }

    /**
     * The acceptance criterion: **setting a retention period changes the
     * registered privacy-policy text.**
     */
    public function testSettingAPeriodPutsItInTheText(): void
    {
        $this->retention->set(90);

        $this->assertStringContainsString('90 days', $this->policy->content());
    }

    public function testAPeriodOfOneDayReadsAsOneDayRatherThanOneDays(): void
    {
        $this->retention->set(1);

        $this->assertStringContainsString('1 day', $this->policy->content());
        $this->assertStringNotContainsString('1 days', $this->policy->content());
    }

    public function testItSaysTheMerchantControlsWhatTheyHaveExported(): void
    {
        $this->assertStringContainsString('exported', $this->policy->content());
    }

    /**
     * The [[Consent Record]] is disclosed, because storing the wording a
     * visitor agreed to is itself something a privacy policy has to mention.
     */
    public function testItDisclosesThatTheConsentWordingIsStored(): void
    {
        $this->assertStringContainsString('consent', strtolower($this->policy->content()));
    }

    public function testItRegistersItsSuggestionUnderThePluginsName(): void
    {
        $this->policy->register();

        /** @var list<array{plugin: string, content: string}> $suggested */
        $suggested = $GLOBALS['wconvertTestPolicyContent'];

        $this->assertCount(1, $suggested);
        $this->assertSame('WConvert', $suggested[0]['plugin']);
        $this->assertStringContainsString('until you delete them', $suggested[0]['content']);
    }
}

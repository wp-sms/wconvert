<?php

namespace WConvert\Tests\Unit\Privacy;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationRequirements;
use WConvert\Destination\DestinationStore;
use WConvert\Privacy\DataMap;
use WConvert\Privacy\PolicyText;
use WConvert\Retention\RetentionPeriod;
use WConvert\Tests\Unit\Support\FakeDestinationType;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeSitePresence;

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

    private DestinationStore $destinations;

    private DestinationRegistry $types;

    private PolicyText $policy;

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestPolicyContent'] = [];

        $options = new FakeOptionStore();
        $this->retention = new RetentionPeriod($options);
        $this->destinations = new DestinationStore($options);
        $this->types = new DestinationRegistry(new FakeProPresence(), new FakeSitePresence());
        $this->policy = new PolicyText(new DataMap($this->retention, $this->destinations, $this->types));
    }

    public function testWithNoPeriodConfiguredItSaysLeadsAreKeptUntilDeleted(): void
    {
        $text = $this->policy->content();

        $this->assertStringContainsString('until a site administrator deletes them', $text);
        $this->assertStringNotContainsString('We keep form submissions for', $text);
    }

    public function testItUsesReaderQuestionsAndKeepsMerchantInstructionsOutOfSuggestedCopy(): void
    {
        $text = $this->policy->content();

        $this->assertStringContainsString('<p class="privacy-policy-tutorial">', $text);
        $this->assertStringContainsString('Before publishing', $text);
        $this->assertStringContainsString('<strong class="privacy-policy-tutorial">Suggested text:</strong>', $text);
        $this->assertStringContainsString('<h2>WConvert forms and campaigns</h2>', $text);
        $this->assertStringContainsString('<h3>Information we collect</h3>', $text);
        $this->assertStringContainsString('<h3>Who receives your information</h3>', $text);
        $this->assertStringContainsString('<h3>How long we keep your information</h3>', $text);
        $this->assertStringContainsString('<h3>Your choices and rights</h3>', $text);
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

    public function testItAccuratelyDescribesBrowserStateAndTheShortLivedRateLimit(): void
    {
        $text = $this->policy->content();

        $this->assertStringContainsString('local storage', $text);
        $this->assertStringContainsString('wcv1', $text);
        $this->assertStringContainsString('cookie', $text);
        $this->assertStringContainsString('one year', $text);
        $this->assertStringContainsString('one minute', $text);
        $this->assertStringContainsString('one-way hash', $text);
        $this->assertStringContainsString('IP address itself is not saved', $text);
        $this->assertStringContainsString('not linked to individual visitors', $text);
    }

    public function testItDoesNotClaimThatTheSubmissionStoresItsPageAddress(): void
    {
        $text = $this->policy->content();

        $this->assertStringContainsString('do not add the page address', $text);
        $this->assertStringNotContainsString('page it came from', $text);
    }

    public function testItExplainsThatCopiesOutsideWConvertNeedSeparateHandling(): void
    {
        $text = $this->policy->content();

        $this->assertStringContainsString('different retention periods', $text);
        $this->assertStringContainsString('does not automatically remove copies', $text);
        $this->assertStringContainsString('Those copies are managed separately', $text);
    }

    public function testItNamesConfiguredDestinationTypesWithoutPublishingInternalRouteNames(): void
    {
        $type = new FakeDestinationType('mailing');
        $type->declaredRequirements = new DestinationRequirements(
            fields: ['email', 'name'],
            mappedFields: ['interest' => [
                'setting' => 'interest_field',
                'label' => 'Interest',
                'scope' => 'New subscribers only.',
            ]]
        );
        $this->types->register($type);
        $this->destinations->save(null, 'mailing', 'Internal launch list', null, [
            'interest_field' => 'custom-interest',
        ]);

        $text = $this->policy->content();

        $this->assertStringContainsString('Fake', $text);
        $this->assertStringContainsString('email address, name, interest answer', $text);
        $this->assertStringNotContainsString('Internal launch list', $text);
    }

    public function testItRegistersItsSuggestionUnderThePluginsName(): void
    {
        $this->policy->register();

        /** @var list<array{plugin: string, content: string}> $suggested */
        $suggested = $GLOBALS['wconvertTestPolicyContent'];

        $this->assertCount(1, $suggested);
        $this->assertSame('WConvert', $suggested[0]['plugin']);
        $this->assertStringContainsString('until a site administrator deletes them', $suggested[0]['content']);
    }
}

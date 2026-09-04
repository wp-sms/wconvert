<?php

namespace WConvert\Tests\Unit\Optin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Optin\SiteFrequency;
use WConvert\Tests\Unit\Support\FakeOptionStore;

/**
 * The allowance the whole site shares.
 *
 * ============================================================================
 * ONE OPTION, THE SAME FOUR FIELDS, AND THE OPPOSITE DEFAULTS.
 * ============================================================================
 * Everything about the SHAPE is {@see \WConvert\Optin\Frequency}'s and is
 * asserted in {@see FrequencyTest}. What is asserted here is the one thing
 * this scope does differently: **all four fields are off until a merchant
 * asks**, where an Optin's own two switches are on (ADR 0047).
 *
 * The asymmetry is the feature. *One dismissal silences the entire site for a
 * week* is a claim about what the visitor meant that they did not make, and a
 * merchant who never asked for it would experience it as the plugin having
 * stopped working — with nothing on any screen to explain why.
 */
#[CoversClass(SiteFrequency::class)]
final class SiteFrequencyTest extends TestCase
{
    private FakeOptionStore $options;

    private SiteFrequency $site;

    protected function setUp(): void
    {
        $this->options = new FakeOptionStore();
        $this->site = new SiteFrequency($this->options);
    }

    /**
     * **The shipped state, and the one every install is in.** Nothing stops
     * anything, so the page carries no allowance at all and behaves exactly as
     * it does today.
     */
    public function testAFreshInstallStopsNothing(): void
    {
        $allowance = $this->site->allowance();

        $this->assertFalse($allowance->stopAfterDismiss);
        $this->assertFalse($allowance->stopAfterConversion);
        $this->assertNull($allowance->maxImpressions);
        $this->assertNull($allowance->cooldownDays);
        $this->assertTrue($allowance->stopsNothing());
    }

    /**
     * An absent key is OFF here, where the same absent key on an Optin's own
     * allowance is on. Both switches are therefore spelled in full on the way
     * in, and this is what says so.
     */
    public function testAStoredBlobMissingASwitchReadsItAsOff(): void
    {
        $this->options->set(SiteFrequency::OPTION, ['maxImpressions' => 3]);

        $allowance = $this->site->allowance();

        $this->assertSame(3, $allowance->maxImpressions);
        $this->assertFalse($allowance->stopAfterDismiss);
        $this->assertFalse($allowance->stopAfterConversion);
    }

    /**
     * **Only an explicit yes is a yes**, and this is the case a `+` default
     * would have missed.
     *
     * `$config + ['stopAfterDismiss' => false]` fills an ABSENT key and leaves
     * a present one alone — so a body carrying `null`, `0` or `"no"` would
     * reach `Frequency`'s `!== false` intact and read as **on**. Unreachable
     * from the card that ships, reachable from any other REST client, and it
     * would turn a site-wide cap on for a merchant who asked for nothing.
     */
    public function testASwitchThatIsPresentButNotAYesIsOff(): void
    {
        foreach ([null, 0, '', 'no', 'false'] as $notAYes) {
            $this->site->set(['stopAfterDismiss' => $notAYes]);

            $this->assertFalse(
                $this->site->allowance()->stopAfterDismiss,
                sprintf('%s is not a merchant asking for a site-wide cap', var_export($notAYes, true))
            );
        }
    }

    /** And a tick that arrived as a form-encoded `"1"` is a tick. */
    public function testASwitchSpelledTheWayAFormSpellsItIsOn(): void
    {
        $this->site->set(['stopAfterDismiss' => '1']);

        $this->assertTrue($this->site->allowance()->stopAfterDismiss);
    }

    /**
     * What an authoring surface is handed: **all four, always**. A control
     * cannot draw a checkbox from a key that is not there, and this scope's
     * absent key means something the payload's absent key does not.
     */
    public function testTheAuthoringShapeSpellsEveryFieldOut(): void
    {
        $this->assertSame(
            [
                'maxImpressions' => null,
                'cooldownDays' => null,
                'stopAfterDismiss' => false,
                'stopAfterConversion' => false,
            ],
            $this->site->authored()
        );
    }

    public function testItRoundTripsWhatAMerchantConfigured(): void
    {
        $this->site->set([
            'maxImpressions' => 2,
            'cooldownDays' => 7,
            'stopAfterDismiss' => true,
            'stopAfterConversion' => false,
        ]);

        $allowance = $this->site->allowance();

        $this->assertSame(2, $allowance->maxImpressions);
        $this->assertSame(7, $allowance->cooldownDays);
        $this->assertTrue($allowance->stopAfterDismiss);
        $this->assertFalse($allowance->stopAfterConversion);
        $this->assertFalse($allowance->stopsNothing());
    }

    /**
     * **`true` never reaches the browser, and the option spells it out anyway.**
     *
     * The two are not in tension, they are two readings of ABSENCE. To the
     * engine an absent switch is on, so a `true` in the payload is bytes on
     * every matching page view that cannot change an answer. To this scope an
     * absent switch is off — so an option written the payload's way would lose
     * a switch the merchant had just turned on, which is the bug this pair of
     * assertions exists to hold shut.
     */
    public function testTrueIsSpelledInTheOptionAndNeverInThePayload(): void
    {
        $this->site->set(['stopAfterDismiss' => true, 'stopAfterConversion' => true]);

        $this->assertSame(
            [
                'maxImpressions' => null,
                'cooldownDays' => null,
                'stopAfterDismiss' => true,
                'stopAfterConversion' => true,
            ],
            $this->options->get(SiteFrequency::OPTION)
        );

        $this->assertSame([], $this->site->forPayload());
    }

    /** Turning everything back off is a real state, and it survives a reload. */
    public function testTurningEverythingOffIsStoredAndReadBack(): void
    {
        $this->site->set(['stopAfterDismiss' => true]);
        $this->site->set(['stopAfterDismiss' => false, 'stopAfterConversion' => false]);

        $this->assertTrue($this->site->allowance()->stopsNothing());
    }

    /**
     * A hand-edited option must not fatal the one path every uncached page
     * view runs. Anything unreadable is the shipped default, which is off.
     */
    public function testAnUnreadableOptionReadsAsOff(): void
    {
        $this->options->set(SiteFrequency::OPTION, 'not an allowance');

        $this->assertTrue($this->site->allowance()->stopsNothing());
    }

    /**
     * What the page carries: **nothing at all until there is something to
     * spend**, and the four fields verbatim once there is. A translation layer
     * between the two scopes would be a second vocabulary with nothing
     * asserting the halves agree.
     */
    public function testWhatTheBrowserIsGiven(): void
    {
        $this->assertNull($this->site->forPayload());

        $this->site->set(['cooldownDays' => 3]);

        $this->assertSame(
            ['cooldownDays' => 3, 'stopAfterDismiss' => false, 'stopAfterConversion' => false],
            $this->site->forPayload()
        );
    }
}

<?php

namespace WConvert\Tests\Unit\Goal;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Goal\Goal;
use WConvert\Goal\GoalRegistry;
use WConvert\Stats\StatKind;
use WConvert\Support\Availability;
use WConvert\Support\SiteDependency;
use WConvert\Support\Tier;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeSitePresence;

#[CoversClass(GoalRegistry::class)]
#[CoversClass(Goal::class)]
final class GoalRegistryTest extends TestCase
{
    private function registry(bool $pro = false, bool $store = false): GoalRegistry
    {
        return new GoalRegistry(
            new FakeProPresence($pro ? Tier::Elite : Tier::Free),
            new FakeSitePresence($store ? [SiteDependency::WooCommerce] : [])
        );
    }

    public function testTheRegistryHoldsTheGoalsInTheirDeclaredOrder(): void
    {
        $this->assertSame(
            ['grow_email_list', 'grow_sms_list', 'recover_cart', 'promote_offer', 'deliver_lead_magnet', 'collect_enquiries'],
            array_map(static fn (Goal $goal): string => $goal->value, Goal::cases())
        );
    }

    public function testHeadlineLabelsDescribeTheProvenEvent(): void
    {
        $this->assertSame('Email submissions', Goal::GrowEmailList->headlineLabel());
        $this->assertSame('Phone submissions', Goal::GrowSmsList->headlineLabel());
        $this->assertSame('Link clicks', Goal::PromoteOffer->headlineLabel());
        $this->assertSame('Emails accepted for sending', Goal::DeliverLeadMagnet->headlineLabel());
    }

    public function testEachGoalDeclaresTheKindThatCountsIt(): void
    {
        $this->assertSame(StatKind::Conversion, Goal::GrowEmailList->headlineKind());
        $this->assertSame(StatKind::Conversion, Goal::PromoteOffer->headlineKind());
        $this->assertSame(StatKind::Conversion, Goal::CollectEnquiries->headlineKind());
        $this->assertSame(StatKind::LeadMagnetDelivered, Goal::DeliverLeadMagnet->headlineKind());
    }

    public function testEveryGoalNamesAnOutcomeTheCountersCanReport(): void
    {
        foreach (Goal::cases() as $goal) {
            $this->assertContains($goal->headlineKind(), StatKind::cases(), "{$goal->value} counts nothing");
            $this->assertNotSame('', $goal->label(), "{$goal->value} has no label");
        }
    }

    public function testAGoalTheSiteAndTheInstallBothServeIsReady(): void
    {
        $this->assertSame(Availability::Ready, $this->registry()->availabilityOf(Goal::GrowEmailList));
    }

    public function testEnquiriesAreStandaloneAndRequireContactDetails(): void
    {
        $goal = Goal::CollectEnquiries;

        $this->assertSame(Availability::Ready, $this->registry()->availabilityOf($goal));
        $this->assertSame(Tier::Free, $goal->tier());
        $this->assertNull($goal->requires());
        $this->assertSame(['email', 'phone'], $goal->outcome()->captureAnyOf);
    }

    public function testTheCartGoalIsAnUpsellOnAFreeInstallThatHasAStore(): void
    {
        $this->assertSame(
            Availability::Locked,
            $this->registry(pro: false, store: true)->availabilityOf(Goal::RecoverCart)
        );
    }

    public function testTheCartGoalIsUnavailableWithoutAStoreEvenWithPro(): void
    {
        $this->assertSame(
            Availability::Unavailable,
            $this->registry(pro: true, store: false)->availabilityOf(Goal::RecoverCart)
        );
    }

    public function testOnAFreeInstallWithNoStoreTheCartGoalIsUnavailableRatherThanLocked(): void
    {
        $this->assertSame(
            Availability::Unavailable,
            $this->registry(pro: false, store: false)->availabilityOf(Goal::RecoverCart)
        );
    }

    public function testOnlyTheCartGoalDependsOnAnythingTheSiteMightNotHave(): void
    {
        $dependent = array_values(array_filter(
            Goal::cases(),
            static fn (Goal $goal): bool => $goal->requires() !== null
        ));

        $this->assertSame([Goal::RecoverCart], $dependent);
        $this->assertSame(SiteDependency::WooCommerce, Goal::RecoverCart->requires());
    }

    public function testTheRegistryTravelsWholeAndLetsTheSurfaceDecideWhatToShow(): void
    {
        $entries = $this->registry()->toArray();

        $this->assertCount(count(Goal::cases()), $entries);
        $this->assertSame('recover_cart', $entries[2]['id']);
        $this->assertSame(Availability::Unavailable->value, $entries[2]['availability']);
    }

    public function testEveryGoalCarriesTheWordForItsHeadlineNumber(): void
    {
        foreach ($this->registry()->toArray() as $entry) {
            $goal = Goal::from((string) $entry['id']);

            $this->assertSame($goal->headlineLabel(), $entry['headline_label']);
            $this->assertNotSame('', $entry['headline_label']);
        }
    }

    public function testEveryGoalCarriesItsOutcomeContract(): void
    {
        foreach ($this->registry()->toArray() as $entry) {
            $goal = Goal::from((string) $entry['id']);

            $this->assertSame($goal->outcome()->toArray(), $entry['outcome']);
            $this->assertArrayNotHasKey('converting_act', $entry);
        }
    }
}

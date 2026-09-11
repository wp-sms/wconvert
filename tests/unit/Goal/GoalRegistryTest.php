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

/**
 * The closed Goal set, and what each member declares.
 *
 * A Goal is the **fifth closed set this project has refused to make a
 * registry** — ADR 0019 lists the first four (ADR 0005's rule model,
 * ADR 0012's substitution table, ADR 0015's premium capabilities, and
 * {@see StatKind}). An enum plus data, no filter: a Goal decides what the
 * analytics screen reports, so an open set means a screen that cannot say what
 * it is reporting.
 *
 * Availability is data beside each member rather than a second list of premium
 * capabilities to keep in step (ADR 0015), and it is RESOLVED here against the
 * install rather than declared — `tier` and the site dependency are properties
 * of the Goal, and which of the three states they add up to is a property of
 * the install.
 */
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

    /**
     * In the order the goal screen asks them in. The order is the
     * enum's, so there is no second list deciding it.
     */
    public function testTheRegistryHoldsTheGoalsInTheirDeclaredOrder(): void
    {
        $this->assertSame(
            ['grow_email_list', 'grow_sms_list', 'recover_cart', 'promote_offer', 'deliver_lead_magnet', 'collect_enquiries'],
            array_map(static fn (Goal $goal): string => $goal->value, Goal::cases())
        );
    }

    /**
     * **No Goal declares a converting act, and exactly one declares that it
     * needs a capture** (ADR 0059).
     *
     * This asserted the five-way split — three submit-metered, two
     * click-metered — which was the duplicate declaration the design already
     * carried. What is left is the one Goal-shaped thing a design can fail:
     * the delivery kind is written when a push to the lead-magnet
     * [[Destination]] succeeds, and a design with no field on it gives it
     * nothing to push, so that Goal's headline reads zero forever.
     *
     * Asserted over every case rather than over the one, so a later Goal
     * reading the delivery kind cannot arrive without an answer here.
     */
    public function testOnlyAGoalCountingDeliveriesNeedsItsDesignToCapture(): void
    {
        $needs = array_values(array_map(
            static fn (Goal $goal): string => $goal->value,
            array_filter(Goal::cases(), static fn (Goal $goal): bool => $goal->needsACapture())
        ));

        $this->assertSame(['deliver_lead_magnet'], $needs);

        foreach (Goal::cases() as $goal) {
            $this->assertSame(
                $goal->headlineKind() === StatKind::LeadMagnetDelivered,
                $goal->needsACapture(),
                "{$goal->value} disagrees with the kind it is read from"
            );
        }
    }

    /**
     * **The looser capture fact, and the implication that orders the two.**
     *
     * A Goal whose product is a captured contact used to refuse every design
     * offering the other act; ADR 0059 allows the pairing and replaces the
     * refusal with a sentence. So this asks a wider set than
     * {@see Goal::needsACapture()} — and the two must not drift into
     * contradicting each other, because a Goal that refuses a design without
     * being about contacts at all would be a rule nobody could explain.
     */
    public function testEveryGoalThatNeedsACaptureAlsoGrowsAList(): void
    {
        $grows = array_values(array_map(
            static fn (Goal $goal): string => $goal->value,
            array_filter(Goal::cases(), static fn (Goal $goal): bool => $goal->growsAList())
        ));

        $this->assertSame(['grow_email_list', 'grow_sms_list', 'deliver_lead_magnet', 'collect_enquiries'], $grows);

        foreach (Goal::cases() as $goal) {
            if ($goal->needsACapture()) {
                $this->assertTrue($goal->growsAList(), "{$goal->value} refuses a design it is not about");
            }
        }
    }

    /**
     * **And the word for the headline is the KIND's**, so a card grouping an
     * Optin that submits beside one that links away is headed with something
     * true of both (ADR 0059).
     */
    public function testTheHeadlineWordComesFromTheCountedKind(): void
    {
        foreach (Goal::cases() as $goal) {
            $this->assertSame($goal->headlineKind()->label(), $goal->headlineLabel());
        }

        $this->assertSame(StatKind::Conversion->label(), Goal::PromoteOffer->headlineLabel());
        $this->assertSame(StatKind::LeadMagnetDelivered->label(), Goal::DeliverLeadMagnet->headlineLabel());
    }

    /**
     * The declaration that makes a Goal more than a filter at creation time:
     * which counted act is the headline number the analytics screen reports.
     *
     * All but the lead-magnet Goal are read off `conversion`. That Goal is the
     * exception ADR 0020 names — the delivery happens after the Conversion,
     * from a different process, and can fail on its own, so
     * `conversions − lead_magnet_delivered` is the delivery failure count and
     * the delivery itself is what that Goal is asking to be judged on.
     */
    public function testEachGoalDeclaresTheKindThatCountsIt(): void
    {
        $this->assertSame(StatKind::Conversion, Goal::GrowEmailList->headlineKind());
        $this->assertSame(StatKind::Conversion, Goal::PromoteOffer->headlineKind());
        $this->assertSame(StatKind::Conversion, Goal::CollectEnquiries->headlineKind());
        $this->assertSame(StatKind::LeadMagnetDelivered, Goal::DeliverLeadMagnet->headlineKind());
    }

    /**
     * Every Goal names a countable outcome, which is the test CONTEXT.md sets
     * for one: "Grow my email list" is countable, "Increase brand awareness"
     * is not, and a Goal that cannot be counted collapses back into a
     * disposable onboarding answer.
     */
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

    public function testEnquiriesAreAvailableStandaloneAndAdviseRatherThanRestrictTheDesign(): void
    {
        $goal = Goal::CollectEnquiries;

        $this->assertSame(Availability::Ready, $this->registry()->availabilityOf($goal));
        $this->assertSame(Tier::Free, $goal->tier());
        $this->assertNull($goal->requires());
        $this->assertTrue($goal->growsAList());
        $this->assertFalse($goal->needsACapture());
    }

    /**
     * The cart Goal is `tier: pro`, and that is a correctness fix rather than
     * packaging: both cart Conditions are Pro, and dropping one would show
     * *"you left 3 items in your cart"* to a visitor who has never added
     * anything. Making the Goal itself Pro is the only option under which that
     * is impossible rather than merely avoided (ADR 0026).
     */
    public function testTheCartGoalIsAnUpsellOnAFreeInstallThatHasAStore(): void
    {
        $this->assertSame(
            Availability::Locked,
            $this->registry(pro: false, store: true)->availabilityOf(Goal::RecoverCart)
        );
    }

    /**
     * Absent, not greyed out and not explained. A food blogger reading
     * *"Recover abandoned carts — requires WooCommerce"* learns nothing they
     * can act on (ADR 0026).
     */
    public function testTheCartGoalIsUnavailableWithoutAStoreEvenWithPro(): void
    {
        $this->assertSame(
            Availability::Unavailable,
            $this->registry(pro: true, store: false)->availabilityOf(Goal::RecoverCart)
        );
    }

    /**
     * The precedence, resolved through the registry rather than only through
     * {@see Availability::of()}: a merchant with no store is never sold Pro
     * for a feature Pro would not give them either (ADR 0026).
     */
    public function testOnAFreeInstallWithNoStoreTheCartGoalIsUnavailableRatherThanLocked(): void
    {
        $this->assertSame(
            Availability::Unavailable,
            $this->registry(pro: false, store: false)->availabilityOf(Goal::RecoverCart)
        );
    }

    /**
     * **A Standalone install is a fully working install** (CONTEXT.md,
     * Standalone). Capturing a phone number writes a [[Lead]] to the log like
     * any other capture, so the SMS Goal depends on no other plugin — WSMS is
     * a [[Destination]], and a Destination is optional by definition.
     */
    public function testOnlyTheCartGoalDependsOnAnythingTheSiteMightNotHave(): void
    {
        $dependent = array_values(array_filter(
            Goal::cases(),
            static fn (Goal $goal): bool => $goal->requires() !== null
        ));

        $this->assertSame([Goal::RecoverCart], $dependent);
        $this->assertSame(SiteDependency::WooCommerce, Goal::RecoverCart->requires());
    }

    /**
     * Every Goal travels, whatever its state. The three states name **why** a
     * member is absent; **how** that absence renders is a property of the
     * surface, so a registry that filtered here would decide for a settings
     * list what the goal screen needed (ADR 0026).
     */
    public function testTheRegistryTravelsWholeAndLetsTheSurfaceDecideWhatToShow(): void
    {
        $entries = $this->registry()->toArray();

        $this->assertCount(count(Goal::cases()), $entries);
        $this->assertSame('recover_cart', $entries[2]['id']);
        $this->assertSame(Availability::Unavailable->value, $entries[2]['availability']);
    }

    /**
     * **Every Goal carries the WORD for its headline number, not just the
     * kind.**
     *
     * The kind is a value the admin computes nothing from; the word is one
     * somebody wrote, and `wp i18n make-pot` can only see it here. The builder's
     * readiness panel says what an Optin will be judged on before it has been
     * published — so there is no dashboard card to read the word off, and a
     * `match` in TypeScript would be the second spelling
     * {@see GoalParityTest::testNoGoalIsSpelledInTheAdminBundle()} forbids.
     *
     * Asserted for every case rather than for one, because the failure is a
     * Goal added later with no word: the panel would then head the number it
     * reports with an empty string.
     */
    public function testEveryGoalCarriesTheWordForItsHeadlineNumber(): void
    {
        foreach ($this->registry()->toArray() as $entry) {
            $goal = Goal::from((string) $entry['id']);

            $this->assertSame($goal->headlineLabel(), $entry['headline_label']);
            $this->assertNotSame('', $entry['headline_label']);
        }
    }

    /**
     * **And it carries the two capture facts, which are what `converting_act`
     * left behind** (ADR 0059).
     *
     * Both are resolved here rather than derived in the bundle, for the reason
     * `availability` is — a rule spelled on both sides is a rule with nothing
     * asserting the two agree — and neither is derivable from a design, which
     * is the test that decided which of a Goal's declarations survived.
     */
    public function testEveryGoalCarriesBothCaptureFacts(): void
    {
        foreach ($this->registry()->toArray() as $entry) {
            $goal = Goal::from((string) $entry['id']);

            $this->assertSame($goal->needsACapture(), $entry['needs_a_capture']);
            $this->assertSame($goal->growsAList(), $entry['grows_a_list']);
            $this->assertArrayNotHasKey('converting_act', $entry);
        }
    }
}

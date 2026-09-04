<?php

namespace WConvert\Tests\Unit\Targeting;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Targeting\RoleRegistry;
use WConvert\Targeting\WpRoleSource;
use WConvert\Tests\Unit\Support\FakeRoleSource;

/**
 * The seam a membership or LMS plugin arrives through.
 *
 * ============================================================================
 * WHAT IS UNDER TEST IS THAT ADDING ONE CHANGES NOTHING ELSE.
 * ============================================================================
 * The ticket asks for *"an adapter seam with no core change needed to add
 * one"*, and that is a claim about this file and no other: a second source
 * registers, and the merchant's control gains its levels while the evaluator,
 * the manifest, the rule type and the stored shape all stay where they were.
 *
 * The alternative it exists to refuse is a wider core predicate — a
 * `membership_level` beside `role` beside `course_enrolment`, which is three
 * rule types, three controls and three evaluators all asking *"is this visitor
 * one of these"*.
 */
#[CoversClass(RoleRegistry::class)]
#[CoversClass(WpRoleSource::class)]
final class RoleRegistryTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wconvertTestQuery'] = [];
        $GLOBALS['wconvertTestUserRoles'] = [];
    }

    /** An install with nothing registered offers nothing and answers nothing. */
    public function testAnEmptyRegistryIsAnEmptyAnswer(): void
    {
        $registry = new RoleRegistry();

        $this->assertSame([], $registry->offered());
        $this->assertSame([], $registry->held());
    }

    /**
     * **The union is what a merchant sees, and it is one flat list.** A
     * membership level and a WordPress role are the same question asked of two
     * systems, so they are one control rather than two.
     */
    public function testASecondSourceAddsToTheOneChoiceRatherThanBesideIt(): void
    {
        $registry = (new RoleRegistry())
            ->add(new FakeRoleSource(['subscriber' => 'Subscriber'], ['subscriber']))
            ->add(new FakeRoleSource(['plan_gold' => 'Gold plan'], ['plan_gold']));

        $this->assertSame(
            ['subscriber' => 'Subscriber', 'plan_gold' => 'Gold plan'],
            $registry->offered()
        );

        $this->assertSame(['subscriber', 'plan_gold'], $registry->held());
    }

    /**
     * **The first source to name a slug keeps the word for it**, which is
     * arbitrary between two adapters and is not arbitrary between an adapter
     * and WordPress: free registers `WpRoleSource` at boot, so `subscriber`
     * reads as WordPress's role however many plugins later claim the word.
     */
    public function testTheFirstSourceToOfferASlugKeepsItsWordForIt(): void
    {
        $registry = (new RoleRegistry())
            ->add(new FakeRoleSource(['subscriber' => 'Subscriber']))
            ->add(new FakeRoleSource(['subscriber' => 'Free tier']));

        $this->assertSame(['subscriber' => 'Subscriber'], $registry->offered());
    }

    /** Two sources answering the same slug is one answer, not two. */
    public function testARoleHeldThroughTwoSourcesIsHeldOnce(): void
    {
        $registry = (new RoleRegistry())
            ->add(new FakeRoleSource([], ['customer']))
            ->add(new FakeRoleSource([], ['customer', 'plan_gold']));

        $this->assertSame(['customer', 'plan_gold'], $registry->held());
    }

    /**
     * ========================================================================
     * A SIGNED-OUT VISITOR HOLDS NOTHING, WHICH IS MOST PAGE VIEWS.
     * ========================================================================
     * WordPress's source answers before building a user object at all, which
     * is what makes it cheap enough to ask on the front end — and it is the
     * same fact that puts this predicate on the SERVER axis in the first
     * place: the browser cannot read the HttpOnly auth cookie, so it cannot
     * know who this is.
     */
    public function testWordPressSaysASignedOutVisitorHoldsNothing(): void
    {
        $GLOBALS['wconvertTestUserRoles'] = ['administrator'];

        $this->assertSame([], (new WpRoleSource())->held());
    }

    public function testWordPressReportsTheRolesOfASignedInVisitor(): void
    {
        $GLOBALS['wconvertTestQuery'] = ['is_user_logged_in' => true];
        $GLOBALS['wconvertTestUserRoles'] = ['subscriber', 'customer'];

        $this->assertSame(['subscriber', 'customer'], (new WpRoleSource())->held());
    }
}

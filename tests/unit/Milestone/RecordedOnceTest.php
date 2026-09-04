<?php

namespace WConvert\Tests\Unit\Milestone;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Milestone\EditedPart;
use WConvert\Milestone\FirstEdit;
use WConvert\Milestone\MilestoneStore;
use WConvert\Tests\Unit\Support\FakeOptionStore;

/**
 * ============================================================================
 * A MILESTONE IS RECORDED ONCE. THE SECOND ONE IS NOT NEWS.
 * ============================================================================
 * Four of the five milestones are a **first** — a date, written the day
 * something first happened and never again (#94). "Recorded once" is the whole
 * of their meaning, so a store that lets the second publish overwrite the
 * first is a store that reports how recently a merchant published rather than
 * when they started, and the difference is invisible on any screen.
 *
 * The two that live here are the two that cannot be derived. First impression
 * and first conversion are `MIN(stat_date)` over counters that are never
 * pruned and never deleted, so a MIN cannot move forwards by construction —
 * that half is
 * {@see \WConvert\Tests\Unit\Milestone\FirstDaysAreAMinimumTest}.
 */
#[CoversClass(MilestoneStore::class)]
final class RecordedOnceTest extends TestCase
{
    private FakeOptionStore $options;

    private MilestoneStore $milestones;

    protected function setUp(): void
    {
        $this->options = new FakeOptionStore();
        $this->milestones = new MilestoneStore($this->options);
    }

    public function testASiteThatHasDoneNothingHasNoMilestones(): void
    {
        $this->assertNull($this->milestones->firstPublish());
        $this->assertNull($this->milestones->firstEdit());
    }

    public function testTheFirstPublishIsTheDayItWasFirstPublished(): void
    {
        $this->milestones->recordFirstPublish('2026-03-04');

        $this->assertSame('2026-03-04', $this->milestones->firstPublish());
    }

    /**
     * **The seam.** A merchant publishes a second Optin in June; the milestone
     * still says March.
     */
    public function testASecondPublishDoesNotMoveTheFirstPublishDate(): void
    {
        $this->milestones->recordFirstPublish('2026-03-04');
        $this->milestones->recordFirstPublish('2026-06-11');

        $this->assertSame('2026-03-04', $this->milestones->firstPublish());
    }

    /**
     * And it does not even write, so a site publishing every week is not
     * rewriting an option that cannot change.
     */
    public function testARecordThatIsAlreadyHeldCostsNoWrite(): void
    {
        $this->milestones->recordFirstPublish('2026-03-04');

        $writes = $this->options->writes;

        $this->milestones->recordFirstPublish('2026-06-11');

        $this->assertSame($writes, $this->options->writes);
    }

    public function testTheFirstEditKeepsThePlaybookAndThePartThatChanged(): void
    {
        $this->milestones->recordFirstEdit(
            new FirstEdit('2026-03-05', 'welcome-discount', EditedPart::Rules)
        );

        $edit = $this->milestones->firstEdit();

        $this->assertNotNull($edit);
        $this->assertSame('2026-03-05', $edit->on);
        $this->assertSame('welcome-discount', $edit->playbook);
        $this->assertSame(EditedPart::Rules, $edit->part);
    }

    /**
     * **The seam, on the milestone that carries more than a date.** The second
     * edit is the merchant working; the first one is the signal.
     */
    public function testASecondEditMovesNeitherTheDateNorThePart(): void
    {
        $this->milestones->recordFirstEdit(
            new FirstEdit('2026-03-05', 'welcome-discount', EditedPart::Rules)
        );
        $this->milestones->recordFirstEdit(
            new FirstEdit('2026-06-11', 'cart-recovery', EditedPart::Copy)
        );

        $edit = $this->milestones->firstEdit();

        $this->assertNotNull($edit);
        $this->assertSame('2026-03-05', $edit->on);
        $this->assertSame('welcome-discount', $edit->playbook);
        $this->assertSame(EditedPart::Rules, $edit->part);
    }

    /**
     * The two milestones share one option and do not overwrite each other —
     * which is the one thing a single-key store has to get right that two
     * options would have got right for free.
     */
    public function testOneOptionHoldsBothWithoutEitherErasingTheOther(): void
    {
        $this->milestones->recordFirstPublish('2026-03-04');
        $this->milestones->recordFirstEdit(
            new FirstEdit('2026-03-05', 'welcome-discount', EditedPart::Design)
        );

        $this->assertSame('2026-03-04', $this->milestones->firstPublish());
        $this->assertNotNull($this->milestones->firstEdit());
        $this->assertSame([MilestoneStore::OPTION], array_keys($this->options->all()));
    }

    /**
     * A stored record from a build that spelled the part differently is read
     * as **no record**, never as a broken one — the same tolerance every other
     * WConvert option is read with, and the reason none of them needs a
     * migration.
     */
    public function testAPartThisBuildDoesNotKnowReadsAsNoFirstEdit(): void
    {
        $this->options->set(MilestoneStore::OPTION, [
            'first_edit' => ['on' => '2026-03-05', 'playbook' => 'welcome-discount', 'part' => 'vibes'],
        ]);

        $this->assertNull($this->milestones->firstEdit());
    }
}

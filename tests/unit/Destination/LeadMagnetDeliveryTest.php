<?php

namespace WConvert\Tests\Unit\Destination;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Destination\LeadMagnet\LeadMagnetDestinationType;
use WConvert\Destination\PushContext;
use WConvert\Destination\PushOutcome;
use WConvert\Lead\Lead;
use WConvert\Tests\Unit\Support\FakeMailer;

/**
 * **The delivery type's decision table, which is ADR 0008 applied to
 * `wp_mail()`.**
 *
 * The criterion is not how bad a failure is — it is whose fault it is. A
 * failure about the DESTINATION is an outage and moves health; a failure about
 * this [[Lead]] is terminal and is invisible to health. Getting that backwards
 * is the naive implementation, and here it would mean a site whose mail is
 * down looking healthy while a merchant who has not finished configuring gets
 * a queue of Leads nobody will ever retry.
 *
 * The `{link}` rules are in the same file because they are the same claim from
 * the other side: there is nothing to validate settings against on the way in,
 * so everything this type promises about them it has to prove at push time.
 */
#[CoversClass(LeadMagnetDestinationType::class)]
final class LeadMagnetDeliveryTest extends TestCase
{
    private FakeMailer $mailer;

    protected function setUp(): void
    {
        $this->mailer = new FakeMailer();
    }

    private function type(): LeadMagnetDestinationType
    {
        return new LeadMagnetDestinationType($this->mailer);
    }

    /**
     * @param array<string, mixed> $settings
     */
    private function push(array $settings, ?string $email = 'sarah@example.com'): \WConvert\Destination\PushResult
    {
        $lead = new Lead('01LEAD', '01OPTIN', $email, null, ['name' => 'Sarah'], '2026-08-25 10:00:00');

        return $this->type()->push($lead, new PushContext('Guide download', $settings));
    }

    /**
     * @return array<string, mixed>
     */
    private static function configured(): array
    {
        return [
            'file_url' => 'https://example.com/guide.pdf',
            'subject' => 'Your guide',
            'body' => 'Thanks! Grab it here: {link}',
        ];
    }

    public function testAConfiguredDeliveryLandsAndSendsOneEmail(): void
    {
        $result = $this->push(self::configured());

        $this->assertSame(PushOutcome::Success, $result->outcome);
        $this->assertCount(1, $this->mailer->sent);
        $this->assertSame('sarah@example.com', $this->mailer->sent[0]['to']);
        $this->assertSame('Your guide', $this->mailer->sent[0]['subject']);
    }

    /**
     * **Skipped, and not failed.** `PushOutcome::Skipped`'s docblock names this
     * exact case: a Lead with no email meeting an email-only Destination is a
     * routine outcome, and counting it as a failure lights up an outage warning
     * on a site where nothing is wrong (ADR 0008).
     */
    public function testALeadWithNoEmailIsSkippedRatherThanFailed(): void
    {
        $result = $this->push(self::configured(), null);

        $this->assertSame(PushOutcome::Skipped, $result->outcome);
        $this->assertFalse($result->isFailure());
        $this->assertSame([], $this->mailer->sent);
    }

    /**
     * **A Destination with no file is an OUTAGE, not a terminal failure.**
     *
     * It looks like a configuration error to give up on, and it is exactly the
     * opposite: it is about the Destination rather than about this Lead —
     * ADR 0008's own criterion — so health says "N failures in a row: no lead
     * magnet file is configured" on the one screen built to tell a merchant
     * pushing is broken, and the attempts give somebody who published before
     * finishing configuration a window to finish in.
     */
    public function testADestinationWithNoFileFailsRetryablyRatherThanTerminally(): void
    {
        $result = $this->push(['subject' => 'Your guide', 'body' => 'Here you go.']);

        $this->assertTrue($result->isFailure());
        $this->assertTrue($result->retryable);
        $this->assertSame([], $this->mailer->sent);
    }

    /**
     * A transport that refuses the message is the vendor having a bad time, and
     * the next Lead will hit it too.
     */
    public function testAMailTransportThatRefusesTheMessageIsAnOutage(): void
    {
        $this->mailer->sends = false;

        $result = $this->push(self::configured());

        $this->assertTrue($result->retryable);
    }

    /** Same answer for a transport that throws rather than returning false. */
    public function testAMailTransportThatThrowsIsTheSameOutage(): void
    {
        $this->mailer->throws = new \RuntimeException('SMTP connect() failed.');

        $result = $this->push(self::configured());

        $this->assertTrue($result->retryable);
        $this->assertSame('SMTP connect() failed.', $result->reason);
    }

    /**
     * **The one Lead-specific branch**, and the counterweight to everything
     * above: this Lead will never land however many times it is tried, so
     * health must not move.
     */
    public function testAnAddressWordPressWillNotSendToIsTerminal(): void
    {
        $this->mailer->accepts = false;

        $result = $this->push(self::configured());

        $this->assertTrue($result->isFailure());
        $this->assertFalse($result->retryable);
        $this->assertSame([], $this->mailer->sent);
    }

    /**
     * **And the address is not in the reason.** A terminal failure is recorded
     * in {@see \WConvert\Destination\DeliveryFailures}, an option that outlives
     * WConvert's own retention policy — personal data in it would be personal
     * data with no expiry (ADR 0008, ADR 0018). The ring already holds the
     * Lead's id, which is the thing that can be looked up and erased.
     */
    public function testATerminalFailureNamesNoEmailAddress(): void
    {
        $this->mailer->accepts = false;

        $this->assertStringNotContainsString('sarah@example.com', (string) $this->push(self::configured())->reason);
    }

    public function testTheLinkIsSubstitutedWhereTheBodyNamesIt(): void
    {
        $this->push(self::configured());

        $this->assertSame('Thanks! Grab it here: https://example.com/guide.pdf', $this->mailer->sent[0]['body']);
    }

    /**
     * **And appended where it does not.** One token rather than a placeholder
     * language, so there is nothing a merchant can get wrong: a body that never
     * mentions `{link}` still arrives with the download in it.
     */
    public function testTheLinkIsAppendedWhereTheBodyDoesNotNameIt(): void
    {
        $this->push(['file_url' => 'https://example.com/guide.pdf', 'subject' => 'Hi', 'body' => 'Here you go.']);

        $this->assertStringEndsWith("Here you go.\n\nhttps://example.com/guide.pdf", $this->mailer->sent[0]['body']);
    }

    /**
     * A blank subject gets a plain one rather than failing. Withholding
     * somebody's download over an unset subject line would be the wrong trade,
     * and an email with an empty subject reads as spam to the recipient and to
     * their provider alike.
     */
    public function testABlankSubjectFallsBackRatherThanFailing(): void
    {
        $result = $this->push(['file_url' => 'https://example.com/guide.pdf']);

        $this->assertSame(PushOutcome::Success, $result->outcome);
        $this->assertNotSame('', $this->mailer->sent[0]['subject']);
        $this->assertStringContainsString('https://example.com/guide.pdf', $this->mailer->sent[0]['body']);
    }

    /**
     * **Settings are an opaque bag and this type defends itself against it.**
     * `DestinationController::store()` validates nothing in `settings`, so a
     * non-string where a string belongs is a shape that can reach here — and
     * reading it as one would be a `TypeError` inside a queued job rather than
     * a failure anyone can see. The same posture
     * `WsmsDestinationType::applyTags()` takes over the same bag.
     */
    public function testASettingStoredAsTheWrongShapeReadsAsAbsent(): void
    {
        $result = $this->push(['file_url' => ['https://example.com/guide.pdf'], 'subject' => 'Hi']);

        $this->assertTrue($result->retryable, 'a file_url that is not a string is no file_url at all');
    }

    /**
     * It works on a [[Standalone]] install, which is the whole reason this type
     * exists: every other Destination reaches something that may not be there
     * (ADR 0007, ADR 0026).
     */
    public function testItNeedsNothingOfTheSiteAndHasNoConnection(): void
    {
        $this->assertNull($this->type()->requires());
        $this->assertNull($this->type()->connectionSchema());
    }

    /**
     * The id is not ours to choose — `resources/playbooks/guide-download.php`
     * declares `'destination_hint' => ['types' => ['lead_magnet_email']]`, so
     * it was fixed by a shipped fixture before the type existed.
     */
    public function testTheIdIsTheOneTheShippedPlaybookAlreadyHints(): void
    {
        $playbook = include dirname(__DIR__, 3) . '/resources/playbooks/guide-download.php';

        $this->assertSame([LeadMagnetDestinationType::ID], $playbook['destination_hint']['types']);
    }

    /**
     * Every field the schema declares is one the push actually reads. A field
     * the admin draws and nothing consumes is a control that does nothing, which
     * is worse than an absent one.
     */
    public function testTheSchemaDeclaresExactlyTheSettingsThePushReads(): void
    {
        $this->assertSame(
            [LeadMagnetDestinationType::FILE_URL, LeadMagnetDestinationType::SUBJECT, LeadMagnetDestinationType::BODY],
            array_keys($this->type()->settingsSchema([]))
        );
    }
}

<?php

namespace WConvert\Tests\Unit\Lead;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Lead\Capture;
use WConvert\Lead\CaptureForm;
use WConvert\Lead\ConsentRecord;
use WConvert\Lead\Refusal;

/**
 * What an Optin's published template DECLARES, and whether a submission
 * satisfies it.
 *
 * The capture endpoint is public, so client-side validation is decoration
 * (ADR 0032). Everything asserted here is asserted again nowhere: this is the
 * only place the guarantee lives.
 */
#[CoversClass(CaptureForm::class)]
#[CoversClass(Capture::class)]
#[CoversClass(ConsentRecord::class)]
#[CoversClass(Refusal::class)]
final class CaptureFormTest extends TestCase
{
    private const CONSENT_TEXT = 'I agree to receive emails and accept the %s.';

    /**
     * A submit-metered template: a form step and a terminal success step,
     * which is the shape every submit-metered Template has (ADR 0025).
     *
     * @param list<array<string, mixed>> $extra
     * @return array<string, mixed>
     */
    private static function template(array $extra = []): array
    {
        return [
            'tree' => [
                'steps' => [
                    [
                        'type' => 'stack',
                        'children' => array_merge([
                            ['type' => 'heading', 'role' => 'headline', 'text' => 'Join the list'],
                            ['type' => 'field', 'name' => 'email', 'required' => true],
                            ['type' => 'button', 'role' => 'cta_label', 'label' => 'Go', 'action' => 'submit'],
                        ], $extra),
                    ],
                    [
                        'type' => 'stack',
                        'children' => [
                            ['type' => 'heading', 'role' => 'success_headline', 'text' => 'You are on the list'],
                        ],
                    ],
                ],
            ],
            'tokens' => [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function consentNode(?string $href = 'https://example.test/privacy'): array
    {
        return [
            'type' => 'consent',
            'role' => 'consent_text',
            'text' => self::CONSENT_TEXT,
            'link' => array_filter(['label' => 'privacy policy', 'href' => $href], static fn ($v) => $v !== null),
        ];
    }

    /**
     * @param array<string, mixed> $template
     * @param array<string, mixed> $submitted
     */
    private static function validate(array $template, array $submitted): Capture|Refusal
    {
        return CaptureForm::fromTemplate($template)->validate($submitted);
    }

    /**
     * Once present, consent is REQUIRED — not optional. An optional consent
     * checkbox captures Leads whose consent was explicitly refused, which is
     * worse than never asking, because the row then asserts a consent the
     * visitor declined on the same screen (ADR 0032).
     *
     * @return array<string, array{mixed}>
     */
    public static function submissionsWithoutConsent(): array
    {
        return [
            'omitted entirely' => [null],
            'false' => [false],
            // A truthy STRING is rejected along with the rest. Consent travels
            // as a JSON boolean and nothing else, because the moment a string
            // is read for truth, `"false"` asserts consent.
            'the string true' => ['true'],
            'the string on, as an HTML checkbox would post it' => ['on'],
            'the string one' => ['1'],
            'the number one' => [1],
            'an empty string' => [''],
            'zero' => [0],
        ];
    }

    /**
     * @param mixed $consent
     */
    #[DataProvider('submissionsWithoutConsent')]
    public function testASubmissionMissingTheConsentItsOptinDeclaresIsRejected($consent): void
    {
        $submitted = ['fields' => ['email' => 'sarah@example.com']];

        if ($consent !== null) {
            $submitted['consent'] = $consent;
        }

        $refusal = self::validate(self::template([self::consentNode()]), $submitted);

        $this->assertInstanceOf(Refusal::class, $refusal);
        $this->assertSame('consent', $refusal->field);
    }

    public function testAConsentedSubmissionIsAccepted(): void
    {
        $capture = self::validate(
            self::template([self::consentNode()]),
            ['fields' => ['email' => 'sarah@example.com'], 'consent' => true]
        );

        $this->assertInstanceOf(Capture::class, $capture);
        $this->assertSame('sarah@example.com', $capture->email);
    }

    /**
     * **The check keys off the node's PRESENCE, never its wording.**
     *
     * A snapshot carries Slot Roles and no words, so an Optin can hold a
     * `consent` node whose `consent_text` has not been filled in yet. Keying
     * enforcement off the text would make that Optin render a required
     * checkbox the browser enforces and the server does not — the one
     * combination worse than either. Declaring the node is the declaration;
     * the wording is the evidence, and missing evidence is a copy gap for the
     * merchant to close, not a licence to stop asking.
     */
    public function testAConsentNodeWithNoWordingYetStillEnforces(): void
    {
        $refusal = self::validate(
            self::template([['type' => 'consent', 'role' => 'consent_text']]),
            ['fields' => ['email' => 'sarah@example.com']]
        );

        $this->assertInstanceOf(Refusal::class, $refusal);
        $this->assertSame('consent', $refusal->field);
    }

    /**
     * Off by default: the roughly 90% of installs that do not want a checkbox
     * do not get one, and do not get an enforcement rule either (ADR 0032).
     */
    public function testAnOptinDeclaringNoConsentNodeAsksForNone(): void
    {
        $capture = self::validate(self::template(), ['fields' => ['email' => 'sarah@example.com']]);

        $this->assertInstanceOf(Capture::class, $capture);
        $this->assertArrayNotHasKey('consent_text', $capture->fields);
    }

    /**
     * The Consent Record is the wording **exactly as it was shown**, and the
     * server holds that wording already — it is in the published config the
     * payload was projected from. Reading it from the submission instead would
     * make a public endpoint the author of its own evidence.
     */
    public function testTheConsentRecordIsSnapshottedFromTheOptinAndNotFromTheSubmission(): void
    {
        $capture = self::validate(self::template([self::consentNode()]), [
            'fields' => ['email' => 'sarah@example.com'],
            'consent' => true,
            'consent_text' => 'I agreed to absolutely nothing',
        ]);

        $this->assertInstanceOf(Capture::class, $capture);
        $this->assertSame(
            'I agree to receive emails and accept the privacy policy.',
            $capture->fields['consent_text']
        );
    }

    /**
     * With no policy configured the link renders nothing — never a dead `#`
     * (ADR 0032) — so the sentence the visitor saw is the one with the
     * placeholder taken out, and that is what the record has to say.
     */
    public function testTheConsentRecordMatchesTheSentenceShownWhenNoPolicyLinkResolved(): void
    {
        $capture = self::validate(self::template([self::consentNode(null)]), [
            'fields' => ['email' => 'sarah@example.com'],
            'consent' => true,
        ]);

        $this->assertInstanceOf(Capture::class, $capture);
        $this->assertSame('I agree to receive emails and accept the.', $capture->fields['consent_text']);
    }

    /**
     * The form is the step that SUBMITS, which follows from the tree — a
     * submit button outside a form submits nothing, so the step holding one is
     * the form (`resources/renderer/src/render.ts`). A `field` sitting on the
     * terminal success step was never on screen to fill in, so requiring it
     * would refuse every submission of a form that does not contain it.
     */
    public function testOnlyTheStepThatSubmitsIsTheForm(): void
    {
        $template = self::template();
        $template['tree']['steps'][1]['children'][] = ['type' => 'field', 'name' => 'phone', 'required' => true];

        $capture = self::validate($template, ['fields' => ['email' => 'sarah@example.com']]);

        $this->assertInstanceOf(Capture::class, $capture);
        $this->assertNull($capture->phone);
    }

    public function testARequiredFieldLeftEmptyIsRefusedWhileTheVisitorCanStillFillItIn(): void
    {
        $refusal = self::validate(self::template(), ['fields' => ['email' => '']]);

        $this->assertInstanceOf(Refusal::class, $refusal);
        $this->assertSame('email', $refusal->field);
    }

    public function testAnIdentifierThatCannotBeCanonicalisedIsRefusedAgainstItsOwnField(): void
    {
        $template = self::template([['type' => 'field', 'name' => 'phone']]);

        $refusal = self::validate($template, [
            'fields' => ['email' => 'sarah@example.com', 'phone' => '07911 123456'],
        ]);

        $this->assertInstanceOf(Refusal::class, $refusal);
        $this->assertSame('phone', $refusal->field);
    }

    public function testIdentifiersAreStoredCanonicalisedAndNotAsTyped(): void
    {
        $template = self::template([['type' => 'field', 'name' => 'phone']]);

        $capture = self::validate($template, [
            'fields' => ['email' => ' Sarah@Example.COM ', 'phone' => '+1 (202) 555-1234'],
        ]);

        $this->assertInstanceOf(Capture::class, $capture);
        $this->assertSame('sarah@example.com', $capture->email);
        $this->assertSame('+12025551234', $capture->phone);
    }

    /**
     * `email` and `phone` are real indexed columns because they are the
     * identity keys, and everything else the Optin captured goes in one
     * `fields` JSON (ADR 0002).
     */
    public function testEverythingOtherThanTheIdentityKeysLandsInTheFieldsJson(): void
    {
        $template = self::template([['type' => 'field', 'name' => 'name']]);

        $capture = self::validate($template, [
            'fields' => ['email' => 'sarah@example.com', 'name' => 'Sarah'],
        ]);

        $this->assertInstanceOf(Capture::class, $capture);
        $this->assertSame(['name' => 'Sarah'], $capture->fields);
    }

    /**
     * The vocabulary is closed, so a key the form never declared is a mistake
     * rather than an extension — the same posture the template vocabulary
     * takes on the way in (ADR 0010).
     */
    public function testAValueForAFieldTheFormNeverDeclaredIsDropped(): void
    {
        $capture = self::validate(self::template(), [
            'fields' => ['email' => 'sarah@example.com', 'phone' => '+12025551234', 'nickname' => 'Sar'],
        ]);

        $this->assertInstanceOf(Capture::class, $capture);
        $this->assertNull($capture->phone);
        $this->assertSame([], $capture->fields);
    }

    /**
     * WSMS's `ContactRepository::create()` hard-requires one of the two
     * (ADR 0002), and a Lead carrying neither can never be grouped, exported
     * usefully or pushed anywhere.
     */
    public function testASubmissionCarryingNeitherIdentifierIsRefused(): void
    {
        $template = self::template([['type' => 'field', 'name' => 'name']]);
        $template['tree']['steps'][0]['children'][1] = ['type' => 'field', 'name' => 'email'];

        $refusal = self::validate($template, ['fields' => ['name' => 'Sarah']]);

        $this->assertInstanceOf(Refusal::class, $refusal);
    }

    /**
     * A click-metered Optin carries no form, produces no Lead and holds no
     * Consent Record (ADR 0025). There is nothing for a submission to satisfy,
     * so there is nothing to accept.
     */
    public function testAClickMeteredOptinCapturesNothing(): void
    {
        $template = [
            'tree' => ['steps' => [[
                'type' => 'stack',
                'children' => [['type' => 'button', 'label' => 'Shop the sale', 'action' => 'link', 'href' => 'https://example.test/sale']],
            ]]],
            'tokens' => [],
        ];

        $this->assertInstanceOf(Refusal::class, self::validate($template, ['fields' => ['email' => 'sarah@example.com']]));
    }
}

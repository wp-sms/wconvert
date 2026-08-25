<?php

namespace WConvert\Tests\Unit\Playbook;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\RejectionReason;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

/**
 * **Validation happens at registration, never at runtime.**
 *
 * These checks replace runtime warnings *by design*, so they are the only
 * place the guarantee lives. One test per rejection, because a single
 * "invalid entries are dropped" test passes whichever rule fired — including
 * the wrong one.
 *
 * Registration is also the last moment an author is present. A [[Playbook]] is
 * data, so a third party can add one; a rule enforced at prefill would reach
 * them as a merchant's bug report about a popup with no headline.
 */
#[CoversClass(PlaybookLibrary::class)]
final class PlaybookRegistrationTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    /**
     * A valid entry, which every test below breaks in exactly one way.
     *
     * It serves `grow_email_list`, which is submit-metered, on the shipped
     * submit-metered Template — so the pairing is right and the copy names
     * only Roles that Template declares.
     *
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private static function entry(array $overrides = []): array
    {
        return array_merge([
            'id' => 'welcome-discount',
            'name' => 'Welcome discount',
            'goal' => 'grow_email_list',
            'template_id' => 'centred-card',
            'copy' => [
                'headline' => 'Ten percent off your first order',
                'cta_label' => 'Send my code',
                'email_label' => 'Email address',
            ],
            'rules' => [['type' => 'page_load']],
        ], $overrides);
    }

    /**
     * @param array<string, mixed> $entry
     */
    private function library(array $entry): PlaybookLibrary
    {
        return PlaybookLibrary::fromEntries(
            [$entry],
            TemplateLibrary::fromDirectory(TemplateVocabulary::fromManifest(self::PLUGIN_DIR), self::PLUGIN_DIR),
            TemplateVocabulary::fromManifest(self::PLUGIN_DIR),
            RuleVocabulary::fromManifest(self::PLUGIN_DIR)
        );
    }

    /**
     * @param array<string, mixed> $entry
     */
    private function assertRejected(array $entry, RejectionReason $reason): void
    {
        $library = $this->library($entry);

        $this->assertSame([], $library->all(), 'the entry registered when it should have been refused');
        $this->assertSame([$reason], array_map(
            static fn (\WConvert\Support\Rejection $r): RejectionReason => $r->reason,
            $library->rejections()
        ));
    }

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestDoingItWrong'] = [];
    }

    /**
     * **A refusal is not silent.**
     *
     * An entry that simply vanished looks exactly like a registry that failed
     * to load, which is the hardest failure to notice. It goes to
     * `_doing_it_wrong()` rather than to an admin notice because a rejection
     * is an AUTHORING error: the merchant cannot act on "this entry fills a
     * Slot Role its Template does not declare", and a notice they cannot act
     * on is one they learn to dismiss.
     */
    public function testARefusedEntrySaysSoWhereItsAuthorIsWorking(): void
    {
        $this->library(self::entry(['copy' => ['phone_label' => 'Mobile']]));

        /** @var list<array{where: string, message: string}> $warnings */
        $warnings = $GLOBALS['wconvertTestDoingItWrong'];

        $this->assertCount(1, $warnings);
        $this->assertStringContainsString('welcome-discount', $warnings[0]['message']);
        $this->assertStringContainsString(RejectionReason::UnfilledSlotRole->value, $warnings[0]['message']);
    }

    public function testAWellFormedEntryRegistersAndSaysNothing(): void
    {
        $this->library(self::entry());

        $this->assertSame([], $GLOBALS['wconvertTestDoingItWrong']);
    }

    public function testAWellFormedEntryRegisters(): void
    {
        $library = $this->library(self::entry());

        $this->assertSame([], $library->rejections());
        $this->assertSame(['welcome-discount'], array_keys($library->all()));
    }

    /**
     * **Rejection one: a Slot Role the default Template does not declare.**
     *
     * A Role a Template does not declare is dropped when a Playbook prefills
     * it — a case prevented at authoring time, since a Playbook's default
     * Template is validated to declare every Role it fills (CONTEXT.md, Slot
     * Role). Without this the words simply vanish and nothing says so.
     */
    public function testAPlaybookFillingARoleItsTemplateDoesNotDeclareIsRejected(): void
    {
        $this->assertRejected(
            self::entry(['copy' => ['headline' => 'Hi', 'phone_label' => 'Mobile number']]),
            RejectionReason::UnfilledSlotRole
        );
    }

    /**
     * **Rejection two, in its first shape: a post id in the targeting.**
     *
     * Which rule types name something site-local is read off the rule
     * manifest's `value` rather than listed here — `post_id` and `term_id` are
     * ids, `post_type` and `path_glob` are not. A list would be the fifth
     * hand-maintained cross-cutting list this project has refused (ADR 0019).
     */
    public function testAPlaybookNamingAPostIdInItsTargetingIsRejected(): void
    {
        $this->assertRejected(
            self::entry(['targeting' => ['include' => [['type' => 'post', 'value' => 42]]]]),
            RejectionReason::SiteLocalReference
        );
    }

    public function testAPlaybookNamingATermIdInItsTargetingIsRejected(): void
    {
        $this->assertRejected(
            self::entry(['targeting' => ['include' => [['type' => 'term', 'value' => 7]]]]),
            RejectionReason::SiteLocalReference
        );
    }

    /**
     * Targeting that names a page SET rather than a page is fine — a post
     * type and a path glob mean the same thing on every install.
     */
    public function testAPlaybookMayTargetAPageSetThatMeansTheSameOnEveryInstall(): void
    {
        $entry = self::entry(['targeting' => ['include' => [['type' => 'url', 'value' => '/shop/*']]]]);

        $this->assertSame([], $this->library($entry)->rejections());
    }

    /**
     * **Rejection two, in its second shape: a Destination id.**
     *
     * A destination hint names Destination *types* and the [[Lead]] fields the
     * Playbook needs. An id is a row on one site's install, and prefill never
     * binds a Destination invisibly.
     */
    public function testAPlaybookNamingADestinationIdIsRejected(): void
    {
        $this->assertRejected(
            self::entry(['destination_hint' => ['types' => ['wsms'], 'id' => '01JQ00000000000000000000AA']]),
            RejectionReason::SiteLocalReference
        );
    }

    /**
     * **Rejection two, in its third shape: the privacy-policy link.**
     *
     * A link that declares a label and names no destination is asking for the
     * one destination only the site can name, and the renderer resolves it
     * from `get_privacy_policy_url()` (ADR 0032). A Playbook that supplies the
     * href instead is naming a page on one particular site — so a Playbook's
     * copy carries labels and never hrefs.
     */
    public function testAPlaybookSupplyingItsOwnHrefIsRejected(): void
    {
        $this->assertRejected(
            self::entry(['copy' => [
                'headline' => 'Hi',
                'fine_print' => ['text' => 'See our %s', 'link' => [
                    'label' => 'Privacy Policy',
                    'href' => 'https://example.com/privacy',
                ]],
            ]]),
            RejectionReason::SiteLocalReference
        );
    }

    /**
     * **Rejection two, in the shape a Destination id actually arrives in.**
     *
     * Checking the hint's KEYS catches `['id' => '01JQ…']` and misses
     * `['types' => ['01JQ…']]`, which is the same id wearing a type's clothes
     * — and the one an author would plausibly write, because they were looking
     * at a list of their own Destinations when they wrote it.
     */
    public function testAPlaybookNamingADestinationIdInsideItsHintIsRejected(): void
    {
        $this->assertRejected(
            self::entry(['destination_hint' => ['types' => ['01JQ00000000000000000000AA']]]),
            RejectionReason::SiteLocalReference
        );
    }

    /**
     * One [[Template]] serves exactly one [[Display Type]], so an entry
     * declaring a different one describes something that cannot exist —
     * and deriving it silently files a popup under "floating bar".
     */
    public function testAPlaybookDeclaringADisplayTypeItsTemplateDoesNotServeIsRejected(): void
    {
        $this->assertRejected(self::entry(['display_type' => 'floating_bar']), RejectionReason::DisplayTypeMismatch);
    }

    public function testAPlaybookMayAgreeWithItsTemplateAboutTheDisplayType(): void
    {
        $this->assertSame([], $this->library(self::entry(['display_type' => 'popup']))->rejections());
    }

    public function testAPlaybookMaySupplyTheWordingOfALinkTheSiteResolves(): void
    {
        $entry = self::entry(['copy' => [
            'headline' => 'Hi',
            'fine_print' => ['text' => 'See our %s', 'link' => ['label' => 'Privacy Policy']],
        ]]);

        $this->assertSame([], $this->library($entry)->rejections());
    }

    /**
     * **Rejection three: the Goal and the Template disagree about what counts.**
     *
     * A [[Goal]] declares the metric that counts it, and a Template offers
     * exactly one converting act. Paired the wrong way round, the Optin
     * reports nothing at all — the Goal counts a submission and the design
     * offers a click. It is the same reasoning that rejects a Template
     * offering both (ADR 0020), applied one layer up where the pairing is
     * made.
     */
    public function testAPlaybookPairingAClickGoalWithASubmitTemplateIsRejected(): void
    {
        $this->assertRejected(
            self::entry(['goal' => 'promote_offer', 'copy' => ['headline' => 'Hi']]),
            RejectionReason::MetricMismatch
        );
    }

    public function testAPlaybookNamingAGoalThisInstallDoesNotHaveIsRejected(): void
    {
        $this->assertRejected(self::entry(['goal' => 'increase_brand_awareness']), RejectionReason::UnknownReference);
    }

    public function testAPlaybookNamingATemplateThisInstallDoesNotShipIsRejected(): void
    {
        $this->assertRejected(self::entry(['template_id' => 'from-a-plugin-we-lack']), RejectionReason::UnknownReference);
    }

    /**
     * **Rejection four: a Playbook that prefills an Optin which can never
     * fire.**
     *
     * Every Optin has at least one [[Trigger]], and "shows immediately" is the
     * explicit `page_load` Trigger rather than an empty list (CONTEXT.md,
     * Trigger). Prefilling without one is a silent, total loss of function
     * with nothing in any log — ADR 0012's defining support ticket — and
     * supplying `page_load` on the author's behalf would invent display
     * behaviour nobody asked for.
     */
    public function testAPlaybookNamingNoTriggerIsRejected(): void
    {
        $this->assertRejected(self::entry(['rules' => []]), RejectionReason::NoTrigger);
    }

    /**
     * A [[Condition]] is not a Trigger, and an Optin holding only Conditions
     * is eligible to be shown at a moment that never arrives.
     */
    public function testAPlaybookNamingOnlyConditionsIsRejectedToo(): void
    {
        $this->assertRejected(
            self::entry(['rules' => [['type' => 'device', 'value' => ['mobile']]]]),
            RejectionReason::NoTrigger
        );
    }

    /**
     * **Rejection five: two entries claiming one id.**
     *
     * The second would silently replace the first, and a merchant looking at a
     * gallery that lost a card has nothing to read. Third parties add
     * Playbooks, so a collision is a matter of time rather than a typo.
     */
    public function testASecondEntryClaimingAnIdIsRejectedRatherThanReplacingTheFirst(): void
    {
        $library = PlaybookLibrary::fromEntries(
            [self::entry(['name' => 'The first one']), self::entry(['name' => 'The impostor'])],
            TemplateLibrary::fromDirectory(TemplateVocabulary::fromManifest(self::PLUGIN_DIR), self::PLUGIN_DIR),
            TemplateVocabulary::fromManifest(self::PLUGIN_DIR),
            RuleVocabulary::fromManifest(self::PLUGIN_DIR)
        );

        $this->assertSame('The first one', $library->all()['welcome-discount']->name);
        $this->assertSame(RejectionReason::DuplicateId, $library->rejections()[0]->reason);
    }

    public function testAnEntryWithNoIdIsRejected(): void
    {
        $this->assertRejected(self::entry(['id' => '']), RejectionReason::Malformed);
    }

    /**
     * One bad entry must not take the gallery down with it. A Playbook is
     * data and third parties add them, so a registry that threw would turn
     * someone else's typo into a blank creation flow.
     */
    public function testARefusedEntryDoesNotTakeTheGoodOnesWithIt(): void
    {
        $library = PlaybookLibrary::fromEntries(
            [self::entry(), self::entry(['id' => 'broken', 'goal' => 'nonsense'])],
            TemplateLibrary::fromDirectory(TemplateVocabulary::fromManifest(self::PLUGIN_DIR), self::PLUGIN_DIR),
            TemplateVocabulary::fromManifest(self::PLUGIN_DIR),
            RuleVocabulary::fromManifest(self::PLUGIN_DIR)
        );

        $this->assertSame(['welcome-discount'], array_keys($library->all()));
        $this->assertSame('broken', $library->rejections()[0]->id);
    }
}

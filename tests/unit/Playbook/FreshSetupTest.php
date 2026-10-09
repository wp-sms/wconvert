<?php

namespace WConvert\Tests\Unit\Playbook;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Destination\OptinBinding;
use WConvert\Goal\Goal;
use WConvert\Optin\PhoneCountry;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Playbook\Prefill;
use WConvert\Privacy\PrivacyGuidance;
use WConvert\Pro\Template\ProPlaybooks;
use WConvert\Pro\Template\ProTemplates;
use WConvert\Rules\DisplayPlan;
use WConvert\Rules\RuleVocabulary;
use WConvert\Template\BundledTemplates;
use WConvert\Template\CaptureContract;
use WConvert\Template\LockedTemplates;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\InstalledRules;

/**
 * **A fresh setup has nothing to fix** (ADR 0133).
 *
 * Every bundled [[Playbook]], Free and Pro, goes through {@see Prefill} and
 * then through the checks `OptinController::publish()` runs, with no edit in
 * between. A merchant who picks a recommended setup and presses Publish should
 * not meet a list of things to fix that the setup itself created.
 *
 * The one allowed exception is a real merchant choice: a cart recommendation
 * that has to name the product it accessorises.
 */
#[CoversClass(Prefill::class)]
final class FreshSetupTest extends TestCase
{
    private const ROOT = __DIR__ . '/../../..';
    private const POLICY = 'https://example.test/privacy/';

    /**
     * Setups whose one blocker is a choice only the merchant can make: which
     * products to recommend. No default product is a safe guess.
     */
    private const MERCHANT_CHOICES = [
        // The main product, which both checks read as the one missing choice.
        'recommend-accessory' => ['commerce_products', 'Use a design whose button links to your offer or content before publishing.'],
        'add-useful-extras' => ['commerce_products'],
        'product-finder' => ['products'],
        'gift-finder' => ['products'],
        'experience-kit-finder' => ['products'],
        'space-fit-finder' => ['products'],
    ];

    protected function setUp(): void
    {
        // A Pro install with WooCommerce: the setups that need them are Pro's.
        $GLOBALS['wconvertTestFilters']['wconvert_journeys'][] = static fn (): bool => true;
        $GLOBALS['wconvertTestFilters']['wconvert_commerce'][] = static fn (): bool => true;
    }

    protected function tearDown(): void
    {
        unset($GLOBALS['wconvertTestFilters']['wconvert_journeys'], $GLOBALS['wconvertTestFilters']['wconvert_commerce']);
    }

    /** @return iterable<string, array{string}> */
    public static function setups(): iterable
    {
        foreach (self::playbooks()->all() as $playbook) {
            yield $playbook->id => [$playbook->id];
        }
    }

    #[DataProvider('setups')]
    public function testItPublishesWithNoEdits(string $id): void
    {
        $playbooks = self::playbooks();
        $draft = (new Prefill($playbooks, self::templates(), self::vocabulary(), InstalledRules::withPro(), new PrivacyGuidance(new FakeOptionStore())))->fromPlaybook($id);
        $this->assertNotNull($draft);
        $config = $draft['config'];
        $goal = $draft['goal'];
        $blockers = [];

        $blockers[] = DisplayPlan::issues($config['display_rules'] ?? [], RuleVocabulary::fromManifest(self::ROOT)) === [] ? null : 'display';
        $blockers[] = CaptureContract::issue($config, $goal, self::POLICY, false);
        $outcome = Goal::from($goal)->outcome();
        $blockers[] = $outcome->designIssue($config);
        $this->assertSame('local', OptinBinding::captureMode($config), 'a fresh setup keeps leads in WConvert');
        $blockers[] = $outcome->handoffIssue([], OptinBinding::captureMode($config));
        // The site language's region, which is what a site with no default in Settings uses.
        $blockers[] = PhoneCountry::resolved($config, PhoneCountry::suggestion(null, 'en_GB')['country'] ?? null) === null ? 'phone_country' : null;

        $blockers = array_values(array_filter($blockers));
        $expected = self::MERCHANT_CHOICES[$id] ?? [];

        $this->assertSame($expected, $blockers, "{$id} opens with something to fix");
    }

    private static function vocabulary(): TemplateVocabulary
    {
        return TemplateVocabulary::fromManifest(self::ROOT);
    }

    private static function templates(): TemplateLibrary
    {
        return TemplateLibrary::from(
            self::vocabulary(),
            new BundledTemplates(self::ROOT),
            new ProTemplates(self::ROOT . '/pro'),
            new LockedTemplates(self::ROOT),
        );
    }

    private static function playbooks(): PlaybookLibrary
    {
        return PlaybookLibrary::fromDirectory(
            self::templates(),
            self::vocabulary(),
            RuleVocabulary::fromManifest(self::ROOT),
            self::ROOT,
            (new ProPlaybooks(self::ROOT . '/pro'))->entries(),
        );
    }
}

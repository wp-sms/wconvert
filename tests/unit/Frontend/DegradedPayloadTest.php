<?php

namespace WConvert\Tests\Unit\Frontend;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Frontend\Payload;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedOptin;
use WConvert\Optin\PublishedSet;
use WConvert\Rules\Degradation;
use WConvert\Rules\RuleVocabulary;
use WConvert\Targeting\RequestContext;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\InstalledRules;

/**
 * =============================================================================
 * THE CASE THAT WAS LIVE AND SILENT UNTIL THIS TICKET.
 * =============================================================================
 * An [[Optin]] is authored on an install that HAS [[Pro]], published, and then
 * Pro goes away — deactivated, deleted, or the site restored from a backup
 * that predates it. The premium rule is still sitting in `published_config`,
 * because entitlement is deliberately kept out of the stored projection and
 * **config outlives the code that reads it** (ADR 0012, ADR 0027).
 *
 * This walks that whole path with the real repository and the real published
 * set: publish with Pro, serve without it, and assert what the page carries.
 * The unit-level asymmetries are in `tests/unit/Rules/DegradationTest.php`;
 * what is proven here is that the resolver is actually WIRED to the page.
 */
#[CoversClass(Payload::class)]
#[CoversClass(Degradation::class)]
#[CoversClass(PublishedOptin::class)]
final class DegradedPayloadTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    private PublishedSet $publishedSet;

    private OptinRepository $repository;

    protected function setUp(): void
    {
        $this->publishedSet = new PublishedSet(new FakeOptionStore());
        $this->repository = new OptinRepository(
            new FakeConnection(),
            $this->publishedSet,
            RuleVocabulary::fromManifest(self::PLUGIN_DIR),
            new MilestoneStore(new FakeOptionStore()
        ));
    }

    /**
     * Published the way the builder publishes: a draft written and promoted,
     * so the projection under test is the one the site would actually serve.
     *
     * @param list<array<string, mixed>> $rules
     */
    private function publish(array $rules): string
    {
        $optin = $this->repository->create('Spring sale', 'grow_email_list', ['rules' => $rules]);
        $this->repository->publish($optin->id);

        return $optin->id;
    }

    /**
     * @return list<array<string, mixed>> What a visitor's page would carry.
     */
    private function servedTo(Degradation $install): array
    {
        return Payload::forRequest(
            PublishedOptin::fromSet($this->publishedSet->all()),
            new RequestContext(path: '/pricing/'),
            $install
        );
    }

    /**
     * The headline case. `exit_intent` was the Optin's only way of firing, and
     * a *dropped* premium Trigger leaves an Optin that never fires again with
     * nothing in any log — so it is substituted, with the substitute's params
     * filled, and capture keeps working (ADR 0012).
     */
    public function testAnOptinAuthoredWithProKeepsFiringOnAnInstallThatLostIt(): void
    {
        $this->publish([['type' => 'exit_intent']]);

        $served = $this->servedTo(InstalledRules::free());

        $this->assertCount(1, $served);
        $this->assertSame([['type' => 'time_on_page', 'seconds' => 15]], $served[0]['triggers']);
    }

    /** And on the install it was authored on, nothing about it changes. */
    public function testTheSameOptinIsUntouchedWhereProIsStillLoaded(): void
    {
        $this->publish([['type' => 'exit_intent']]);

        $this->assertSame([['type' => 'exit_intent']], $this->servedTo(InstalledRules::withPro())[0]['triggers']);
    }

    /**
     * **A premium Condition is dropped**, which only widens the audience — the
     * safe direction to fail in. Left in the payload it would fail shut in
     * free's evaluator, and the Optin would never show with nothing saying why
     * (ADR 0012, ADR 0028).
     */
    public function testAPremiumConditionIsStrippedRatherThanShippedToAnEvaluatorThatLacksIt(): void
    {
        $this->publish([['type' => 'page_load'], ['type' => 'query_param', 'key' => 'utm_source']]);

        $served = $this->servedTo(InstalledRules::free());

        $this->assertSame([], $served[0]['conditions']);
        $this->assertSame([['type' => 'page_load']], $served[0]['triggers']);
    }

    /**
     * ========================================================================
     * A SUSPENDED OPTIN IS ABSENT FROM THE PAGE — NOT SHOWN WITHOUT ITS RULE,
     * AND NOT SHOWN INERT.
     * ========================================================================
     * `click_element` has no honest substitute: its selector names something
     * only one site has. So this Optin cannot fire at all on a free install,
     * and it is left out of the payload rather than shipped as an Optin that
     * silently never fires (ADR 0027).
     */
    public function testAnOptinWithNoWayLeftToFireIsLeftOffThePageEntirely(): void
    {
        $this->publish([['type' => 'click_element', 'selector' => '#buy']]);

        $this->assertSame([], $this->servedTo(InstalledRules::free()));
    }

    /**
     * ========================================================================
     * SELF-HEALING, BECAUSE NOTHING WAS DESTROYED.
     * ========================================================================
     * The published set is untouched by any of this — suspension is computed
     * against the live registry at enqueue, never stored (ADR 0027) — so the
     * day Pro comes back the same stored bytes serve the Optin again, with no
     * republish and no repair step.
     */
    public function testTheSuspendedOptinIsStillStoredAndResumesWhenProReturns(): void
    {
        $id = $this->publish([['type' => 'click_element', 'selector' => '#buy']]);

        $this->assertSame([$id], array_column($this->publishedSet->all(), 'id'), 'nothing was removed from storage');

        $served = $this->servedTo(InstalledRules::withPro());

        $this->assertSame([$id], array_column($served, 'id'));
        $this->assertSame([['type' => 'click_element', 'selector' => '#buy']], $served[0]['triggers']);
    }

    /**
     * Degradation does not touch an Optin that names no premium rule, and the
     * proof is byte-level: an entry that came back with a key it did not have
     * would be paying for the substitution mechanism on every page view of
     * every site that never needed it, against a 2KB budget.
     */
    public function testAnOptinNamingNoPremiumRuleIsServedByteForByteAsPublished(): void
    {
        $this->publish([['type' => 'time_on_page', 'seconds' => 8], ['type' => 'device', 'in' => ['mobile']]]);

        $this->assertSame(
            PublishedOptin::fromSet($this->publishedSet->all())[0]->toPayloadEntry(),
            $this->servedTo(InstalledRules::free())[0]
        );
    }
}

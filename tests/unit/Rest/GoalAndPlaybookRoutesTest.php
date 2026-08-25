<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Goal\GoalRegistry;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Playbook\Prefill;
use WConvert\Rest\GoalController;
use WConvert\Rest\PlaybookController;
use WConvert\Rest\Routes;
use WConvert\Rules\RuleVocabulary;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeSitePresence;

/**
 * The creation flow's route REGISTRATION, which is where two of its
 * guarantees live and nowhere else.
 *
 * Same division the other REST tests draw: what these controllers DO is
 * {@see GoalRegistry}, {@see PlaybookLibrary} and {@see Prefill}, each with
 * its own tests; what they ARE is only visible here.
 *
 * **Prefill persists nothing, and a `GET` is what says so.** The endpoint
 * returns the body `POST /wconvert/v1/optins` takes and stops — a merchant who
 * browses the gallery, prefills three drafts and closes the tab has created
 * nothing. Registered as a `POST` it would be indistinguishable from one that
 * did, to a reader and to a caching layer alike.
 *
 * **The gallery filters on Goal only.** [[Display Type]] is not the primary
 * axis of the product (CONTEXT.md, Display Type), and a second filter
 * parameter here is exactly how it would become one.
 */
#[CoversClass(GoalController::class)]
#[CoversClass(PlaybookController::class)]
final class GoalAndPlaybookRoutesTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];

        $vocabulary = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
        $templates = TemplateLibrary::fromDirectory($vocabulary, self::PLUGIN_DIR);
        $playbooks = PlaybookLibrary::fromDirectory(
            $templates,
            $vocabulary,
            RuleVocabulary::fromManifest(self::PLUGIN_DIR),
            self::PLUGIN_DIR
        );
        $goals = new GoalRegistry(new FakeProPresence(), new FakeSitePresence());

        (new GoalController($goals))->registerRoutes();
        (new PlaybookController($playbooks, $goals, new Prefill($playbooks, $templates, $vocabulary)))
            ->registerRoutes();
    }

    /**
     * @return list<array{namespace: string, route: string, args: array<mixed>}>
     */
    private static function routes(): array
    {
        /** @var list<array{namespace: string, route: string, args: array<mixed>}> $routes */
        $routes = $GLOBALS['wconvertTestRoutes'];

        return $routes;
    }

    /**
     * @return array{methods: string, permission_callback: mixed, args?: array<string, mixed>}
     */
    private static function handlerOn(string $route): array
    {
        foreach (self::routes() as $registered) {
            if ($registered['route'] === $route) {
                /** @var list<array{methods: string, permission_callback: mixed, args?: array<string, mixed>}> $handlers */
                $handlers = $registered['args'];

                self::assertCount(1, $handlers, "{$route} declares one handler");

                return $handlers[0];
            }
        }

        self::fail("{$route} is not registered");
    }

    public function testTheCreationFlowIsThreeRoutesInWConvertsNamespace(): void
    {
        $this->assertSame(
            ['/goals', '/playbooks', '/playbooks/prefill'],
            array_column(self::routes(), 'route')
        );

        foreach (self::routes() as $route) {
            $this->assertSame(Routes::NAMESPACE, $route['namespace']);
        }
    }

    /**
     * **Read-only, all three.** The Goal set is closed and Playbooks are data
     * shipped with the plugin, so there is nothing here to author — and
     * prefill persists nothing until the merchant saves.
     */
    public function testEveryRouteIsAReadAndProvesPrefillWritesNothing(): void
    {
        foreach (['/goals', '/playbooks', '/playbooks/prefill'] as $route) {
            $this->assertSame('GET', self::handlerOn($route)['methods'], "{$route} is not a read");
        }
    }

    /**
     * Every WConvert surface is an administration surface, so one capability
     * covers all of it — with exactly two exceptions, capture and the beacon,
     * and neither of them is here (see {@see Routes}).
     */
    public function testNoneOfTheCreationFlowIsPublic(): void
    {
        foreach (['/goals', '/playbooks', '/playbooks/prefill'] as $route) {
            $this->assertSame(
                [Routes::class, 'canManage'],
                self::handlerOn($route)['permission_callback'],
                "{$route} does not require manage_options"
            );
        }
    }

    /**
     * The gallery takes one filter and it is the Goal. This is the assertion
     * that would fail on the day somebody adds `display_type` — which reads as
     * a small convenience and is the product's primary axis moving.
     */
    public function testTheGalleryFiltersOnGoalAndOnNothingElse(): void
    {
        $args = self::handlerOn('/playbooks')['args'] ?? [];

        $this->assertSame(['goal'], array_keys($args));
        $this->assertTrue($args['goal']['required']);
    }

    /**
     * **"Start from scratch" skips the Playbook, never the Goal**, and the
     * registration is where that is structural: `goal` is required and
     * `playbook_id` is not.
     */
    public function testPrefillRequiresAGoalAndTreatsThePlaybookAsOptional(): void
    {
        $args = self::handlerOn('/playbooks/prefill')['args'] ?? [];

        $this->assertTrue($args['goal']['required']);
        $this->assertArrayNotHasKey('required', $args['playbook_id']);
    }
}

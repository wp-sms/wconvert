<?php

namespace WConvert\Tests\Unit\Agent;

use WConvert\Agent\CampaignReader;
use WConvert\Discovery\OccasionStore;
use WConvert\Goal\GoalRegistry;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Optin\PublishReadiness;
use WConvert\Optin\SiteFrequency;
use WConvert\Rest\OccasionController;
use WConvert\Rest\OptinController;
use WConvert\Rules\RuleCatalogue;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\SiteDependency;
use WConvert\Support\Tier;
use WConvert\Targeting\RoleRegistry;
use WConvert\Template\CampaignBuilder;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeSitePresence;
use WConvert\Tests\Unit\Support\InstalledRules;
use WConvert\Tests\Unit\Support\LeaseReleasingWpdb;
use WP_REST_Request;

/**
 * A site an agent can talk to: the real Optin and occasion controllers behind
 * `rest_do_request()`, routed the way WordPress routes them, on a free or a
 * Pro install.
 */
final class AgentSite
{
    public const PLUGIN_DIR = __DIR__ . '/../../..';

    public readonly OptinRepository $optins;
    public readonly OptinController $controller;
    public readonly OccasionController $occasionController;
    public readonly OccasionStore $occasions;
    public readonly TemplateVocabulary $templates;
    public readonly RuleVocabulary $rules;
    public readonly TemplateLibrary $library;
    public readonly FakeProPresence $pro;
    public readonly CampaignBuilder $builder;
    public readonly CampaignReader $reader;
    public readonly PublishReadiness $readiness;
    public readonly FakeConnection $db;

    /** @var list<string> Every internal call, as `METHOD /route`. */
    public array $dispatched = [];

    public function __construct(Tier $tier = Tier::Pro)
    {
        $GLOBALS['wconvertTestRoutes'] = [];
        $GLOBALS['wconvertTestOptionTable'] = [];
        $GLOBALS['wpdb'] = new LeaseReleasingWpdb();
        \WConvert\Tests\Unit\Support\Journeys::on();

        $this->templates = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
        $this->rules = RuleVocabulary::fromManifest(self::PLUGIN_DIR);
        $published = new PublishedSet(new FakeOptionStore());
        $this->pro = new FakeProPresence($tier);
        $site = new FakeSitePresence([SiteDependency::WooCommerce]);
        $milestones = new FakeOptionStore();
        $sources = [new \WConvert\Template\BundledTemplates(self::PLUGIN_DIR)];
        if ($tier !== Tier::Free) $sources[] = new \WConvert\Pro\Template\ProTemplates(self::PLUGIN_DIR . '/pro');
        $sources[] = new \WConvert\Template\LockedTemplates(self::PLUGIN_DIR);
        $this->library = TemplateLibrary::from($this->templates, ...$sources);

        $this->optins = new OptinRepository($this->db = new FakeConnection(), $published, $this->rules, new MilestoneStore($milestones));
        $destinations = new \WConvert\Destination\DestinationStore(new FakeOptionStore());
        $destinationTypes = new \WConvert\Destination\DestinationRegistry($this->pro, $site);
        $this->controller = new OptinController(
            $this->optins, $this->rules, $this->templates, $this->library, new GoalRegistry($this->pro, $site), $published,
            $tier === Tier::Free ? InstalledRules::free($this->rules) : InstalledRules::withPro($this->rules), new RuleCatalogue($this->rules, $this->pro, $site, new RoleRegistry()),
            new SiteFrequency(new FakeOptionStore()), new MilestoneStore($milestones), $destinations, $destinationTypes,
            $this->occasions = new OccasionStore(),
        );
        $this->builder = new CampaignBuilder($this->library, $this->templates, $this->pro);
        $this->occasionController = new OccasionController($this->optins, $this->occasions, $this->library, $this->templates, $this->builder);
        $this->reader = new CampaignReader($this->occasions, $this->library, $this->templates);
        $this->readiness = new PublishReadiness($this->optins, $this->rules, $destinations, $destinationTypes);

        $GLOBALS['wconvertTestRestServer'] = function (WP_REST_Request $request) {
            $method = $request->get_method();
            $route = substr($request->get_route(), strlen('/wconvert/v1'));
            $this->dispatched[] = $method . ' ' . $route;
            if (preg_match('#^/optins/([0-9A-Z]{26})(/publish|/unpublish)?$#', $route, $m)) {
                $request->set_param('id', $m[1]);
                return match ([$method, $m[2] ?? '']) {
                    ['GET', ''] => $this->controller->show($request),
                    ['PATCH', ''], ['PUT', ''] => $this->controller->update($request),
                    ['POST', '/publish'] => $this->controller->publish($request),
                    ['POST', '/unpublish'] => $this->controller->unpublish($request),
                    default => throw new \LogicException('No route for ' . $method . ' ' . $route),
                };
            }
            if (preg_match('#^/occasions/([a-z0-9-]+)/(copy|export)$#', $route, $m)) {
                $request->set_param('id', $m[1]);
                return $m[2] === 'copy' ? $this->occasionController->copy($request) : $this->occasionController->export($request);
            }
            return match ($method . ' ' . $route) {
                'GET /optins' => $this->controller->index($request),
                'POST /optins' => $this->controller->store($request),
                default => throw new \LogicException('No route for ' . $method . ' ' . $route),
            };
        };
    }

    public function close(): void
    {
        unset($GLOBALS['wconvertTestRestServer'], $GLOBALS['wpdb']);
        $GLOBALS['wconvertTestOptionTable'] = [];
    }

    /** @param list<array<string, string>> $items */
    public function occasions(array $items): void
    {
        $this->occasions->write(static fn (): array => $items);
    }

    /**
     * @param array<string, mixed> $config
     */
    public function draft(string $name, string $goal, array $config): string
    {
        $request = new WP_REST_Request('POST', '/wconvert/v1/optins');
        $request->set_param('name', $name);
        $request->set_param('goal', $goal);
        $request->set_param('config', $config);
        $response = $this->controller->store($request);
        if ($response instanceof \WP_Error) throw new \LogicException($response->get_error_message());
        return (string) $response->get_data()['id'];
    }
}

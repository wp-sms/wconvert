<?php

namespace WConvert\Container;

use WConvert\Agent\Abilities;
use WConvert\Agent\AgentCampaignInput;
use WConvert\Agent\CampaignReader;
use WConvert\Agent\AgentPublishing;
use WConvert\Agent\Draft;
use WConvert\Agent\Publish;
use WConvert\Agent\Read;
use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationStore;
use WConvert\Discovery\OccasionStore;
use WConvert\Discovery\SetupIndex;
use WConvert\Goal\GoalRegistry;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishReadiness;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Playbook\Prefill;
use WConvert\Rules\RuleVocabulary;
use WConvert\Stats\Dashboard;
use WConvert\Support\ProPresence;
use WConvert\Template\CampaignBuilder;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

defined('ABSPATH') || exit;

/**
 * The [[Agent ability]] set (ADR 0154): what an AI agent may read, draft and —
 * with a site administrator's say-so — publish or pause.
 *
 * Booted on every request, admin or not, because an agent arrives over REST
 * from no screen at all. Booting adds hooks only; the abilities are built when
 * WordPress first reads its ability registry.
 */
final class AgentServiceProvider implements ServiceProvider
{
    /**
     * Every ability, as the container builds it.
     *
     * @var list<class-string<\WConvert\Agent\Ability>>
     */
    public const ABILITIES = [
        Read\FindCampaigns::class,
        Read\GetCampaign::class,
        Read\ListOccasions::class,
        Read\GetOccasion::class,
        Read\FindDesigns::class,
        Read\ListStarters::class,
        Read\ReviewCampaign::class,
        Read\GetStats::class,
        Draft\CreateCampaign::class,
        Draft\UpdateCampaign::class,
        Draft\SaveOccasion::class,
        Draft\CopyOccasion::class,
        Publish\Publish::class,
        Publish\Pause::class,
    ];

    public function register(ServiceContainer $container): void
    {
        $container->register(PublishReadiness::class, static fn (ServiceContainer $c): PublishReadiness => new PublishReadiness(
            $c->resolve(OptinRepository::class), $c->resolve(RuleVocabulary::class), $c->resolve(DestinationStore::class), $c->resolve(DestinationRegistry::class)
        ));
        $container->register(CampaignReader::class, static fn (ServiceContainer $c): CampaignReader => new CampaignReader(
            $c->resolve(OccasionStore::class), $c->resolve(TemplateLibrary::class), $c->resolve(TemplateVocabulary::class)
        ));

        $container->register(Read\FindCampaigns::class, static fn (ServiceContainer $c) => new Read\FindCampaigns($c->resolve(CampaignReader::class)));
        $container->register(Read\GetCampaign::class, static fn (ServiceContainer $c) => new Read\GetCampaign($c->resolve(CampaignReader::class)));
        $container->register(Read\ListOccasions::class, static fn (ServiceContainer $c) => new Read\ListOccasions($c->resolve(OccasionStore::class), $c->resolve(CampaignReader::class)));
        $container->register(Read\GetOccasion::class, static fn (ServiceContainer $c) => new Read\GetOccasion($c->resolve(OccasionStore::class), $c->resolve(CampaignReader::class)));
        $container->register(Read\FindDesigns::class, static fn (ServiceContainer $c) => new Read\FindDesigns(
            $c->resolve(TemplateLibrary::class), $c->resolve(TemplateVocabulary::class), $c->resolve(CampaignBuilder::class), $c->resolve(ProPresence::class)
        ));
        $container->register(Read\ListStarters::class, static fn (ServiceContainer $c) => new Read\ListStarters(
            $c->resolve(PlaybookLibrary::class), $c->resolve(SetupIndex::class), $c->resolve(TemplateLibrary::class), $c->resolve(GoalRegistry::class)
        ));
        $container->register(Read\ReviewCampaign::class, static fn (ServiceContainer $c) => new Read\ReviewCampaign(
            $c->resolve(OptinRepository::class), $c->resolve(PublishReadiness::class), $c->resolve(CampaignReader::class)
        ));
        $container->register(Read\GetStats::class, static fn (ServiceContainer $c) => new Read\GetStats(
            $c->resolve(Dashboard::class), $c->resolve(OccasionStore::class), $c->resolve(CampaignReader::class)
        ));

        $container->register(AgentCampaignInput::class, static fn (ServiceContainer $c): AgentCampaignInput => new AgentCampaignInput(
            $c->resolve(TemplateLibrary::class), $c->resolve(TemplateVocabulary::class), $c->resolve(CampaignBuilder::class), $c->resolve(OccasionStore::class),
            $c->resolve(PlaybookLibrary::class), $c->resolve(Prefill::class), $c->resolve(SetupIndex::class)
        ));
        $container->register(Draft\CreateCampaign::class, static fn (ServiceContainer $c) => new Draft\CreateCampaign($c->resolve(AgentCampaignInput::class), $c->resolve(CampaignReader::class)));
        $container->register(Draft\UpdateCampaign::class, static fn (ServiceContainer $c) => new Draft\UpdateCampaign($c->resolve(AgentCampaignInput::class), $c->resolve(CampaignReader::class)));
        $container->register(Draft\SaveOccasion::class, static fn (ServiceContainer $c) => new Draft\SaveOccasion($c->resolve(OccasionStore::class), $c->resolve(CampaignReader::class)));
        $container->register(Draft\CopyOccasion::class, static fn () => new Draft\CopyOccasion());

        $container->register(Publish\Publish::class, static fn (ServiceContainer $c) => new Publish\Publish($c->resolve(AgentPublishing::class), $c->resolve(OccasionStore::class), $c->resolve(CampaignReader::class)));
        $container->register(Publish\Pause::class, static fn (ServiceContainer $c) => new Publish\Pause($c->resolve(AgentPublishing::class), $c->resolve(OccasionStore::class), $c->resolve(CampaignReader::class)));
    }

    public function boot(ServiceContainer $container): void
    {
        Abilities::hooks(static fn (): array => array_map(
            static fn (string $ability): \WConvert\Agent\Ability => $container->resolve($ability),
            self::ABILITIES
        ));
    }
}

<?php
/**
 * Disposable review site only; never packaged. Free designs and setups the
 * catalogue alone serves (ADR 0157) are offered here as if a merchant had
 * installed them, so their journeys can be walked before any release exists.
 * Composed like Pro's own libraries, with the hosted folders last.
 */
declare(strict_types=1);
// Free registers its libraries at plugins_loaded:10 and Pro at 20, so composing
// at 30 comes after both, with or without Pro.
add_action('plugins_loaded', static function (): void {
    if (!defined('WCONVERT_DIR')) return;
    $hosted = WCONVERT_DIR . 'tools/design-library/hosted';
    if (!is_dir($hosted . '/templates')) return;
    $container = \WConvert\Bootstrap::container();
    $designs = new class ($hosted . '/templates') implements \WConvert\Template\TemplateSource {
        public function __construct(private readonly string $directory) {}
        public function entries(): array
        {
            return array_map(static fn (string $file): mixed => json_decode((string) file_get_contents($file), true), glob($this->directory . '/*.json') ?: []);
        }
    };
    $container->register(\WConvert\Template\TemplateLibrary::class, static function ($c) use ($designs): \WConvert\Template\TemplateLibrary {
        $vocabulary = $c->resolve(\WConvert\Template\TemplateVocabulary::class);
        return \WConvert\Template\TemplateLibrary::deferred($vocabulary, static fn (): \WConvert\Template\TemplateLibrary => \WConvert\Template\TemplateLibrary::from(
            $vocabulary,
            new \WConvert\Template\BundledTemplates(WCONVERT_DIR),
            ...(defined('WCONVERT_PRO_DIR') ? [new \WConvert\Pro\Template\ProTemplates(WCONVERT_PRO_DIR)] : []),
            ...[$c->resolve(\WConvert\Template\Catalog\DesignArchive::class), $designs],
        ));
    });
    $container->register(\WConvert\Playbook\PlaybookLibrary::class, static fn ($c): \WConvert\Playbook\PlaybookLibrary => \WConvert\Playbook\PlaybookLibrary::deferred(
        static fn (): \WConvert\Playbook\PlaybookLibrary => \WConvert\Playbook\PlaybookLibrary::fromDirectory(
            $c->resolve(\WConvert\Template\TemplateLibrary::class),
            $c->resolve(\WConvert\Template\TemplateVocabulary::class),
            $c->resolve(\WConvert\Rules\RuleVocabulary::class),
            WCONVERT_DIR,
            array_merge(
                defined('WCONVERT_PRO_DIR') ? (new \WConvert\Pro\Template\ProPlaybooks(WCONVERT_PRO_DIR))->entries() : [],
                $c->resolve(\WConvert\Template\Catalog\DesignArchive::class)->playbooks(),
                array_map(static fn (string $file): mixed => require $file, glob($hosted . '/playbooks/*.php') ?: [])
            )
        )
    ));
}, 30);

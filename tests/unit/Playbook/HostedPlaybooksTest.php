<?php

namespace WConvert\Tests\Unit\Playbook;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\Rejection;
use WConvert\Template\BundledTemplates;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateSource;
use WConvert\Template\TemplateVocabulary;

/**
 * Setups the catalogue alone serves (ADR 0157).
 *
 * A hosted Playbook ships in neither ZIP, so no install ever registers it the
 * way `BundledPlaybooksTest` registers a bundled one. This is that
 * registration: the same `PlaybookLibrary` refusals, against the designs a
 * Free site can hold, bundled and hosted.
 */
#[CoversClass(PlaybookLibrary::class)]
final class HostedPlaybooksTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';
    private const HOSTED = self::PLUGIN_DIR . '/tools/design-library/hosted';

    public function testEveryHostedPlaybookRegistersAgainstTheDesignsAFreeSiteCanHold(): void
    {
        $vocabulary = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
        $hostedDesigns = new class (self::HOSTED . '/templates') implements TemplateSource {
            public function __construct(private readonly string $directory)
            {
            }

            public function entries(): array
            {
                return array_map(
                    static fn (string $file): mixed => json_decode((string) file_get_contents($file), true),
                    glob($this->directory . '/*.json') ?: []
                );
            }
        };
        $playbooks = array_map(static fn (string $file): mixed => require $file, glob(self::HOSTED . '/playbooks/*.php') ?: []);

        $this->assertNotSame([], $playbooks, 'no hosted Playbook exists, so this test asserts nothing');

        $library = PlaybookLibrary::fromDirectory(
            TemplateLibrary::from($vocabulary, new BundledTemplates(self::PLUGIN_DIR), $hostedDesigns),
            $vocabulary,
            RuleVocabulary::fromManifest(self::PLUGIN_DIR),
            self::PLUGIN_DIR,
            $playbooks
        );

        $this->assertSame([], array_map(static fn (Rejection $rejection): array => $rejection->toArray(), $library->rejections()));
        foreach ($playbooks as $playbook) {
            $this->assertNotNull($library->find($playbook['id']), $playbook['id'] . ' did not register');
        }
    }
}

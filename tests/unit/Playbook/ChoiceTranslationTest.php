<?php

namespace WConvert\Tests\Unit\Playbook;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

#[CoversNothing]
final class ChoiceTranslationTest extends TestCase
{
    public function testEverydayChoiceLabelsTranslateWithoutChangingSubmittedValues(): void
    {
        $directory = realpath(__DIR__ . '/../../../pro/modules/display-types/playbooks');
        $this->assertNotFalse($directory);
        // Isolate the translating WordPress function from the identity stub in bootstrap.php.
        $script = <<<'PHP'
define('ABSPATH', '/');
function __(string $text, string $domain): string { return 'Translated: ' . $text; }
$result = [];
foreach (['everyday-start-a-conversation', 'everyday-another-good-round'] as $id) {
    $playbook = require $argv[1] . '/' . $id . '.php';
    $result[$id] = $playbook['copy']['interest_options']['options'];
}
echo json_encode($result, JSON_THROW_ON_ERROR);
PHP;
        exec(escapeshellarg(PHP_BINARY) . ' -r ' . escapeshellarg($script) . ' ' . escapeshellarg($directory), $output, $status);
        $this->assertSame(0, $status);
        $choices = json_decode(implode("\n", $output), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame(['website', 'identity', 'exploring'], array_column($choices['everyday-start-a-conversation'], 'value'));
        $this->assertSame(['strap', 'zip', 'other'], array_column($choices['everyday-another-good-round'], 'value'));
        foreach ($choices as $options) {
            foreach ($options as $option) {
                $this->assertStringStartsWith('Translated: ', $option['label']);
            }
        }
    }
}

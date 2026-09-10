<?php

namespace WConvert\Tests\Unit\Support;

/** A small real design for tests whose subject is publishing, rules or placement. */
final class OptinDesign
{
    /** @return array<string, mixed> */
    public static function template(): array
    {
        return [
            'tree' => ['steps' => [[
                'type' => 'stack',
                'children' => [[
                    'type' => 'button',
                    'action' => 'link',
                    'text' => 'View offer',
                    'href' => 'https://example.org/offer',
                ]],
            ]]],
            'tokens' => [],
        ];
    }
}

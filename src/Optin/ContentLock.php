<?php
namespace WConvert\Optin;

use WConvert\Template\ConvertingAct;
use WConvert\Template\TemplateForm;

defined('ABSPATH') || exit;

/** Stored vocabulary and publication contract. Execution belongs to Pro. */
final class ContentLock
{
    /** @return array{mode: string}|null */
    public static function normalize(mixed $value): ?array
    {
        return is_array($value) && ($value['mode'] ?? null) === 'hide' ? ['mode' => 'hide'] : null;
    }

    /**
     * @param array<string, mixed> $config
     * @param list<array<string, mixed>> $triggers
     */
    public static function compatible(array $config, array $triggers): bool
    {
        return ($config['display_type'] ?? null) === 'inline'
            && ($config['inline_placement'] ?? null) === null
            && count($triggers) === 1 && ($triggers[0]['type'] ?? null) === 'page_load'
            && ConvertingAct::offeredIn($config['template']['tree'] ?? null) === [ConvertingAct::Submit]
            && count($config['template']['tree']['steps'] ?? []) === 2
            && TemplateForm::issue($config['template'] ?? null) === null;
    }
}

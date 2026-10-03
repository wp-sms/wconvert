<?php
namespace WConvert\Pro\Module\Analytics;

use WConvert\Storage\OptionStore;

defined('ABSPATH') || exit;

final class Settings
{
    public const OPTION = 'wconvert_analytics';
    public function __construct(private readonly OptionStore $options) {}

    /** @return array<string, mixed> */
    public function read(): array
    {
        $saved = $this->options->get(self::OPTION, []);
        return array_replace(['enabled' => false, 'route' => 'gtag', 'measurement_id' => '',
            'consent' => 'wp', 'dismissals' => false, 'exclude_managers' => true,
            'data_layer' => 'dataLayer', 'home' => '', 'version' => 1], is_array($saved) ? $saved : []);
    }

    /** @param array<string, mixed> $input */
    public function save(array $input, string $home): void
    {
        $allowed = ['enabled', 'route', 'measurement_id', 'consent', 'dismissals', 'exclude_managers', 'data_layer'];
        if (array_diff(array_keys($input), $allowed) !== []) throw new \InvalidArgumentException(__('Unknown analytics setting.', 'wconvert'));
        $value = array_replace(array_intersect_key($this->read(), array_flip($allowed)), $input);
        foreach (['enabled', 'dismissals', 'exclude_managers'] as $key) {
            if (!is_bool($value[$key])) throw new \InvalidArgumentException(__('Invalid analytics setting.', 'wconvert'));
        }
        if (!in_array($value['route'], ['gtag', 'gtm'], true) || !in_array($value['consent'], ['wp', 'site'], true)) {
            throw new \InvalidArgumentException(__('Choose a supported route and consent policy.', 'wconvert'));
        }
        $id = $value['measurement_id'];
        if (!is_string($id) || ($id !== '' && !preg_match('/^G-[A-Z0-9]{4,20}$/D', $id))
            || ($value['enabled'] && $value['route'] === 'gtag' && $id === '')) {
            throw new \InvalidArgumentException(__('Enter the existing web stream Measurement ID, starting with G-.', 'wconvert'));
        }
        $layer = $value['data_layer'];
        if (!is_string($layer) || !preg_match('/^[A-Za-z_$][A-Za-z0-9_$]{0,39}$/D', $layer)
            || in_array($layer, ['__proto__', 'prototype', 'constructor', 'window', 'document', 'location'], true)) {
            throw new \InvalidArgumentException(__('Enter a valid data-layer name.', 'wconvert'));
        }
        $this->options->set(self::OPTION, $value + ['home' => rtrim($home, '/'), 'version' => 1]);
    }

    public function active(string $home, string $environment, bool $manager): bool
    {
        $value = $this->read();
        return $value['enabled'] === true && $value['home'] === rtrim($home, '/') && $environment === 'production'
            && !($value['exclude_managers'] && $manager);
    }
}

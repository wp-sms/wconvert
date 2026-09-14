<?php

namespace WConvert\Stats;

use WConvert\Storage\OptionStore;

defined('ABSPATH') || exit;

/**
 * Authored monthly benchmarks, not another counter or campaign control.
 * One non-autoloaded option holds month => metric => target. Completed months
 * are never rewritten by this interface; copying last month is an explicit edit.
 * Progress comes from the same historical interpretation as Analytics (ADR 0090).
 */
final class MonthlyTargets
{
    public const OPTION = 'wconvert_monthly_targets';
    public const MAX_TARGET = 100000000;
    private const METRICS = ['leads', 'offers', 'carts'];

    public function __construct(private readonly OptionStore $options, private readonly Dashboard $dashboard)
    {
    }

    /** @return array<string, mixed> */
    public function read(string $today): array
    {
        $month = substr($today, 0, 7);
        $start = new \DateTimeImmutable($month . '-01', new \DateTimeZone('UTC'));
        $previous = $start->modify('-1 month')->format('Y-m');
        $all = $this->all();
        $saved = $all[$month] ?? [];
        $prior = $all[$previous] ?? [];
        $range = StatRange::calendarMonth($month, $today);
        $report = $this->dashboard->read($range);
        $metrics = [];
        foreach ($report['impact'] as $impact) {
            $id = $impact['id'];
            if (!in_array($id, self::METRICS, true)) continue;
            $metrics[] = [
                'id' => $id, 'label' => $impact['label'], 'actual' => $impact['count'],
                'target' => $saved[$id] ?? null,
                'available' => $id === 'leads' || $impact['goals'] !== [] || isset($saved[$id]) || isset($prior[$id]),
                'unit' => $id === 'leads' ? __('submissions', 'wconvert') : __('clicks', 'wconvert'),
                'note' => $id === 'leads'
                    ? __('Form submissions across all capture campaigns, including repeats. Not unique people or confirmed subscribers.', 'wconvert')
                    : ($id === 'offers'
                        ? __('Clicks to offers or content. Not purchases or revenue.', 'wconvert')
                        : __('Clicks back to a shopping basket. Not completed orders or recovered revenue.', 'wconvert')),
            ];
        }
        return [
            'month' => $month, 'from' => $range->from, 'end' => $start->format('Y-m-t'),
            'through' => $range->days() === 0 ? null : $range->to,
            'metrics' => $metrics, 'previous_month' => $previous,
            'previous_targets' => (object) $prior, 'max_target' => self::MAX_TARGET,
        ];
    }

    /** Replace this month's authored targets; no counter can be written here.
     * @param array<string, mixed> $targets
     */
    public function save(string $month, array $targets, string $today): void
    {
        if ($month !== substr($today, 0, 7)) {
            throw new \DomainException('The month changed. Refresh and review the new month before saving.');
        }
        foreach ($targets as $id => $value) {
            if (!in_array($id, self::METRICS, true) || !is_int($value) || $value < 1 || $value > self::MAX_TARGET) {
                throw new \InvalidArgumentException('Targets must be whole positive counts for a supported metric.');
            }
        }
        $all = $this->all();
        $all[$month] = $targets;
        $this->options->set(self::OPTION, $all);
        if ($this->all() !== $all) throw new \RuntimeException('The targets could not be saved. Try again.');
    }

    /** Tolerant reads never repair or rewrite a hand-edited setting.
     * @return array<string, array<string, int>>
     */
    private function all(): array
    {
        $stored = $this->options->get(self::OPTION, []);
        $valid = [];
        foreach (is_array($stored) ? $stored : [] as $month => $values) {
            if (!is_string($month) || !preg_match('/^[1-9][0-9]{3}-(0[1-9]|1[0-2])$/D', $month) || !is_array($values)) continue;
            $valid[$month] = [];
            foreach ($values as $id => $value) {
                if (in_array($id, self::METRICS, true) && is_int($value) && $value > 0 && $value <= self::MAX_TARGET) $valid[$month][$id] = $value;
            }
        }
        return $valid;
    }
}

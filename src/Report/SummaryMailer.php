<?php

namespace WConvert\Report;

defined('ABSPATH') || exit;

/**
 * Sends one summary email. An interface so the job is tested without mail.
 */
interface SummaryMailer
{
    /**
     * @param list<string> $to
     */
    public function send(array $to, string $subject, string $html, string $text): bool;
}

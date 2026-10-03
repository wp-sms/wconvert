<?php

namespace WConvert\Tests\Unit\Container;

use PHPUnit\Framework\TestCase;
use WConvert\Bootstrap;
use WConvert\Destination\SubmissionDispatcher;
use WConvert\Rest\TemplateTransferController;
use WConvert\Retention\LeadPruner;

/**
 * Switching the plugin off leaves no WP-Cron event firing into a hook nobody
 * listens on — and touches no data, which is uninstall's job (ADR 0018).
 */
final class DeactivationTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wconvertTestSchedule'] = [];
    }

    public function testEveryCronEventIsCleared(): void
    {
        foreach ([LeadPruner::HOOK, SubmissionDispatcher::RECOVER, TemplateTransferController::CLEANUP] as $hook) {
            $GLOBALS['wconvertTestSchedule'][$hook] = time() + 60;
        }

        Bootstrap::deactivate();

        $this->assertSame([], $GLOBALS['wconvertTestSchedule']);
    }
}

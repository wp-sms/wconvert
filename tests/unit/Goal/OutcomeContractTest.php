<?php

namespace WConvert\Tests\Unit\Goal;

use PHPUnit\Framework\TestCase;
use WConvert\Goal\Goal;

final class OutcomeContractTest extends TestCase
{
    public function testAnSmsGoalNeedsARequiredPhoneOnTheSubmittingScreen(): void
    {
        $contract = Goal::GrowSmsList->outcome();
        $form = static fn (array $fields): array => ['template' => ['tree' => ['steps' => [
            ['type' => 'stack', 'children' => [...$fields, ['type' => 'button', 'action' => 'submit']]],
            ['type' => 'stack', 'children' => []],
        ]]]];

        self::assertNotNull($contract->designIssue($form([['type' => 'field', 'name' => 'email', 'required' => true]])));
        self::assertNotNull($contract->designIssue($form([['type' => 'field', 'name' => 'phone', 'required' => false]])));
        self::assertNull($contract->designIssue($form([['type' => 'field', 'name' => 'phone', 'required' => true]])));
        self::assertNotNull($contract->designIssue($form([['type' => 'stack', 'hidden' => true, 'children' => [
            ['type' => 'field', 'name' => 'phone', 'required' => true],
        ]]])));
    }
}

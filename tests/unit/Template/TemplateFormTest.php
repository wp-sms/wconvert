<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\TestCase;
use WConvert\Template\TemplateForm;
use WConvert\Template\TemplateVocabulary;

final class TemplateFormTest extends TestCase
{
    /** @param list<array<string, mixed>> $fields
     * @return array<string, mixed>
     */
    private function form(array $fields): array
    {
        return TemplateVocabulary::fromManifest(dirname(__DIR__, 3))->normalize([
            'tree' => ['steps' => [['type' => 'stack', 'children' => [
                ...$fields, ['type' => 'button', 'action' => 'submit', 'text' => 'Send'],
            ]]]],
        ]);
    }

    public function testAFormNeedsAContactIdentifier(): void
    {
        self::assertSame('identifier', TemplateForm::issue($this->form([['type' => 'field', 'name' => 'name']])));
        foreach (['email', 'phone'] as $name) {
            self::assertNull(TemplateForm::issue($this->form([['type' => 'field', 'name' => $name, 'required' => false]])));
        }
    }

    public function testEvenAnOptionalChoiceNeedsAnAnswerBeforePublication(): void
    {
        $fields = [
            ['type' => 'field', 'name' => 'email'],
            ['type' => 'field', 'name' => 'interest', 'required' => false, 'options' => []],
        ];
        self::assertSame('choices', TemplateForm::issue($this->form($fields)));
        $fields[1]['options'] = [['value' => 'repair', 'label' => 'Repair']];
        self::assertNull(TemplateForm::issue($this->form($fields)));
    }

    public function testAnIdentifierOnTheSuccessScreenDoesNotRepairTheForm(): void
    {
        $template = $this->form([]);
        $template['tree']['steps'][] = ['type' => 'stack', 'children' => [['type' => 'field', 'name' => 'email']]];
        self::assertSame('identifier', TemplateForm::issue($template));
    }

    public function testClickMeteredDesignsNeedNoCaptureFields(): void
    {
        self::assertNull(TemplateForm::issue(['tree' => ['steps' => [[
            'type' => 'panel', 'children' => [['type' => 'button', 'action' => 'link', 'href' => '/offer']],
        ]]]]));
    }
}

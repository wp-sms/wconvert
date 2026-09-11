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
    public function testResourceLinksNeedWordsAndADestinationAfterTheForm(): void
    {
        $template = $this->form([['type' => 'field', 'name' => 'email']]);
        $link = ['type' => 'followup', 'label' => 'Open guide', 'href' => '/guide.pdf'];
        $template['tree']['steps'][] = ['type' => 'stack', 'children' => [$link]];
        self::assertNull(TemplateForm::issue($template));
        self::assertCount(1, \WConvert\Template\ConvertingAct::offeredIn($template['tree']));
        foreach (['', '   ', 'javascript:alert(1)'] as $href) {
            $template['tree']['steps'][1]['children'][0]['href'] = $href;
            $normalized = TemplateVocabulary::fromManifest(dirname(__DIR__, 3))->normalize($template);
            self::assertSame('followup', TemplateForm::issue($normalized));
        }
        $template['tree']['steps'][1]['children'][0] = $link;
        $template['tree']['steps'][1]['children'][0]['label'] = '';
        self::assertSame('followup', TemplateForm::issue($template));
        $template['tree']['steps'][1]['children'][0]['hidden'] = true;
        self::assertNull(TemplateForm::issue($template));
        $template['tree']['steps'][0]['children'][] = $link;
        self::assertSame('followup', TemplateForm::issue($template));
    }

}

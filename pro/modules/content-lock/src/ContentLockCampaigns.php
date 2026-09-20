<?php
namespace WConvert\Pro\Module\ContentLock;

use WConvert\Frontend\InlineOptinBlock;
use WConvert\Optin\DisplayType;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedOptin;
use WConvert\Optin\PublishedSet;
use WConvert\Rest\Routes;
use WConvert\Rules\Degradation;

defined('ABSPATH') || exit;

/** A narrow, refreshable editor list. Never exposes drafts, designs or Leads. */
final class ContentLockCampaigns
{
    public function __construct(
        private readonly PublishedSet $published,
        private readonly OptinRepository $optins,
        private readonly Degradation $degradation,
    ) {}

    public function hooks(): void
    {
        add_action('enqueue_block_editor_assets', function (): void {
            if (!Routes::canPlaceCampaign()) return;
            wp_add_inline_script(InlineOptinBlock::HANDLE, 'window.wconvertContentLockEditor = ' . wp_json_encode($this->data()) . ';', 'before');
        });
        add_action('rest_api_init', function (): void {
            register_rest_route(Routes::NAMESPACE, '/content-lock-campaigns', [
                'methods' => 'GET',
                'permission_callback' => [Routes::class, 'canPlaceCampaign'],
                'callback' => fn (): \WP_REST_Response => new \WP_REST_Response($this->data(), 200, ['Cache-Control' => 'no-store']),
            ]);
        });
    }

    /** @return list<array{id: string, name: string, status: string}> */
    public function campaigns(): array
    {
        $names = $this->optins->names();
        $result = [];
        foreach (PublishedOptin::fromSet($this->published->all()) as $optin) {
            if ($optin->displayType() !== DisplayType::Inline) continue;
            $payload = $optin->toPayloadEntry();
            // Publication already validates compatibility and clears locking
            // for a mixed A/B family. Read that same snapshot, not a draft.
            $status = ($payload['content_lock']['mode'] ?? null) === 'hide'
                ? ($this->degradation->suspendedIn($payload) === null ? 'ready' : 'unavailable')
                : 'disabled';
            $result[] = ['id' => $optin->id, 'name' => ($names[$optin->id] ?? '') ?: $optin->id, 'status' => $status];
        }
        usort($result, static fn (array $a, array $b): int => strcmp($b['id'], $a['id']));
        return $result;
    }

    /** @return array{campaigns: list<array{id: string, name: string, status: string}>, manageUrl: ?string} */
    public function data(): array
    {
        return ['campaigns' => $this->campaigns(), 'manageUrl' => Routes::canManage() ? admin_url('admin.php?page=wconvert#optins') : null];
    }
}

<?php
/** Disposable WordPress fixtures; never mount this directory into a saved site. */
add_action('init', static function (): void {
    if (!isset($_GET['wconvert_lock'])) return;
    $kind = sanitize_key((string) $_GET['wconvert_lock']);
    $container = \WConvert\Bootstrap::container();
    $repository = $container->get(\WConvert\Optin\OptinRepository::class);
    $ids = get_option('wconvert_lock_fixtures', []);
    foreach ($ids as $id) $repository->unpublish($id);
    if (!isset($ids[$kind])) {
        $config = [
            'display_type' => 'inline', 'content_lock' => ['mode' => 'hide'],
            'rules' => [['type' => 'page_load']], 'capture_mode' => 'local',
            'frequency' => ['stopAfterConversion' => false],
            'template' => ['tokens' => ['width' => '24rem', 'accent' => '#12505a'], 'tree' => ['steps' => [
                ['type' => 'stack', 'children' => [['type' => 'heading', 'text' => 'Get the bonus'], ['type' => 'field', 'name' => 'email', 'required' => true], ['type' => 'button', 'label' => 'Unlock', 'action' => 'submit']]],
                ['type' => 'stack', 'children' => [['type' => 'heading', 'text' => 'Request received']]],
            ]]],
        ];
        if ($kind === 'off') unset($config['content_lock']);
        $ids[$kind] = $repository->create('Content lock ' . $kind, 'grow_email_list', $config)->id;
        update_option('wconvert_lock_fixtures', $ids);
    }
    if ($kind !== 'missing') $repository->publish($ids[$kind]);
    $id = $ids[$kind];
    $bonus = '<!-- wp:heading --><h2 class="wp-block-heading">Bonus checklist</h2><!-- /wp:heading --><!-- wp:paragraph --><p><a id="bonus-link" href="#end">Download your bonus</a></p><!-- /wp:paragraph -->';
    $region = $kind === 'shortcode'
        ? '[wconvert_content_lock id="' . $id . '"]' . $bonus . '[/wconvert_content_lock]'
        : '<!-- wp:wconvert/content-lock {"optinId":"' . $id . '"} -->' . $bonus . '<!-- /wp:wconvert/content-lock -->';
    $postId = (int) get_option('wconvert_lock_post', 0);
    $post = ['post_title' => 'Content lock fixture', 'post_content' => '<!-- wp:paragraph --><p>Read this public introduction.</p><!-- /wp:paragraph -->' . $region
        . ($kind === 'duplicate' ? $region : '') . '<!-- wp:paragraph --><p id="end">Public end of article.</p><!-- /wp:paragraph -->',
        'post_status' => 'publish', 'post_type' => 'post'];
    if ($postId) $post['ID'] = $postId;
    $postId = wp_insert_post($post);
    update_option('wconvert_lock_post', $postId);
    if (($_GET['theme'] ?? '') === 'classic') {
        $dir = WP_CONTENT_DIR . '/themes/wconvert-lock-classic'; wp_mkdir_p($dir);
        file_put_contents($dir . '/style.css', "/* Theme Name: Content Lock Fixture */\n");
        file_put_contents($dir . '/index.php', '<!doctype html><html <?php language_attributes(); ?>><head><meta name="viewport" content="width=device-width,initial-scale=1"><?php wp_head(); ?></head><body><main><?php while(have_posts()): the_post(); the_content(); endwhile; ?></main><?php wp_footer(); ?></body></html>');
        wp_clean_themes_cache(); switch_theme('wconvert-lock-classic');
    } else switch_theme('twentytwentyfive');
    add_filter('request', static function (array $query) use ($postId): array {
        $query['p'] = $postId; $query['post_type'] = 'post'; unset($query['name'], $query['page_id']); return $query;
    }, 99);
    add_filter('redirect_canonical', '__return_false');
    if (isset($_GET['rtl'])) add_filter('language_attributes', static fn (string $attributes): string => $attributes . ' dir="rtl"');
    add_action('wp_head', static function (): void {
        echo '<style>body{margin:0}main{max-width:720px;margin:auto;padding:16px}*{box-sizing:border-box}[hidden]{display:block!important}</style>';
    });
}, 1);

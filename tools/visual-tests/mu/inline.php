<?php
/** Disposable automatic-inline fixture only. Never mount into a saved site. */
declare(strict_types=1);

/**
 * Build a published Optin with a real snapshot, then point WordPress at a real
 * post so the Pro filter runs through the active theme's normal content path.
 */
add_action('init', static function (): void {
    $scenario = isset($_GET['wconvert_inline']) ? sanitize_key((string) $_GET['wconvert_inline']) : '';
    if ($scenario === '' || !defined('WCONVERT_PRO_DIR')) {
        return;
    }

    $theme = isset($_GET['wconvert_theme']) && $_GET['wconvert_theme'] === 'classic'
        ? 'wconvert-inline-classic'
        : 'twentytwentyfive';
    // Playground ships block themes only. Create a tiny, genuine classic
    // theme inside the disposable WordPress so the_content runs through the
    // same template contract a classic customer uses; this never touches the
    // mounted plugin or the user's saved Local site.
    if ($theme === 'wconvert-inline-classic') {
        $themeDir = WP_CONTENT_DIR . '/themes/wconvert-inline-classic';
        wp_mkdir_p($themeDir);
        if (!is_file($themeDir . '/style.css')) {
            file_put_contents($themeDir . '/style.css', "/*\nTheme Name: WConvert Inline Classic Fixture\nVersion: 1.0\n*/\n");
            file_put_contents($themeDir . '/functions.php', "<?php\nadd_action('widgets_init', static function (): void { register_sidebar(['id' => 'wconvert-test-sidebar', 'name' => 'Test sidebar', 'before_widget' => '<section class=\"widget\">', 'after_widget' => '</section>']); });\n");
            file_put_contents($themeDir . '/index.php', "<!doctype html>\n<html <?php language_attributes(); ?>><head><meta charset=\"<?php bloginfo('charset'); ?>\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><?php wp_head(); ?></head>\n<body <?php body_class(); ?>><?php wp_body_open(); ?><main><article><div class=\"entry-content\"><?php while (have_posts()) : the_post(); the_content(); endwhile; ?></div></article><aside data-inline-widget-area=\"true\" style=\"inline-size:min(280px,100%);max-inline-size:100%;margin-block-start:2000px\"><?php \$block = get_option('wconvert_inline_fixture_widget', ''); if (is_string(\$block) && \$block !== '') { try { the_widget('WP_Widget_Block', ['content' => \$block], ['before_widget' => '<section class=\"widget\">', 'after_widget' => '</section>']); } catch (Throwable \$error) { wp_die(esc_html(\$error->getMessage())); } } else { dynamic_sidebar('wconvert-test-sidebar'); } ?></aside></main><?php wp_footer(); ?></body></html>");
        }
        wp_clean_themes_cache();
    }
    $themes = wp_get_themes();
    if (isset($themes[$theme])) {
        switch_theme($theme);
    }
    if ($theme === 'wconvert-inline-classic' && !is_registered_sidebar('wconvert-test-sidebar')) {
        register_sidebar([
            'id' => 'wconvert-test-sidebar',
            'name' => 'Test sidebar',
            'before_widget' => '<section class="widget">',
            'after_widget' => '</section>',
        ]);
    }

    if (isset($_GET['rtl'])) {
        add_filter('language_attributes', static function (string $attributes): string {
            if (preg_match('/\bdir="[^"]*"/', $attributes)) {
                return preg_replace('/\bdir="[^"]*"/', 'dir="rtl"', $attributes) ?: $attributes;
            }
            return trim($attributes) . ' dir="rtl"';
        });
    }

    $container = \WConvert\Bootstrap::container();
    $repository = $container->get(\WConvert\Optin\OptinRepository::class);
    $prefill = $container->get(\WConvert\Playbook\Prefill::class)->fromPlaybook('article-end-newsletter');
    if ($prefill === null) {
        wp_die('Automatic inline fixture could not load its playbook');
    }

    // Each URL is a fresh scenario. Rebuilding the published projection here
    // keeps one browser worker deterministic without touching the saved Local
    // site.
    $oldIds = get_option('wconvert_inline_fixture_ids', []);
    if (is_array($oldIds)) {
        foreach ($oldIds as $oldId) {
            if (is_string($oldId) && $oldId !== '') {
                $repository->delete($oldId);
            }
        }
    }
    $oldPost = (int) get_option('wconvert_inline_fixture_post', 0);
    if ($oldPost > 0) {
        wp_delete_post($oldPost, true);
    }
    $oldSecondary = (int) get_option('wconvert_inline_fixture_secondary', 0);
    if ($oldSecondary > 0) {
        wp_delete_post($oldSecondary, true);
    }

    $campaigns = [];
    $make = static function (string $name, ?array $placement, array $rules = [], int $priority = 0) use ($prefill, $repository): string {
        $config = $prefill['config'];
        $config['display_type'] = 'inline';
        if ($placement === null) {
            unset($config['inline_placement']);
        } else {
            $config['inline_placement'] = $placement;
        }
        $config['rules'] = $rules !== [] ? $rules : [['type' => 'page_load']];
        if ($priority !== 0) {
            $config['priority'] = $priority;
        }
        $draft = $repository->create($name, $prefill['goal'], $config);
        $published = $repository->publish($draft->id);
        if ($published === null) {
            wp_die('Automatic inline fixture could not publish a campaign');
        }
        return $draft->id;
    };

    $manual = false;
    $widget = false;
    $recursive = false;
    $paragraphs = [
        '<p data-inline-paragraph="one">First paragraph with enough text to make the article boundary obvious.</p>',
        '<div class="inline-nested"><p data-inline-nested="true">Nested paragraph is not an insertion boundary.</p></div>',
        '<p data-inline-paragraph="two">Second top-level paragraph where a paragraph placement may land.</p>',
        '<p data-inline-paragraph="three">Third top-level paragraph keeps the after-content boundary measurable.</p>',
    ];

    switch ($scenario) {
        case 'before':
            $campaigns[] = $make('Inline before content', ['position' => 'before_content']);
            break;
        case 'after':
            $campaigns[] = $make('Inline after content', ['position' => 'after_content']);
            break;
        case 'paragraph':
            $campaigns[] = $make('Inline after paragraph', ['position' => 'after_paragraph', 'paragraph' => 2, 'fallback' => 'after_content']);
            break;
        case 'fallback-after':
            $campaigns[] = $make('Inline short fallback', ['position' => 'after_paragraph', 'paragraph' => 99, 'fallback' => 'after_content']);
            break;
        case 'fallback-skip':
            $campaigns[] = $make('Inline short skip', ['position' => 'after_paragraph', 'paragraph' => 99, 'fallback' => 'skip']);
            break;
        case 'manual':
            $campaigns[] = $make('Inline manual precedence', ['position' => 'after_content']);
            $manual = true;
            break;
        case 'widget':
            $campaigns[] = $make('Inline widget placement', null);
            $widget = true;
            break;
        case 'priority':
            $campaigns[] = $make('Inline mobile priority', ['position' => 'before_content'], [
                ['type' => 'page_load'],
                ['type' => 'device', 'in' => ['mobile']],
            ], 100);
            $campaigns[] = $make('Inline default priority', ['position' => 'after_content'], [['type' => 'page_load']], 10);
            break;
        case 'capture':
            $campaigns[] = $make('Inline capture and impression', ['position' => 'after_content']);
            $paragraphs = array_merge($paragraphs, array_fill(0, 12, '<p>Additional reading content keeps the automatic form below the first viewport.</p>'));
            break;
        case 'recursive':
            $campaigns[] = $make('Inline recursive content guard', ['position' => 'after_content']);
            $recursive = true;
            break;
        default:
            wp_die('Unknown automatic inline fixture scenario');
    }

    $manualAnchor = $manual ? '<div data-wconvert-optin="' . esc_attr($campaigns[0]) . '"></div>' : '';
    $content = implode('', $paragraphs) . $manualAnchor . ($recursive ? '[wconvert_inline_recursive]' : '');
    $postId = wp_insert_post([
        'post_title' => 'Automatic inline fixture',
        'post_name' => 'wconvert-automatic-inline-fixture',
        'post_content' => $content,
        'post_status' => 'publish',
        'post_type' => 'post',
    ], true);
    if (is_wp_error($postId)) {
        wp_die('Automatic inline fixture could not create its post');
    }

    // Render Core's own block widget with this request's Campaign. Using the
    // instance directly avoids stale widget-option instances across scenarios
    // while exercising the same WP_Widget_Block render path.
    update_option(
        'wconvert_inline_fixture_widget',
        $widget ? '<!-- wp:wconvert/inline-optin {"optinId":"' . esc_attr($campaigns[0]) . '"} /-->' : '',
        false
    );

    if ($recursive) {
        $secondary = wp_insert_post([
            'post_title' => 'Automatic inline secondary fixture',
            'post_content' => '<p data-inline-secondary="true">Secondary query content.</p>',
            'post_status' => 'publish',
            'post_type' => 'post',
        ], true);
        if (is_wp_error($secondary)) {
            wp_die('Automatic inline fixture could not create its secondary post');
        }
        update_option('wconvert_inline_fixture_secondary', (int) $secondary, false);
        add_shortcode('wconvert_inline_recursive', static function (): string {
            $secondaryQuery = new \WP_Query([
                'post_type' => 'post',
                'post_status' => 'publish',
                'post__not_in' => [(int) get_queried_object_id()],
                'posts_per_page' => 1,
            ]);
            $output = '';
            while ($secondaryQuery->have_posts()) {
                $secondaryQuery->the_post();
                $output .= apply_filters('the_content', get_the_content());
            }
            wp_reset_postdata();
            return $output;
        });
    }

    update_option('wconvert_inline_fixture_ids', $campaigns, false);
    update_option('wconvert_inline_fixture_post', (int) $postId, false);
    // This filter runs before WP parses the main query, preserving the real
    // singular loop that classic themes pass through the_content.
    add_filter('request', static function (array $query) use ($postId): array {
        $query['p'] = (int) $postId;
        $query['post_type'] = 'post';
        unset($query['name'], $query['attachment'], $query['page_id']);
        return $query;
    }, 99);
}, 1);

// Make the fixture's server-side scenario inspectable without exposing any
// campaign-specific assumptions in the browser tests.
add_action('wp_head', static function (): void {
    if (!isset($_GET['wconvert_inline'])) {
        return;
    }
    echo '<meta name="wconvert-inline-fixture" content="' . esc_attr((string) $_GET['wconvert_inline']) . '">';
    echo '<meta name="wconvert-inline-theme" content="' . (wp_is_block_theme() ? 'block' : 'classic') . '">';
}, 1);

<?php
/** Matching fixtures for decision-support campaigns; disposable demo only. */
function wconvert_demo_decision_fixtures(): array {
    $pages = [];
    $topics = [
        'material-comparison' => ['Compare ceramic and wood', ['Glazed ceramic' => 'A smooth, wipe-clean finish for indoor use. The sample planter measures 20 cm across and includes a drainage hole and saucer. Protect it from frost.', 'Natural wood' => 'A warm, textured finish. The sample tray measures 20 × 14 cm. Wipe dry; avoid soaking or leaving it in direct sunlight.']],
        'local-pickup-details' => ['Sample collection instructions', ['Wait for confirmation' => 'Collection is arranged only after an order and a ready-to-collect message. This demo cannot take orders or reserve products.', 'Example collection point' => 'Fictional studio: 12 Sample Lane, Exampletown. Collection hours: Tuesday–Friday, 10am–4pm. Bring your order reference.']],
        'return-policy-guide' => ['Sample returns information', ['Before ordering' => 'This fictional shop allows unused standard products to be returned within 30 days of receipt. Contact the shop first for return instructions. The customer pays return postage for a change of mind.', 'Damaged items and exceptions' => 'Contact the shop with the order reference and details of the problem. Personalised products need separate terms. These are illustrative shop terms for review; this demo takes no orders.']],
        'service-area-check' => ['Our example service area', ['Local visits' => 'Our fictional service team visits Central Exampletown and North Exampletown. Other areas need a separate availability enquiry.', 'Check before arranging a visit' => 'Send your area and project details through the enquiry process. This information page does not validate a postcode or confirm an appointment.']],
        'service-options-guide' => ['Compare the service options', ['Planning conversation' => 'Discuss one room, priorities and constraints. Includes a written summary of next steps. No measured drawings, contractor estimate or booking is included.', 'Project consultation' => 'Review the agreed brief, access and measurements in more detail. Includes a scope summary for separate estimating. Fees, timing and attendance must be agreed before booking.']],
        'service-open-day' => ['Studio open day — example programme', ['Programme' => 'Fictional event: Saturday 24 October 2026, 10am–1pm. 10am: planning talk; 11am: materials demonstration; noon: general questions. No project-specific quote is issued.', 'Venue and access' => 'Example Studio, 12 Sample Lane, Exampletown. Ground-floor entrance and seating. Contact the organiser to discuss access needs. This page provides information only; no place is booked.']],
        'series-start' => ['Part one: start with a useful question', ['Write for a particular reader' => 'Choose one person and write down the question they brought to your page.', 'Make one promise' => 'Draft an opening that says what the reader will learn. Remove side topics that distract from it.', 'Try it now' => 'Write a one-sentence answer, then list three pieces of evidence that explain it. This is the first exercise in the sample writing series.']],
        'room_ideas' => ['Room planning guide', ['Map everyday use' => 'List what happens in the room and which activities need space.', 'Record the constraints' => 'Mark doors, windows, sockets and furniture dimensions on a rough plan.', 'Prepare a brief' => 'Choose your three priorities and questions for a planning conversation.']],
        'room_ready' => ['Room consultation scope', ['Prepare' => 'Bring a rough plan, approximate measurements and photographs.', 'Discuss' => 'Review movement, storage, light and priorities. The conversation establishes a brief; it is not a contractor quotation.', 'Agree the next step' => 'Confirm the scope, fee and availability separately before arranging a visit.']],
        'garden_ideas' => ['Outdoor planning guide', ['Observe' => 'Note light through the day, access and existing plants.', 'Prioritise' => 'Choose how you want to use the space: sitting, growing or storage.', 'Prepare' => 'Make a rough plan and record questions before seeking project advice.']],
        'garden_ready' => ['Outdoor project consultation', ['Scope' => 'Discuss intended use, access, light and maintenance preferences.', 'Prepare' => 'Bring photographs and approximate dimensions. Work affecting structures or services needs appropriate specialist advice.', 'Next step' => 'Agree the brief and separate estimate before any work is scheduled.']],
        'planning' => ['Project planning checklist', ['Priorities' => 'List what you want to improve and why.', 'Constraints' => 'Record space, access, preferred timing and an indicative budget.', 'Questions' => 'Prepare the questions that need answers before agreeing a scope.']],
        'consulting' => ['Initial consultation', ['What it covers' => 'A discussion of your brief, priorities and constraints.', 'What to bring' => 'Photographs, approximate measurements and questions.', 'After the discussion' => 'Agree the next step separately. No appointment or work is confirmed by this finder.']],
        'estimating' => ['Prepare for an estimate', ['Describe the scope' => 'List the work and exclusions as specifically as you can.', 'Share practical details' => 'Prepare approximate measurements, photographs and access information.', 'Review the proposal' => 'Confirm inclusions, assumptions, price and timing before accepting any work.']],
        'writing_beginner' => ['Writing essentials: three short exercises', ['1. State your point' => 'Write the answer to the reader’s question in one sentence.', '2. Give each paragraph a job' => 'Label each paragraph with the idea it develops. Remove repeated ideas.', '3. Revise the ending' => 'Explain what the reader can do or understand next.']],
        'writing_deeper' => ['Strengthen your argument', ['1. Test the structure' => 'Read the opening sentence of each paragraph as a sequence. Reorder until the reasoning is clear.', '2. Check the evidence' => 'Identify claims that need support. Verify them against original sources.', '3. Edit for precision' => 'Replace vague nouns and verbs with concrete details, then read aloud.']],
        'growing_beginner' => ['Start with one plant', ['1. Choose a suitable spot' => 'Observe available light and choose a plant suited to it.', '2. Learn when to water' => 'Check soil moisture and follow the plant’s care instructions.', '3. Keep a short care note' => 'Record watering and changes so you can notice what works.']],
        'growing_deeper' => ['Observe and adapt your plant care', ['1. Compare light through the day' => 'Note direct and indirect light at several times.', '2. Notice seasonal changes' => 'Record changes in growth and moisture as conditions change.', '3. Refine your care routine' => 'Adjust one thing at a time according to the plant’s needs.']],
        'finder-help' => ['Choose a useful next step', ['Still unsure?' => 'Read the planning guidance or prepare your questions for the business. A recommendation is a starting point, not a booking, reservation or guarantee.']],
    ];
    foreach ($topics as $key => [$title, $sections]) {
        $html = '<p>Working fictional content for practical campaign review.</p>';
        foreach ($sections as $heading => $body) $html .= '<h2>' . esc_html($heading) . '</h2><p>' . esc_html($body) . '</p>';
        $pages[$key] = wconvert_demo_page('decision-' . $key, $title, $html);
    }
    $readingLinks = '<p>Choose one of the four working reading paths.</p><ul>';
    foreach (['writing_beginner', 'writing_deeper', 'growing_beginner', 'growing_deeper'] as $path) {
        $readingLinks .= '<li><a href="' . esc_url(get_permalink($pages[$path])) . '">' . esc_html(get_the_title($pages[$path])) . '</a></li>';
    }
    $pages['reading-paths'] = wconvert_demo_page('decision-reading-paths', 'Browse the reading paths', $readingLinks . '</ul>');
    $help = '<h2>Prepare for a conversation</h2><p>Use the <a href="' . esc_url(get_permalink($pages['planning'])) . '">planning checklist</a> or read the <a href="' . esc_url(get_permalink($pages['consulting'])) . '">consultation scope</a>.</p>';
    $enquiry = get_page_by_path('demo-consultation-corner');
    if ($enquiry) $help .= '<p><a href="' . esc_url(get_permalink($enquiry)) . '">Ask about a design consultation</a>. Sending an enquiry does not book a visit.</p>';
    wp_update_post(['ID' => $pages['finder-help'], 'post_content' => $help]);
    $products = get_option('wconvert_demo_decision_products', []);
    foreach ([
        'planter' => ['Compact ceramic planter', '24', '20 × 20 × 18 cm. Drainage hole and saucer included. A short care guide is included: follow the plant’s light instructions, check soil moisture before watering, and empty excess water from the saucer.'],
        'growing-set' => ['Pair of ceramic planters', '48', 'Two planters, each 20 cm wide. Allow at least 40 cm plus clearance when placed side by side. Saucers included; plants are not included.'],
        'tray' => ['Small wooden catch-all tray', '18', '20 × 14 × 2 cm. Natural wood; wipe dry and do not soak.'],
        'home-set' => ['Wooden organising set', '42', 'Two trays, each 30 × 18 cm. Allow 60 cm width side by side. Natural wood; wipe dry.'],
    ] as $key => [$name, $price, $details]) {
        $product = isset($products[$key]) ? wc_get_product($products[$key]) : new WC_Product_Simple();
        if (!$product) throw new RuntimeException('Missing decision demo product: ' . $key);
        $product->set_name($name); $product->set_status('publish'); $product->set_regular_price($price);
        $product->set_description('<p>Fictional review product. No checkout or payments.</p><h2>Included items and dimensions</h2><p>' . esc_html($details) . '</p>');
        $products[$key] = $product->save();
    }
    update_option('wconvert_demo_decision_products', $products, false);
    return ['pages' => $pages, 'products' => $products];
}

function wconvert_demo_decision_result(string $campaign, string $result, array $fixtures): ?array {
    $products = match ($campaign) {
        'gift-finder' => ['growing_small' => 'planter', 'growing_set' => 'growing-set', 'home_small' => 'tray', 'home_set' => 'home-set'],
        'space-fit-finder' => ['compact_plant' => 'planter', 'roomy_plant' => 'growing-set', 'compact_storage' => 'tray', 'roomy_storage' => 'home-set'],
        'experience-kit-finder' => ['starter' => 'planter', 'compact' => 'growing-set', 'collection' => 'growing-set'],
        default => null,
    };
    if (isset($products[$result])) {
        $id = $fixtures['products'][$products[$result]];
        return ['href' => get_permalink($id), 'product_ids' => [$id], 'link_label' => 'See product details'];
    }
    if ($products !== null) return ['href' => get_permalink(wc_get_page_id('shop')), 'product_ids' => [], 'link_label' => 'Browse the collection'];
    if (in_array($campaign, ['service-finder', 'project-stage-finder', 'reading-path-finder'], true)) {
        return ['href' => get_permalink($fixtures['pages'][$result] ?? $fixtures['pages'][$campaign === 'reading-path-finder' ? 'reading-paths' : 'finder-help']), 'product_ids' => [], 'link_label' => 'Read the next steps'];
    }
    return null;
}

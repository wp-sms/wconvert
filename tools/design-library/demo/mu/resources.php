<?php
/** Small working example resources; source templates contain no site-local links. */
function wconvert_demo_resource(string $id): string {
    $topics = match ($id) {
        'sizing-guide' => ['Measure the garment you already like' => 'Lay it flat and record its width and length. Compare like-for-like garment measurements.', 'Check the product chart' => 'Use the chart for the exact item. A body measurement and a garment measurement describe different things.', 'Allow room to move' => 'Consider the intended fit and fabric stretch. Ask the shop if the measurements or instructions are unclear.'],
        'gift-planning-guide' => ['Start with their interests' => 'Write down what they enjoy using, making or learning.', 'Choose a useful occasion' => 'Think about when the gift will be used. Prefer a specific everyday use to a vague trend.', 'Check the practical details' => 'Confirm size, compatibility, delivery timing and the gift returns policy before ordering.'],
        'project-readiness-guide' => ['Photograph the space' => 'Take one wide photograph and a close view of the part you want to discuss.', 'Record measurements' => 'Note approximate dimensions and label them clearly. Your contractor should verify critical measurements.', 'List the questions' => 'Write your priorities, access constraints, preferred timing and questions. Agree scope and next steps after the visit.'],
        'writing-checklist' => ['1. State the point' => 'Write the main idea in one sentence.', '2. Check the opening' => 'Give the reader a reason to continue.', '3. Order the argument' => 'Make each paragraph build on the previous one.', '4. Support claims' => 'Check facts and link to the evidence.', '5. Remove repetition' => 'Keep the strongest version of each point.', '6. Read aloud' => 'Simplify awkward or confusing sentences.', '7. Give a useful ending' => 'Leave the reader with a clear implication or next action.'],
        default => ['Prepare your questions' => 'Write down the information that would help you decide your next step.'],
    };
    $html = '<p>A working sample resource for campaign review.</p>';
    foreach ($topics as $heading => $body) $html .= '<h2>' . esc_html($heading) . '</h2><p>' . esc_html($body) . '</p>';
    if ($id === 'sizing-guide') $html .= '<h2>Example relaxed-fit top: garment measurements</h2><p>Illustrative sample collection, measured flat in centimetres. Compare with a similar top you own; these are garment measurements, not body measurements.</p><table><thead><tr><th>Size</th><th>Chest width</th><th>Length</th></tr></thead><tbody><tr><td>S</td><td>50 cm</td><td>66 cm</td></tr><tr><td>M</td><td>54 cm</td><td>69 cm</td></tr><tr><td>L</td><td>58 cm</td><td>72 cm</td></tr></tbody></table>';
    return $html;
}

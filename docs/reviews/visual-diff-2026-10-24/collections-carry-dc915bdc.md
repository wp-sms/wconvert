# Collections carried over a renderer change

`npm run templates:visual-diff -- --base dc915bdc --exclude-batch black-friday-and-everyday --apply` rendered every eligible setup whose decision was current under dc915bdc, excluding batch black-friday-and-everyday with both renderers, each screen and result at 1200 and 375 px with the close control, a refused field and the countdown drawn. 270 were pixel-identical and carried; 0 are listed for review. Both renderers used the same currently bundled local font files. This verifies layout under the intended faces, not historical font delivery; the new local delivery restores those faces when remote fonts are disabled. 

A Collection's revision hashes its setups' revisions, so these went stale with no change to their items, order, words or screens. Each is carried with its previous evidence. Not a new review.

- sale-planning
- launch-a-collection
- service-enquiries
- reader-relationships
- black-friday-2026
- help-shoppers-choose
- prepare-a-visit
- useful-store-details
- explain-the-service
- halloween-2026
- black-friday-cyber-monday-2026
- christmas-new-year-2026
- everyday-extraordinary

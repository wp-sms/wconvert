# Collections carried over a renderer change

`npm run templates:visual-diff -- --base 133069b98aa4f6ea86d5008238d1e6bbc2210ab1 --apply` rendered every setup whose decision was current under 133069b98aa4f6ea86d5008238d1e6bbc2210ab1 with both renderers, each screen and result at 1200 and 375 px with the close control, a refused field and the countdown drawn. 177 were pixel-identical and carried; 3 are listed for review.

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
- black-friday-cyber-monday-2026

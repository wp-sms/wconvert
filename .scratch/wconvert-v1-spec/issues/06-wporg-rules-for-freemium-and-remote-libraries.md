# wp.org rules for freemium and remote libraries

Type: research
Status: claimed

## Question

What do the WordPress.org plugin directory guidelines permit, and do any of the
decisions already made violate them?

Two decisions carry real review risk and both are load-bearing, so finding out
late would be expensive:

1. **The freemium split.** Free plugin on wp.org with a separately distributed
   premium tier, licensing via `veronalabs/wp-premium-sdk`. What are the current
   rules on upsell prompts in the admin, "premium" feature teasers, license key
   fields, and phoning home for validation? WSMS presumably clears this bar
   already — establish how, since copying a working precedent beats reasoning
   from the guidelines.
2. **The remote Playbook library.** Playbooks are data, and the registry is
   designed for eventual remote fetch. Guideline 8 territory: executable code
   must not be loaded from remote sources. Where exactly is the line between
   fetching *data* and loading *code*, and does a JSON Playbook containing HTML
   templates and rule definitions stay on the safe side?

Also confirm: guidelines on collecting personal data (Leads), on setting cookies
before consent, and on the "Powered by" / branding link if one is planned.

Deliver: what is permitted, what is prohibited, what is merely risky, and any
decision on this map that needs revisiting. Cite the guideline numbers.

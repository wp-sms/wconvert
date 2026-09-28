# Release browser smoke

Checked 28 September 2026 in Chrome against the local WordPress plugin after the final Free/Pro admin rebuild. UI actions only; visitor submissions used **Preview & test**. No campaign was published, no shared destination was edited, and no original demo campaign was saved.

## Ready-made template: Route a service enquiry

From **Create campaign → Collect enquiries → Route a service enquiry → Use this setup**, created [QA — Release Sep28 service enquiry template](http://wconvert.local/wp-admin/admin.php?page=wconvert#optins?edit=01M3K96NYWY8TB8DZH33RHYDHJ&back=%23optins) (`01M3K96NYWY8TB8DZH33RHYDHJ`). Renamed it and changed the first question to **Which service do you need?**. **Save draft** completed. After returning to Campaigns, reopening, and reloading under the rebuilt bundle, the name and question persisted, the Repair condition used the new wording, and Save draft was disabled.

Edit showed **What do you need? → Repair details (Repair only) → Contact details → Request received**. Flow showed the same screens and condition, including **When hidden → Contact details** for non-Repair visitors. Evidence: `/tmp/wconvert-release-template-flow.png`, `/tmp/wconvert-release-template-persisted.png`.

In the visitor test, Repair visited **A little about the repair**, then Contact details. A simulated `qa-release-template@example.test` submission reached **Request received** with **Accepted in test** and Submitted answers containing Repair. Design skipped Repair details and went directly to Contact details. No real Lead or destination request was created. Evidence: `/tmp/wconvert-release-template-finish.png`.

## Existing drafts and legacy compatibility

- Reopened [QA — Persistence Sep28 home and business](http://wconvert.local/wp-admin/admin.php?page=wconvert#optins?edit=01M3K8B51RGPG2842QXZN4DCWT&back=%23optins). The saved home follow-ups remained Balcony → Garden → Irrigation, Business still had four follow-ups, **MailPoet, Newsletter** remained selected, and Save draft was disabled.
- Reopened [QA — Persistence Sep28 coffee results](http://wconvert.local/wp-admin/admin.php?page=wconvert#optins?edit=01M3K8N3W8H9C89X2TNNDMT8VM&back=%23optins). Its saved **French press comfort** result remained referenced; Preview & test showed that result and its saved message for French press. Save draft was disabled. Evidence: `/tmp/wconvert-release-existing-qa-coffee.png`.
- Opened the existing legacy **DEMO 01 — Simple newsletter signup** (`01M3H5CS4E69305QDYW9SW7GHH`) without editing it. Edit showed Email signup → Acknowledgement; Flow showed the same connection. After reload, the original heading **Get our email updates**, required email field, and disabled Save draft remained. Evidence: `/tmp/wconvert-release-legacy-reopen.png`.

This browser pass covers one gallery JSON template, two saved QA drafts, and one untouched legacy campaign. It does not establish compatibility for every template, real destination delivery, publication, or merchant usability.

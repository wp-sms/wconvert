# Persistence and visitor browser checks

Checked 28 September 2026 in Chrome against the local WordPress admin. These are developer walkthroughs on dedicated draft copies. No demo original was saved, no campaign was published, no shared destination settings changed, and all visitor submissions below were simulated in Preview & test.

## QA — Persistence Sep28 home and business

Campaign ID `01M3K8B51RGPG2842QXZN4DCWT`, [local draft](http://wconvert.local/wp-admin/admin.php?page=wconvert#optins?edit=01M3K8B51RGPG2842QXZN4DCWT&back=%23optins), duplicated from Demo 04 with **Duplicate as draft** and renamed. In Edit, moved **Balcony planting details** earlier from question 2 of 4 to 1 of 4. Saved, reloaded, and confirmed the Edit group order was Balcony → Garden → Indoor → Irrigation with Save draft disabled. Flow showed the same order after reload. Evidence: `/tmp/wconvert-qa-persisted-followup-order.png`, `/tmp/wconvert-qa-flow-order.png`.

The visitor test selected all four home interests. It visited Balcony 1/4, Garden 2/4, Indoor 3/4, Irrigation 4/4, then one **Send one combined enquiry** screen. A simulated submission to `qa-all@example.test` was accepted in test with all four interests and their distinct free-text answers in Submitted answers. No Lead or real destination request was created. Evidence: `/tmp/wconvert-qa-all-matches-capture.png`, `/tmp/wconvert-qa-all-answers.png`.

For Back, selected Garden and Balcony, entered `Keep this balcony answer` and a temporary Garden answer, used Back twice to return to the interest choices, then deselected Garden. Balcony stayed filled, the next step went directly to the combined enquiry, and the simulated accepted snapshot had only Balcony and its retained answer. The removed Garden answer was absent. Evidence: `/tmp/wconvert-qa-back-prunes-answers.png`.

The untouched Business path still offered its original four interest choices. Selecting only Office planting led to Office planting details as matching follow-up 1 of 1.

Deleted **Indoor plants details** from the QA copy. The dialog said visitors would check remaining matching follow-ups then continue to the combined enquiry. After saving and reloading, the home group showed 3 follow-ups. Returning to Campaigns and reopening the QA draft preserved that deletion. Evidence: `/tmp/wconvert-qa-deleted-screen-reopen.png`.

Selected the existing **MailPoet, Newsletter** binding on the QA copy's Destinations tab and saved. After reloading the rebuilt admin, the journey summary said **MailPoet, Newsletter** and Destinations showed **1 selected** with that binding checked and Save draft disabled. This changed only the campaign selection, not shared destination settings. Evidence: `/tmp/wconvert-qa-destination-saved.png`.

After a temporary reorder of Garden to the first home follow-up, **Test this change** named **Garden landscaping details** and carried the change summary into the visitor walkthrough. **Suggested checks** described the actual `Your home interests includes Garden landscaping` condition and a Back/edit-answer case. It said these are cases to try, not proof that the rule is reachable or wins. The temporary reorder was undone; Save draft returned disabled. Evidence: `/tmp/wconvert-qa-test-handoff.png`.

## QA — Persistence Sep28 coffee results

Campaign ID `01M3K8N3W8H9C89X2TNNDMT8VM`, [local draft](http://wconvert.local/wp-admin/admin.php?page=wconvert#optins?edit=01M3K8N3W8H9C89X2TNNDMT8VM&back=%23optins), duplicated from Demo 05 and renamed. **Review uses** for **Filter or pour-over** listed its filter result and the grinder branch. Staged **French press** as the replacement without applying the retirement, followed the linked branch, and changed its condition to French press. **Back to How you brew** restored the pending review and French press replacement; the now-unrelated grinder branch disappeared from the review's dependency list. Cancel and Undo restored the saved filter branch without applying the retirement.

On the first build, the restored review appeared but focus landed on the Question text area. After the focus-return change was rebuilt, repeated both a no-edit return and an edited-rule return. In both cases the focused accessibility element was **Review answer uses**, with the staged French press replacement preserved. Evidence: `/tmp/wconvert-qa-review-return.png` (review UI before the focus fix; the focused-element finding is from the accessibility tree).

Added **French press comfort** with the explicit rule **How do you make your coffee? is French press** and the message **Choose a mellow, full-bodied blend for your French press.** Saved, reloaded, returned to Campaigns and reopened the QA draft. The editor retained the result reference and, after reload, showed the heading, message and condition as result 3, after the espresso and filter results and before **Everyone else**. Save draft was disabled. Evidence: `/tmp/wconvert-qa-result-persisted.png`.

Visitor walkthroughs on this saved draft:

- French press + Rich and chocolatey showed **French press comfort**, then the optional email signup. **No thanks** continued to **All set** with **Optional email signup Skipped** and no new details saved. Evidence: `/tmp/wconvert-qa-optional-skip.png`.
- Espresso machine + Bright and fruity missed the specific espresso rule and showed the **Everyone else** result **An easy everyday favourite**. Evidence: `/tmp/wconvert-qa-fallback-result.png`.
- Filter or pour-over, with the optional taste question unanswered, visited **Your grinder** and then showed **A fresh start for your filter brew** after selecting **No, I buy ground coffee**. Evidence: `/tmp/wconvert-qa-filter-result.png`.

## Boundaries

These checks establish UI persistence and simulated path behavior on the stated QA drafts. They do not prove real delivery, merchant usability, VoiceOver behavior, arbitrary graph support, or GitHub CI.

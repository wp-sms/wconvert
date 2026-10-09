# Real WordPress flow editor smoke check

Date: 30 September 2026. Site: `http://wconvert.local/wp-admin/admin.php?page=wconvert`. Browser: Chrome. Scope: three existing DEMO campaigns, Preview & test only.

## Cases

- **DEMO 01 — Simple newsletter signup:** Visitor journey accepted synthetic `qa-flow-simple@example.test` only after the required consent checkbox, then displayed the acknowledgement. Preview reported that no real Lead, destination request, or conversion was created. Sample answers predicted Email signup → Acknowledgement. No Back control was visible on the acknowledgement.
- **DEMO 05 — Coffee quiz with optional signup:** Espresso machine → optional Your taste question → result; Back from Your taste retained Espresso machine. The result exposed Optional email updates. “No thanks” reached All set and reported no new details saved; Back returned to optional signup. A synthetic `qa-flow-optional@example.test` was accepted in Preview and reached All set, with no real Lead or destination request. Sample answers showed the predicted optional-signup path and its assumed Submit action.
- **DEMO 04 — Home or business follow-ups:** Sample answers for My home with Garden landscaping and Balcony planting added both matching detail screens to the predicted path. My business selected the Everyone else fallback; Office planting and staff wellbeing added its matching detail screen. In Visitor journey, My business → Office planting reached that detail screen; the map reported “Follow-ups: Your business interests 1 of 4 visited” and said future screens were not predicted. The combined enquiry and ending were not visited.

## Focus and map retest

Before the final rebuild, reopening Preview & test while Sample answers was selected left `document.activeElement` on the editor’s “Preview & test” button outside the dialog. After the parent rebuilt assets and the tab was reloaded, reopening the retained Sample answers mode focused the `H2` “Preview & test” inside `[role="dialog"]`.

The first DEMO 04 “Show sample path on the map” attempt, made in the stale tab, left the editor blank. Chrome logged `TypeError: Failed to fetch dynamically imported module: http://wconvert.local/wp-content/plugins/wconvert-pro/public/admin/builder-BSi9BLU7.js` from `main-DsoUNSpB.js`. After the rebuild and one reload, the same action rendered the journey map, including the predicted sample route and follow-up counts.

## State and limits

All campaigns remained Draft; the editor showed Save draft disabled. No draft was saved, no campaign was published, and no sample was submitted outside Preview & test. The preview explicitly reported no real Leads or destination requests. These checks cover only the flows listed above; provider delivery and public visitor rendering were not exercised.

## Evidence

- [DEMO 05 optional signup result](demo05-optional-signup.jpg)
- [DEMO 05 sample route](demo05-sample-route.jpg)
- [DEMO 04 matched multi-interest sample](demo04-multi-interest-sample.jpg)
- [DEMO 04 initial blank map](demo04-map-blank.jpg)
- [DEMO 04 map after rebuilt assets](demo04-map-rebuilt.jpg)
- [DEMO 04 visitor walkthrough](demo04-walkthrough.jpg)

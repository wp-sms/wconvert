# Held designs review, 25 October 2026

20 setups the backlog review of 20 October sent back for revision, each reworked against its note. Machine checks: `results.json` (all 20 pass the visitor walk on a disposable WordPress at 320 and 1280 px). Judgement from each setup's contact sheets (`<id>-320.png`, `<id>-1440.png`) against `tools/design-library/pilot/PRACTICAL-REVIEW.md`. Standing limits: `tools/design-library/review/README.md`.

Design changes in this round: `ink-split` and `stacked-signup` put consent above the submit button, and ink-split centres its acknowledgement check; `journey-enquiry` and `journey-email-then-sms` put Back after the primary and skip actions, and the latter labels it Change email; `studio-window` caps its drawing at 7rem on phones; the three journey designs that showed consent by default now ship it hidden, which Privacy Guidance reveals for list Goals (ADR 0099). No setup that was approved uses a changed design except `maker-session-invitation`, whose render is unchanged.

## Approved

- **care-clinic-request**: the headline now names the clinic. The acknowledgement no longer claims a topic was chosen; it says a reply by email will talk through which session suits the item.
- **gift-message-enquiry**: the acknowledgement makes no claim about the optional format. The footer now says no order is changed, which is the brief's point, instead of booking wording.
- **remote-walkthrough-request**: the acknowledgement drops the false topic clause and says a reply will discuss whether a walkthrough suits the project.
- **portfolio-feedback-request**: the acknowledgement no longer asserts a selection and names the reply about scope and format.
- **translation-project-enquiry**: the acknowledgement drops 'the topic you selected' and names the reply about languages and scope.
- **restyling-notes**: unsubscribe wording appears once, in the consent line; the footer states the cadence and that no consultation follows. The acknowledgement names the monthly room ideas.
- **product-advice-request**: the intro now matches the form (choose a detail, tell us more in the email reply), the booking footer is replaced with 'Stock is not reserved', and the acknowledgement names the chosen detail.
- **basket-product-help**: the vocabulary has no free-text field, so the form still cannot hold the question itself. The copy now says so plainly: choose the subject, then say which item and what is needed in the email reply. The headline reads naturally. Approved as an honest, short basket-side ask; a message field would be a vocabulary change.
- **launch-interest**: consent sits between the field and the button at both widths. The acknowledgement names launch news and repeats that nothing is reserved; its check mark is centred with the heading.
- **journey-email-then-sms**: the SMS step now reads primary, Finish without SMS, then Change email. The acknowledgement names the email signup and, conditionally, the text request.
- **headlines-optional-sms**: the email step's headline says what the briefing is. Action order and the Change email label match the journey above; the acknowledgement is true whether or not a number was added.
- **landscaping-enquiry**: Back now sits below the primary 'Send my garden enquiry' at both widths, so the hierarchy reads top to bottom.
- **accounting-consultation**: the headline names bookkeeping. The acknowledgement eyebrow is 'Thank you' and the body states the email reply, so nothing promises steps it does not give.
- **collection-interest**: the collection question reads as the point but stays optional, and the acknowledgement no longer claims a preference was received. The phone headline breaks cleanly and unsubscribe wording appears once.
- **project-readiness-guide**: the cover now carries a numeral and a short caption, so the form has the only headline. 'One resource email' appears once, and the acknowledgement says the checklist was requested by email.
- **workspace-change-story**: visitor copy no longer calls the room fictional; the footnote states the limit plainly (every room differs). The headline no longer echoes accounting-consultation.
- **related-essay**: the headline and body now say what the follow-up covers: one small change to try, with an example.
- **drop-alerts**: consent sits above the button, and its wording is an agreement rather than a second copy of the button. The footer carries rates and opt-out once.
- **service-text-updates**: consent sits above the button; the desktop headline no longer strands 'By / text'; the acknowledgement names the service texts.
- **studio-welcome**: on a phone the drawing is 112 px tall, so the headline and the offer start in the first screen. Copy no longer ties the code to joining: the code is revealed either way and the monthly notes are a separate, unticked choice. The acknowledgement says the code is here.

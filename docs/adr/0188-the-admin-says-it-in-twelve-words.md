# 0188: The admin says it in twelve words

Accepted 2026-11-03.

[ADR 0136](0136-one-panel-grammar.md)'s ladder said a line of help keeps at most twelve words, but only the builder's panels were ever held to it. 584 translated admin strings ran longer.

## Decision

Every admin string over twelve words was put through the ladder and approved as a before/after list: 527 shortened, 10 moved to a tip, 3 deleted and 44 kept. The list is at [claude.ai/artifact/1t4FiYKiE2b9kMqEnerEL9](https://claude.ai/artifact/1t4FiYKiE2b9kMqEnerEL9). Its scope left out what visitors read, AI tool descriptions and the suggested privacy policy text.

**Twelve words is a target with these exceptions.** A string may run longer, or stay as it is, when it must hold:

- what is permanent, and what survives a deletion ([GUIDELINES](../../tools/design-system/GUIDELINES.md) §9)
- data sent to third parties ([ADR 0094](0094-privacy-guidance-reports-the-current-data-flow.md))
- a qualifier that stops a misreading: "not purchases", "not unique visitors", "does not prove a winner"
- an error's cause and its way out, because an error is read when something has failed
- what the merchant needs in order to act

**A moved string keeps a home.** `Field` and `SwitchSetting` now take `tip`, as `RegionHeader` does ([ADR 0187](0187-the-way-back-and-a-section-title-read-with-their-page.md)).

**The pass corrected what it found to be false:**

- A webhook test said no name or phone is sent, but it sends placeholders for both, from a campaign and from Settings.
- A template's format change said to place the block before publishing, but the block only finds published campaigns.
- A manually placed campaign "always comes first" read as beating other campaigns. It only replaces that same campaign's automatic placement.
- The rule limit's tip offered another group under "What opens it", which has none.

## Consequences

Two strings still name a way out nobody could find on screen: "Refresh the library" on a missing template file, and "refresh targets" when the month changes under an open dialog. Their reworded versions keep the door. Two destination skip reasons reach no screen, because `PushWorker` discards them, and can go when that code is next touched.

The `fa_IR` catalogues were retranslated with the new strings, because gettext keys on the source string.

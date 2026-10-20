# Practical review before a campaign is published

A setup is approved when three checks pass. Two are mechanical and a machine
runs them; one is judgement and the reviewer makes it.

## What the machine checks (`journey` and `wordpress`)

`tools/visual-tests/setup-checks.mjs` builds each setup through Prefill on a
disposable local WordPress and walks it as a visitor at 320 and 1280 px. For each
setup it records pass or fail in `docs/reviews/<batch>/results.json`:

- every screen reached through the visitor's own buttons, Back where it exists;
- empty and invalid required input refused, required consent enforced;
- one simulated failed submission keeps the details, and the retry saves a
  local Lead;
- the acknowledgement appears;
- configured resources open, real links and coupons work, resource emails are
  handed to the local outbox;
- no horizontal overflow and no page errors.

The publisher separately refuses unreadable contrast (pictures included), copy
defects and near-duplicates, and the layout audit (`library-polish.mjs`) measures
control sizes, close-button overlap and field contrast. A reviewer does not
repeat these.

Setups that show products need the commerce fixture
(`WCONVERT_REVIEW_COMMERCE=1`). A failure in `results.json` means fix the setup
or say why it is not a defect; it is never approved over.

## What the reviewer judges (`visual`)

Look at the setup's contact sheets (`<id>-320.png`, `<id>-1440.png`, from
`build/batch-audit.mjs --capture`) and, for a changed setup, its before/after
in `out/visual-diff.html`. Judge:

1. **One clear ask**, readable in two seconds, asking only for what the
   visitor's need requires.
2. **Hierarchy and composition**: what the eye reads first, spacing, line
   breaks; nothing cramped or stranded at phone width.
3. **A specific reward** and only real urgency.
4. **An honest acknowledgement**: no claim of delivery, a booking, a
   subscription or an approval that has not happened.
5. **The format behaves as its kind**: a bar is one line of intent, a slide-in
   does not cover the task, a popup earns its interruption.
6. **Survives the themes**: Midnight and Minimal, RTL and longer copy (the audit
   page's controls).
7. **Genuinely different** from its nearest design (the studio's comparison).

Write a note only about what is specific to this setup. The standard limits of
every review are stated once, in `../review/README.md`.

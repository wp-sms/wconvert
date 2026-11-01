# 0179: A straight campaign takes a new screen on any line

Accepted 2026-11-01. Amends [0142](0142-one-readable-flow-map.md) decision 5.

## Context

ADR 0142 gave every Flow line a "+". In Pro only a campaign that already
branched (one stored as a graph) had it; a straight campaign showed lines with
no way to add a screen between two of them.

## Decisions

1. **In Pro, every plain line of a straight campaign has a "+".** It opens the
   same add dialog as Add screen, on that line. A line's insert key is
   `edge:<id>` on a graph and `after:<screenId>` on a straight campaign
   (`FlowLine.insertAt`); the second is the continue line the screen gets once
   the campaign is a graph, so the dialog's own rules decide which kinds fit
   there — for example a question after a signup that has already been sent.
2. **Nothing new about branching.** The insert adds a screen on the line; the
   campaign gains no answer line until the merchant asks for one ("Send some
   answers to a different screen").
3. **At the 7-screen cap a straight campaign shows no "+"**, because the add
   would lift the cap that holds it (graph campaigns are not capped).
4. **Free is unchanged**: no "+", and the Flow map's Pro hint stays
   ([0147](0147-free-names-what-pro-adds-where-it-is-wanted.md)). A map with no
   way to add no longer keeps room in its pills for a "+" it never draws.

## Consequences

- A one-screen campaign has no line, so no "+"; Add screen covers it. No line
  leaves an Ending, so the last "+" inserts before it.
- The insert goes through the editor's history, so Undo removes it.

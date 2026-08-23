# Goal to Playbook prefill semantics

Type: grilling
Status: open
Blocked by: 01, 02, 03

## Question

What exactly does a Playbook contain, what happens when a user picks one, and
how does visible degradation work?

The concept is settled: Goal → Playbook → a prefilled Optin, with Playbooks as
data in a registry. The mechanics are not.

Open:

- **The Playbook schema.** It bundles a template reference, copy, display type,
  a rule set, destination hints, and notes. Each of those is a reference into a
  model settled elsewhere — so this is where the pieces have to actually fit
  together.
- **Prefill semantics.** Does picking a Playbook copy its values into a new Optin
  (a snapshot, diverging forever), or does the Optin keep a live reference to its
  Playbook? Snapshot is simpler and predictable; reference allows the library to
  improve existing optins but creates spooky action at a distance. This is hard
  to reverse.
- **Visible degradation.** A Playbook wanting exit intent on a free install must
  substitute the best available rule *and say so*. What is the substitution
  table, who owns it — the Playbook, the rule, or a resolver — and what does the
  user actually see? This is the mechanism that converts the premium seam into an
  upsell rather than a wall, so it deserves real design.
- **The Goal→Playbook relationship.** One Goal, many Playbooks. How are they
  filtered and ranked? OptinMonster filters by goal, industry, season, and
  features — is that the right axis set, or is it more than v1 needs?
- **Registry extensibility.** Third parties register Playbooks. What is that API,
  and how does it stay compatible with a future remote library?
- Where "Start from scratch" enters, given the goal screen is the front door.

Blocked because a Playbook is a bundle of things defined by the storage model,
the rule engine, and the Destination contract — it cannot be specified before
the things it bundles.

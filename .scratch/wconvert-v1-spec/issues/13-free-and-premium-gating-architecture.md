# Free and premium gating architecture

Type: grilling
Status: open
Blocked by: 02, 07

## Question

How is the free/premium line expressed in the codebase, and how is it enforced
at runtime?

The feature split is decided. This is about mechanism, and it has to be right
from the first commit — retrofitting a premium seam into a codebase that assumed
one tier is a rewrite.

Open:

- **Repository and build shape.** WSMS uses a `premium/` directory, php-scoper,
  and separate build profiles. What does WConvert inherit given it starts clean,
  and is one repo with a stripped free build still the right answer?
- **The gating primitive.** Most of the premium surface is *rules* — exit intent,
  device, referrer, geo, cookie/session — plus two display types. So gating is
  largely "is this rule available", which suggests entitlement belongs in the
  rule registry rather than scattered through the code. Confirm or reject.
- **Front-end enforcement.** Rules evaluate client-side, so premium rules ship in
  the loader payload or they do not work. What stops a free install from simply
  using them? And what is the *right* level of paranoia here — trivially
  bypassable gating is normal in this market, and hard enforcement costs bundle
  size on the hot path.
- **Entitlement check cost.** *Premium SDK and build split* establishes what a
  check costs; decide where checks happen so none land on the front-end request
  path.
- **Graceful degradation on downgrade.** A license lapses while optins use
  premium rules. Do they stop, degrade, or keep running? This overlaps the
  substitution mechanism in *Goal to Playbook prefill semantics* — reuse it.
- Where upsell surfaces appear, bounded by whatever *wp.org rules for freemium
  and remote libraries* establishes.

Blocked because the rule model determines what is being gated, and the SDK
research determines the enforcement primitives available.

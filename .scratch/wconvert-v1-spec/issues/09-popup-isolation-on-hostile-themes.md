# Popup isolation on hostile themes

Type: prototype
Status: open

## Question

How does an Optin render correctly on a theme that knows nothing about it?

A popup injected into an arbitrary WordPress theme faces CSS it did not write:
aggressive resets, `!important` cascades, z-index wars with sticky headers and
cookie banners, `overflow: hidden` on ancestors, and font inheritance. Getting
this wrong is the most visible possible failure — a broken popup is broken *on
the customer's homepage*.

Options to test, not just reason about:

- **Shadow DOM.** Near-total style isolation, and the cleanest answer in
  principle. Costs: form submission and accessibility need care, third-party
  font loading gets awkward, and older browser and theme-script interactions can
  surprise.
- **Scoped CSS with heavy specificity** — a prefixed class namespace plus a reset.
  Simpler and universally compatible, but never fully safe.
- **iframe.** Total isolation, worst ergonomics — sizing, fonts, and form UX all
  become harder.

Test against genuinely hostile cases: a block theme with `theme.json`, a heavy
page builder (Elementor/Divi), a theme with a sticky header, and a site already
running a cookie-consent banner.

Must also establish:

- Accessibility: focus trapping, `Esc` to close, `aria-modal`, focus restoration
  on close, and screen-reader behaviour. This is not optional polish — it is a
  wp.org and legal expectation.
- RTL. Flagged in the map's fog: VeronaLabs ships RTL-first and popup positioning
  is direction-sensitive. Determine whether RTL is a constraint this rendering
  primitive absorbs, or a separate decision that needs its own ticket.
- Size cost of the chosen approach against the *Loader on a cached page* budget.

Link the prototype from this ticket.

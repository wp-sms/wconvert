# WConvert stores no money

**No revenue column, no revenue table, no currency field, and no amount copied
onto anything WConvert owns.** If revenue is ever reported, WConvert tags the
WooCommerce order with the [[Optin]] that earned it and sums the real orders at
read time.

**Implemented by [ADR 0119](0119-actionable-reports-use-local-evidence-and-order-provenance.md):** the paid analytics module now links consented interactions to checkout and reads actual orders. No WConvert money storage is introduced.

## The demand is not in the evidence

The research archive is 670 reviews across 18 competitors. Searching it for
revenue produces about 24 hits, and **20 of them are the product name
"RevenueHunt"**. Four are a user talking about money.

Business outcomes, by contrast, are mentioned 57 times — and the negative ones
are specific and consistent: **the conversion tracking is wrong.** Users are not
asking for a figure in pounds. They are asking for the number they already have
to be correct.

That gap is worth naming precisely, because it is easy to read the marketing as
the demand. Pop Convert, OptiMonk and Justuno all *advertise* revenue
attribution prominently. Their users, in reviews, discuss whether the counts are
right. A revenue dashboard is what this category sells; it is not what this
category's users complain about missing.

So the honest read is: build the number that exists correctly, and do not build
a second number nobody asked for on top of a first one they distrust.

## The mechanism, if it is ever wanted

Order meta, summed at read.

WConvert writes `_wconvert_attribution` (versioned arm, family and interaction time) onto
the WooCommerce order at checkout, for an order whose session met an Optin.
Revenue for that Optin is then a `SUM` over real orders, filtered by that meta,
at the moment somebody looks.

Three things recommend it and each is already a decision this project made:

**It matches [ADR 0020](0020-conversions-are-interpreted-at-read.md).** A
[[Conversion]] carries no `goal`, no `had_email` and no display type; everything
needed to interpret a counter is read from `wconvert_optins` at report time.
Revenue interpreted at read is the same rule applied to a second question, and a
stored amount would be the frozen-at-write shape that ADR rejected — with the
same defect, that correcting anything upstream splits the history in two.

**It needs no sign-off**, because it adds no table and no column. Order meta is
WooCommerce's storage, keyed to WooCommerce's row, and it is a table-free
alternative in exactly the sense `CLAUDE.md` asks for one to be considered.

**It is what WooCommerce itself does.** Order Attribution has stored
`_wc_order_attribution_*` as order meta since WooCommerce 8.5 — source, medium,
campaign, device, session count — and reports on it by reading the orders back.
A WConvert attribution key sits beside those, in the place a WooCommerce
developer would look for it.

## The cost, recorded rather than discovered

**Delete the orders and the history goes with them.** A merchant who prunes
orders older than a year loses last year's revenue attribution entirely, because
the attribution lives on the order and nowhere else.

That is a real loss and it is the right one. The alternative — a stored amount
in a WConvert table — survives the order's deletion, which sounds like a feature
until you notice what it means: WConvert reporting revenue from orders that no
longer exist, in a total the merchant cannot reconcile against their own store,
possibly for a customer who exercised erasure. A number that outlives its source
is not a record, it is a claim.

It is also the same trade
[ADR 0019](0019-analytics-stores-daily-counters-not-events.md) already took
knowingly — *"you can never recompute"* — written down at the time rather than
found later.

## What is refused outright, not merely deferred

- **A revenue column on `wconvert_stats`.** The table is daily counters keyed
  `(optin_id, stat_date, kind)` and a money amount is not a count. Adding one
  means either a fifth `kind` whose value is not a tally — breaking what every
  reader of that table assumes — or a new column on the hottest write in the
  system.
- **Owning currency values or exchange rates.** [ADR 0119](0119-actionable-reports-use-local-evidence-and-order-provenance.md) allows read-time grouping/formatting by the order’s currency and product refund interpretation, without persisted money. The moment WConvert stores an amount it
  owns a currency, a rounding rule, a multi-currency store, refunds, partial
  refunds and tax. WooCommerce has all of that already and is the only thing on
  the site entitled to be right about it.
- **Reading order state on the capture path.** The [[Destination]] boundary is
  one-way at capture time (ADR 0007), and this must not become the exception
  that makes it one-and-a-half-way.

## Consequences

- **Phase 3 cannot design itself a revenue column**, which is the whole reason
  this exists before anything is built.
- **If revenue ships, it ships as order meta plus a read**, and the read lives
  where every other interpretation lives.
  [ADR 0034](0034-the-dashboard-joins-in-php.md)'s rule applies unchanged: the
  join is an interpretation, performed in PHP over two statements, not a SQL
  `JOIN` onto counters.
- **`tests/unit/Database/SchemaTest.php` passes untouched.** That is not
  incidental — it is the assertion that this decision was kept, and it is the
  sign-off gate working.
- **The correctness complaint is the actual backlog item.** "Incorrect
  conversion tracking" is what 670 reviews complain about, and it is answered by
  the eligibility inspector and the plain-language rule summary rather than by a
  currency symbol.

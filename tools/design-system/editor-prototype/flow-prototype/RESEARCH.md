# B: visitor-first journey authoring

Research and prototype revision: 24 September 2026. These are design hypotheses informed by official product documentation and our task walkthroughs, not usability-study results. Competitor accounts were not created or live campaigns tested.

## What users need to understand

1. Where does a visitor start, and who can open the campaign?
2. Which screen comes next for a particular answer?
3. Who can reach a selected screen, including paths that rejoin?
4. What happens when more than one condition matches?
5. Can I add or change a question without breaking another path?
6. When are details saved and which destination receives them?

A diagram alone answers these poorly when the merchant must mentally execute its conditions. The key improvement is a live sample visitor, with the map as context and readable rules beside it.

## Comparable products and what we took from them

| Product / source | Observed pattern | Application to B |
| --- | --- | --- |
| [Klaviyo multi-branch splits](https://help.klaviyo.com/hc/en-us/articles/52369094030235) | Ordered first match, permanent Everyone else, preview explains routing. | Visible check order; move up/down; protected default path; sample explains when later paths also match. |
| [Intercom workflow builder](https://www.intercom.com/help/en/articles/6611595-using-the-workflows-builder) | Connected message/action/condition canvas, contextual configuration, first matching branch from top to bottom. | Keep arbitrary connections, but make common changes possible with buttons and selects. |
| [Typeform Logic Map](https://help.typeform.com/hc/en-us/articles/360057591531-Logic-Map) | Type icons, map navigation, clickable logic problems; moving cards does not change logic. | Distinguish layout from routing. Keep named routes and link checks to affected screens. |
| [Tally conditional logic](https://tally.so/help/conditional-form-logic) | Plain-language When/Then, ALL/ANY groups, progressively detailed questions. | Dedicated WHEN conditions → THEN destination; checkbox answer choices; readable rule summary. |
| [Customer.io workflow builder](https://docs.customer.io/messaging/send/workflows/builder/) | Contextual blocks, branch configuration, explicit reconnection and canvas movement. | Contextual insertion preserves continuation; shared screens remain shared when paths merge. |
| [Manychat condition blocks](https://help.manychat.com/hc/en-us/articles/14281142518556-Condition-Block) | Explicit matching/nonmatching routes. | Show the fallback as a real route, not a hidden assumption. |

These products do not establish one universally superior orientation. We retain horizontal flow because it fits the selected concept and separates branching vertically from progression horizontally. Dense paths still require pan/zoom; a compact sample timeline gives users a readable alternative representation of the same journey.

## UI principles

- [Recognition rather than recall](https://www.nngroup.com/articles/recognition-and-recall/): show answer choices, source questions, destinations and the selected path instead of making users remember them across sections.
- [Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/): compact ordinary screens, larger decision areas, incoming details on demand, completed sample answers collapsed but editable.
- Prevent avoidable errors: retain a fallback, disable deleting referenced choices, reject cycles, flag unavailable condition dependencies. This remains partial prototype validation.
- Explain results: live path, next unanswered screen, completion and skipped-screen count, overlapping-match explanation, simulated handoffs at the capture that causes them.
- Keep navigation stable: ordinary text edits do not trigger automatic re-layout. On smaller canvases, the sample camera follows the current screen rather than shrinking a whole journey until it is unreadable.

## Library review

| Option | What it supplies | Decision |
| --- | --- | --- |
| [React Flow](https://reactflow.dev/learn/advanced-use/accessibility) | Custom React nodes/edges and built-in keyboard/screen-reader support. | Keep. Matches the existing React admin and leaves domain rules in our application. Our custom controls still need accessibility review. |
| [ELK vs Dagre / d3 layout](https://reactflow.dev/learn/layouting/layouting) | Layout algorithms with different support for sizing, ports and edge routing. | Keep lazily loaded ELK for named ports, branches and merges. Its bundle is large; measure/consider a worker for production. Dagre is worth reconsidering only if the production model is much simpler. |
| [JointJS for React](https://docs.jointjs.com/react/getting-started/) | React nodes, diagram core, with additional editor capabilities in JointJS+. | Credible alternative if diagram editing becomes the product's core. No demonstrated benefit sufficient to justify switching this prototype; commercial feature boundaries need consideration. |
| [Rete.js](https://retejs.org/) | Processing-oriented visual programming framework with graph engines and plugins. | More relevant to an executable visual programming environment. We already own visitor routing semantics; adopting a second engine adds questions without resolving merchant clarity. |
| [React Query Builder](https://react-querybuilder.js.org/docs/intro) | Configurable fields, rules, combinators and controlled query state. | Candidate for a shared advanced rules editor if nested groups expand. This revision uses small domain-specific controls and the existing condition matcher; no dependency added. Do not export or adopt its schema without a domain adapter. |
| [Radix](https://www.radix-ui.com/primitives/docs/overview/accessibility) | Accessible primitive behavior including focus/keyboard foundations. | Continue the admin's existing Radix/shadcn primitives; no competing component library. |

The major UX improvements here did not require a new library. A canvas library supplies interaction mechanics; it does not decide which information a merchant needs at each moment.

## Revision 4 implemented

- “Explore a visitor path” presets from the first question, plus Try answers for every campaign.
- In-panel sample journey with live graph highlighting, editable earlier answers, later-answer invalidation and capture/skip decisions.
- Collapsed completed answers and an immediately available next question. Multi-answer questions remain expandable/editable.
- Exact traced edges, including distinct Continue and No thanks edges sharing a target.
- Simulated destinations appear at submission; declining SMS retains the earlier email handoff.
- “Who reaches this screen?” with incoming source and rule links, explicitly described as immediate entry rules.
- WHEN/THEN condition editor: ALL/ANY, multiple clauses, supported comparison operators, multiple answer values, visible priority in both directions.
- Default route cannot be removed in the path inspector; its destination remains editable.
- Smaller continuation cards and lower visual emphasis on insertion controls; larger branching cards retain visible priorities.
- Live sample explains overlapping matches; new condition references participate in choice-deletion protection and dependency checks.

## Limits before production

- This changes the proposed graph authoring model, not the shipping ordered-screen visibility model. Existing independent conditions can include multiple screens; first-match routing cannot silently replace that behavior.
- Flat ALL/ANY groups are supported, not arbitrarily nested groups. Contradictory conditions and general unreachable-by-logic paths are not fully diagnosed.
- The preview now uses the shared visitor renderer inside an iframe. Routing, captures, consent records, retries, delivery and analytics remain simulated; this is not the production loader/capture pipeline. Previously submitted snapshots remain immutable in the test ledger.
- Display and destination settings remain representative. Result titles, conditions, ordering, fallback and fixture products are editable; provider/product loading is simulated.
- Complete keyboard/screen-reader coverage, measured performance, migration and representative merchant task testing remain production work. A twenty-screen navigation fixture and real-current-manager comparison harness are now available; see EVALUATION.md. A canvas alone is not proof of accessibility.
- Side-panel scrolling and a smaller phone canvas are compromises. Desktop remains the primary authoring target.

## Task-based assessment to run with merchants

Ask first-time users to explain which screens a balcony visitor sees, change that path, insert one follow-up, make an overlapping rule and explain priority, then skip SMS and identify what was saved. Measure completion without hints, incorrect predictions, navigation effort and confidence. Compare against the existing manager using equivalent behavior before claiming B is categorically easier.

## Revision 8 implementation choices

- Official NodeToolbar: https://reactflow.dev/api-reference/components/node-toolbar — used for contextual actions.
- Contextual zoom: https://reactflow.dev/examples/interaction/contextual-zoom — adapted as a readable overview while preserving connection positions.
- Labeled groups: https://reactflow.dev/ui/components/labeled-group-node — presentation inspiration. Our collapsed group is a custom node representing a provably uninterrupted conditional run; it is not an executable branch.
- Expand/collapse: https://reactflow.dev/examples/layout/expand-collapse — Pro tree example, not copied; a naive tree collapse would be wrong for shared downstream screens in our DAG.
- Layout guidance: https://reactflow.dev/learn/layouting/layouting — retained existing ELK rather than adding a second geometry owner.
- Community Smart Edge: https://github.com/tisoap/react-flow-smart-edge — deferred; not installed or tested. Node obstacle avoidance does not resolve journey semantics.

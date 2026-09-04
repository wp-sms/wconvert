import { bootProInspector } from './tier';
import { ELITE_MODULES } from '../modules';
import { narrowToArms } from '../../../../modules/ab-testing/loader';

/**
 * The eligibility inspector at the **elite** tier.
 *
 * =============================================================================
 * ONE PER TIER, FOR THE REASON PRO HAS ONE AT ALL.
 * =============================================================================
 * Pro dequeues free's inspector and enqueues its own, because free's has no
 * `exit_intent` module and would report every exit-intent Optin as `inert` —
 * *"it has no trigger this site can fire"* — about Optins that work perfectly
 * (ADR 0048). A diagnostic that is confidently wrong is worse than none,
 * because the merchant acts on it and goes and rewrites correct rules.
 *
 * The same hazard exists one rung finer, in both directions: an Elite inspector
 * on a Basic install would report the cart Conditions as evaluable on a build
 * that cannot evaluate them, and a Basic inspector on an Elite install would
 * call every premium Trigger inert. So the set is this tier's, named from the
 * same place its loader names it.
 */
export default bootProInspector(ELITE_MODULES, narrowToArms);

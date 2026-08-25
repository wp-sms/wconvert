import { createLoader } from './engine';
import { boot } from './boot';
import { FREE_MODULES } from './modules';
import { templatePresenter } from './present';

/**
 * Free's loader entry.
 *
 * Free's build composes free's modules and nothing else. There is no mode flag
 * and no tree-shaking: premium code is absent from this bundle because it was
 * never in this tree (ADR 0028).
 *
 * Composition is pure and touches no DOM, so it happens here at module scope.
 * `boot` is the part that must survive being run at the wrong moment, and it
 * is written to (ADR 0004).
 */
const loader = createLoader(FREE_MODULES);

boot(loader, templatePresenter);

export default loader;

import { createLoader } from './engine';
import { FREE_MODULES } from './modules';

/**
 * Free's loader entry.
 *
 * Free's build composes free's modules and nothing else. There is no mode flag
 * and no tree-shaking: premium code is absent from this bundle because it was
 * never in this tree (ADR 0028).
 */
export default createLoader(FREE_MODULES);

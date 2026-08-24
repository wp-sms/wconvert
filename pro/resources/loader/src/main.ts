import { createLoader } from '@loader/engine';
import { FREE_MODULES } from '@loader/modules';
import { PRO_MODULES } from './modules';

/**
 * Pro's loader entry — free's modules plus Pro's (ADR 0028).
 *
 * Pro ships a COMPLETE replacement loader and dequeues free's in PHP, so the
 * page only ever carries one (ADR 0014). This is the same composition ADR 0014
 * already describes at the plugin level, applied one layer down.
 *
 * The import direction is the whole design: Pro reaches into free, free never
 * reaches into Pro.
 */
export default createLoader([...FREE_MODULES, ...PRO_MODULES]);

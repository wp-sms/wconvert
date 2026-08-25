import { createLoader } from '@loader/engine';
import { boot } from '@loader/boot';
import { FREE_MODULES } from '@loader/modules';
import { noRenderer } from '@loader/present';
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
const loader = createLoader([...FREE_MODULES, ...PRO_MODULES]);

boot(loader, noRenderer);

export default loader;

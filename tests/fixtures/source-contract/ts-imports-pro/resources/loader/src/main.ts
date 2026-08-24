import { createLoader } from './engine';
import { FREE_MODULES } from './modules';
import { PRO_MODULES } from '../../../pro/resources/loader/src/modules';

export default createLoader([...FREE_MODULES, ...PRO_MODULES]);

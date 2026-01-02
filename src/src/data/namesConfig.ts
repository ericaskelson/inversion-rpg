import type { NamesConfig } from '../types/game';
import data from './namesConfig.json';

/**
 * Names configuration loaded from JSON.
 * Contains name lists organized by sex and race.
 */
export const namesConfig: NamesConfig = data as NamesConfig;

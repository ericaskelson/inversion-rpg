import type { AppearanceConfig } from '../types/game';
import data from './appearanceConfig.json';

/**
 * Appearance configuration loaded from JSON.
 * The JSON file can be edited by the editor server.
 */
export const appearanceConfig: AppearanceConfig = data as AppearanceConfig;

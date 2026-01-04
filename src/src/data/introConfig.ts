import type { IntroConfig } from '../types/game';
import data from './introConfig.json';

/**
 * Intro screen configuration loaded from JSON.
 * The JSON file can be edited by the editor server.
 */
export const introConfig: IntroConfig = data as IntroConfig;

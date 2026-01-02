import type { CharacterCreationData } from '../types/game';
import data from './characterCreation.json';

/**
 * Character creation data loaded from JSON.
 * The JSON file can be edited by the editor server.
 */
export const characterCreationData: CharacterCreationData = data as CharacterCreationData;

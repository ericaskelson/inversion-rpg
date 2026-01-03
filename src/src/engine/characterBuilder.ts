import type {
  Character,
  CategoryId,
  AttributeId,
  CharacterOption,
  CategoryConfig,
  OptionRequirement,
  CharacterBuilderState,
  CharacterCreationData,
  AppearanceSelections,
  AppearanceConfig,
} from '../types/game';

// Default attribute values
const DEFAULT_ATTRIBUTES: Record<AttributeId, number> = {
  strength: 0,
  agility: 0,
  endurance: 0,
  cunning: 0,
  charisma: 0,
  will: 0,
};

/**
 * Initialize an empty builder state
 */
export function createInitialBuilderState(): CharacterBuilderState {
  return {
    name: '',
    currentCategoryIndex: 0,
    selections: {
      sex: [],
      race: [],
      appearance: [],
      culture: [],
      avocation: [],
      virtueVice: [],
      philosophy: [],
      edge: [],
      skills: [],
      feats: [],
      spells: [],
      gear: [],
    },
    appearanceSelections: {},
    calculatedFate: 0,
    calculatedAttributes: { ...DEFAULT_ATTRIBUTES },
    calculatedTraits: [],
  };
}

/**
 * Get all selected options across all categories
 */
function getSelectedOptions(
  state: CharacterBuilderState,
  data: CharacterCreationData
): CharacterOption[] {
  const options: CharacterOption[] = [];

  for (const category of data.categories) {
    const selectedIds = state.selections[category.id] || [];
    for (const optionId of selectedIds) {
      const option = category.options.find(o => o.id === optionId);
      if (option) {
        options.push(option);
      }
    }
  }

  return options;
}

/**
 * Calculate appearance-related effects
 */
function getAppearanceEffects(
  selections: AppearanceSelections,
  config: AppearanceConfig
): { fate: number; attributes: Partial<Record<AttributeId, number>>; traits: string[] } {
  let fate = 0;
  const attributes: Partial<Record<AttributeId, number>> = {};
  const traits: string[] = [];

  if (selections.build) {
    const build = config.builds.find(b => b.id === selections.build);
    if (build) {
      fate += build.fate ?? 0;
      if (build.attributes) {
        for (const [attr, value] of Object.entries(build.attributes)) {
          attributes[attr as AttributeId] = (attributes[attr as AttributeId] ?? 0) + value;
        }
      }
      if (build.traits) traits.push(...build.traits);
    }
  }

  if (selections.hairColor) {
    const hair = config.hairColors.find(h => h.id === selections.hairColor);
    if (hair) {
      fate += hair.fate ?? 0;
      if (hair.traits) traits.push(...hair.traits);
    }
  }

  if (selections.portraitId) {
    const portrait = config.portraits.find(p => p.id === selections.portraitId);
    if (portrait) {
      fate += portrait.fate ?? 0;
      if (portrait.traits) traits.push(...portrait.traits);
    }
  }

  return { fate, attributes, traits };
}

/**
 * Recalculate derived values from current selections
 */
export function recalculateDerivedValues(
  state: CharacterBuilderState,
  data: CharacterCreationData
): CharacterBuilderState {
  const selectedOptions = getSelectedOptions(state, data);

  // Calculate fate
  let fate = 0;
  for (const option of selectedOptions) {
    fate += option.fate ?? 0;
  }

  // Calculate attributes
  const attributes = { ...DEFAULT_ATTRIBUTES };
  for (const option of selectedOptions) {
    if (option.attributes) {
      for (const [attr, value] of Object.entries(option.attributes)) {
        attributes[attr as AttributeId] += value;
      }
    }
  }

  // Collect traits (deduplicated)
  const traitSet = new Set<string>();
  for (const option of selectedOptions) {
    if (option.traits) {
      for (const trait of option.traits) {
        traitSet.add(trait);
      }
    }
  }

  return {
    ...state,
    calculatedFate: fate,
    calculatedAttributes: attributes,
    calculatedTraits: Array.from(traitSet),
  };
}

/**
 * Update appearance selections and recalculate derived values
 */
export function updateAppearanceSelections(
  selections: AppearanceSelections,
  state: CharacterBuilderState,
  appearanceConfig: AppearanceConfig
): CharacterBuilderState {
  // Get the effects from the OLD appearance selections
  const oldEffects = state.appearanceSelections
    ? getAppearanceEffects(state.appearanceSelections, appearanceConfig)
    : { fate: 0, attributes: {}, traits: [] };

  // Get the effects from the NEW appearance selections
  const newEffects = getAppearanceEffects(selections, appearanceConfig);

  // Calculate the new derived values by removing old and adding new
  let fate = state.calculatedFate - oldEffects.fate + newEffects.fate;

  const attributes = { ...state.calculatedAttributes };
  // Remove old appearance attributes
  for (const [attr, value] of Object.entries(oldEffects.attributes)) {
    attributes[attr as AttributeId] -= value;
  }
  // Add new appearance attributes
  for (const [attr, value] of Object.entries(newEffects.attributes)) {
    attributes[attr as AttributeId] += value;
  }

  // Update traits
  const traitSet = new Set(state.calculatedTraits);
  // Remove old appearance traits
  for (const trait of oldEffects.traits) {
    traitSet.delete(trait);
  }
  // Add new appearance traits
  for (const trait of newEffects.traits) {
    traitSet.add(trait);
  }

  return {
    ...state,
    appearanceSelections: selections,
    calculatedFate: fate,
    calculatedAttributes: attributes,
    calculatedTraits: Array.from(traitSet),
  };
}

/**
 * Check if a single requirement is met
 */
function checkRequirement(
  req: OptionRequirement,
  state: CharacterBuilderState
): boolean {
  // Trait requirement
  if (req.trait) {
    if (!state.calculatedTraits.includes(req.trait)) {
      return false;
    }
  }

  // Not-trait requirement
  if (req.notTrait) {
    if (state.calculatedTraits.includes(req.notTrait)) {
      return false;
    }
  }

  // Attribute requirement
  if (req.attribute) {
    const value = state.calculatedAttributes[req.attribute.id] ?? 0;
    switch (req.attribute.op) {
      case '>=': if (!(value >= req.attribute.value)) return false; break;
      case '>': if (!(value > req.attribute.value)) return false; break;
      case '<=': if (!(value <= req.attribute.value)) return false; break;
      case '<': if (!(value < req.attribute.value)) return false; break;
    }
  }

  // Selection requirement
  if (req.selection) {
    const categorySelections = state.selections[req.selection.category] || [];
    if (!categorySelections.includes(req.selection.optionId)) {
      return false;
    }
  }

  // Not-selection requirement
  if (req.notSelection) {
    const categorySelections = state.selections[req.notSelection.category] || [];
    if (categorySelections.includes(req.notSelection.optionId)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if an option is available given current state
 */
export function isOptionAvailable(
  option: CharacterOption,
  category: CategoryConfig,
  state: CharacterBuilderState
): boolean {
  // Check requirements
  if (option.requires) {
    for (const req of option.requires) {
      if (!checkRequirement(req, state)) {
        return false;
      }
    }
  }

  // Check incompatibilities
  if (option.incompatibleWith) {
    const categorySelections = state.selections[category.id] || [];
    for (const incompatId of option.incompatibleWith) {
      if (categorySelections.includes(incompatId)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if ALL options in a category are unavailable (locked)
 * Used to hide categories like Spells for non-spellcasters
 */
export function isCategoryFullyLocked(
  category: CategoryConfig,
  state: CharacterBuilderState
): boolean {
  // Special categories that use custom selectors are never fully locked
  if (category.id === 'appearance') {
    return false;
  }

  // If category has no options, consider it locked
  if (category.options.length === 0) {
    return true;
  }

  // Check if at least one option is available
  for (const option of category.options) {
    if (isOptionAvailable(option, category, state)) {
      return false; // Found an available option, not fully locked
    }
  }

  return true; // All options are locked
}

/**
 * Check if an option is currently selected
 */
export function isOptionSelected(
  optionId: string,
  categoryId: CategoryId,
  state: CharacterBuilderState
): boolean {
  return (state.selections[categoryId] || []).includes(optionId);
}

/**
 * Toggle an option selection
 */
export function toggleOption(
  optionId: string,
  category: CategoryConfig,
  state: CharacterBuilderState,
  data: CharacterCreationData
): CharacterBuilderState {
  const currentSelections = [...(state.selections[category.id] || [])];
  const isCurrentlySelected = currentSelections.includes(optionId);

  let newSelections: string[];

  if (isCurrentlySelected) {
    // Deselect
    newSelections = currentSelections.filter(id => id !== optionId);
  } else {
    // Select
    if (category.maxPicks === 1) {
      // Single-select: replace
      newSelections = [optionId];
    } else if (currentSelections.length >= category.maxPicks) {
      // Max reached: can't add more
      return state;
    } else {
      // Multi-select: add
      newSelections = [...currentSelections, optionId];
    }
  }

  const newState: CharacterBuilderState = {
    ...state,
    selections: {
      ...state.selections,
      [category.id]: newSelections,
    },
  };

  // Recalculate derived values
  return recalculateDerivedValues(newState, data);
}

/**
 * Check if a category has valid selections (meets minPicks)
 */
export function isCategoryComplete(
  category: CategoryConfig,
  state: CharacterBuilderState
): boolean {
  // Special handling for appearance category
  if (category.id === 'appearance') {
    // Appearance is complete when build, skinTone, and hairColor are selected
    // Portrait is optional (might not have any matching portraits yet)
    const { build, skinTone, hairColor } = state.appearanceSelections || {};
    return !!(build && skinTone && hairColor);
  }

  const selections = state.selections[category.id] || [];
  return selections.length >= category.minPicks;
}

/**
 * Check if all categories are complete
 * Categories that are fully locked (all options unavailable) are skipped
 */
export function isCharacterComplete(
  data: CharacterCreationData,
  state: CharacterBuilderState
): boolean {
  for (const category of data.categories) {
    // Skip fully-locked categories (e.g., Spells for non-spellcasters)
    if (isCategoryFullyLocked(category, state)) {
      continue;
    }
    if (!isCategoryComplete(category, state)) {
      return false;
    }
  }
  return state.name.trim().length > 0;
}

/**
 * Build final Character from builder state
 */
export function buildCharacter(
  state: CharacterBuilderState
): Character {
  return {
    name: state.name,
    fate: state.calculatedFate,
    attributes: { ...state.calculatedAttributes },
    traits: [...state.calculatedTraits],
    selections: { ...state.selections },
  };
}

/**
 * Get a descriptive term for an attribute value
 */
export function describeAttribute(value: number): string {
  if (value <= -3) return 'Crippled';
  if (value === -2) return 'Feeble';
  if (value === -1) return 'Weak';
  if (value === 0) return 'Average';
  if (value === 1) return 'Capable';
  if (value === 2) return 'Strong';
  if (value === 3) return 'Exceptional';
  if (value === 4) return 'Remarkable';
  if (value >= 5) return 'Legendary';
  return 'Average';
}

/**
 * Get a descriptive term for fate value
 */
export function describeFate(fate: number): string {
  if (fate <= -5) return 'Cursed';
  if (fate <= -2) return 'Ill-Starred';
  if (fate <= 0) return 'Unremarkable';
  if (fate <= 3) return 'Promising';
  if (fate <= 6) return 'Destined';
  if (fate <= 9) return 'Fated for Greatness';
  if (fate <= 12) return 'Chosen by Heaven';
  if (fate <= 15) return 'Prophesied';
  if (fate <= 18) return 'World-Shaper';
  if (fate <= 21) return 'Legend Incarnate';
  if (fate <= 24) return 'Myth-Touched';
  return 'Avatar of Destiny';
}

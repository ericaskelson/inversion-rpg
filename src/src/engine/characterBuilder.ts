import type {
  Character,
  CategoryId,
  AttributeId,
  CharacterOption,
  CategoryConfig,
  OptionRequirement,
  CharacterBuilderState,
  CharacterCreationData,
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
  const selections = state.selections[category.id] || [];
  return selections.length >= category.minPicks;
}

/**
 * Check if all categories are complete
 */
export function isCharacterComplete(
  data: CharacterCreationData,
  state: CharacterBuilderState
): boolean {
  for (const category of data.categories) {
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
  if (fate <= 10) return 'Fated for Greatness';
  return 'Chosen by Heaven';
}

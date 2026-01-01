// ============================================
// CHARACTER TYPES
// ============================================

export interface Character {
  name: string;
  fate: number;
  attributes: Record<string, number>;
  traits: string[];
  // Track which options were selected (for prerequisites)
  selections: Record<CategoryId, string[]>; // category -> option ids
}

// Core attributes used in the game
export type AttributeId =
  | 'strength'
  | 'agility'
  | 'endurance'
  | 'cunning'
  | 'charisma'
  | 'will';

// ============================================
// CHARACTER CREATION TYPES
// ============================================

// Category IDs
export type CategoryId =
  | 'sex'
  | 'race'
  | 'appearance'
  | 'culture'
  | 'avocation'
  | 'virtueVice'
  | 'philosophy'
  | 'edge'
  | 'skills'
  | 'feats'
  | 'spells'
  | 'gear';

// Requirement for an option to be available
export interface OptionRequirement {
  trait?: string;
  notTrait?: string;
  attribute?: { id: AttributeId; op: '>=' | '>' | '<=' | '<'; value: number };
  selection?: { category: CategoryId; optionId: string };
  notSelection?: { category: CategoryId; optionId: string };
}

// A single option within a category
export interface CharacterOption {
  id: string;
  name: string;
  description: string;
  fate?: number; // Fate adjustment (+ or -)
  attributes?: Partial<Record<AttributeId, number>>; // Attribute adjustments
  traits?: string[]; // Traits to add
  requires?: OptionRequirement[]; // All must be met (AND)
  incompatibleWith?: string[]; // Option IDs that can't be selected with this
  isDrawback?: boolean; // Visual indicator for negative options
}

// Category configuration
export interface CategoryConfig {
  id: CategoryId;
  name: string;
  description: string;
  minPicks: number;
  maxPicks: number;
  options: CharacterOption[];
}

// All character creation data
export interface CharacterCreationData {
  categories: CategoryConfig[];
}

// Builder state during character creation
export interface CharacterBuilderState {
  name: string;
  currentCategoryIndex: number;
  selections: Record<CategoryId, string[]>; // category -> selected option IDs
  // Derived values (recalculated on each change)
  calculatedFate: number;
  calculatedAttributes: Record<AttributeId, number>;
  calculatedTraits: string[];
}

// Condition types
export interface AttributeCondition {
  attribute: string;
  op: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number;
}

export interface TraitCondition {
  trait: string;
  has?: boolean; // defaults to true (has the trait)
}

export type Condition = 'default' | AttributeCondition | TraitCondition;

// Availability requirements
export interface AvailabilityRequirement {
  requires?: AttributeCondition | TraitCondition;
  chance?: number; // 0.0 to 1.0
}

// Choice and outcome types
export interface Outcome {
  condition: Condition;
  next: string; // scenario ID
}

export interface Choice {
  text: string;
  available?: AvailabilityRequirement;
  outcomes: Outcome[];
}

// ============================================
// SCENARIO TYPES
// ============================================

// Start configuration for multi-start system
export interface StartConfig {
  minFate?: number | null;  // null = no minimum
  maxFate?: number | null;  // null = no maximum
  chance: number;           // 1-100, probability of appearing
  requires?: OptionRequirement[]; // Additional requirements
}

// Scenario type
export interface Scenario {
  id: string;
  content: string; // markdown
  choices: Choice[];
  isStart?: boolean;
  startConfig?: StartConfig; // Only for start nodes
  isEnding?: boolean;
  endingTitle?: string;
}

// Game state
export interface GameState {
  character: Character;
  currentScenarioId: string;
  history: string[]; // visited scenario IDs
}

// Scenario bundle (output of build script)
export type ScenarioBundle = Record<string, Scenario>;

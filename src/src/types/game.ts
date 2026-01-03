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

// ============================================
// APPEARANCE SYSTEM
// ============================================

export type BuildType = 'slim' | 'average' | 'athletic' | 'muscular' | 'heavy';
export type SkinTone = 'pale' | 'fair' | 'tan' | 'olive' | 'brown' | 'dark';
export type HairColor = 'blonde' | 'brown' | 'black' | 'red' | 'gray' | 'white' | 'bald';

export interface AppearanceOption {
  id: string;
  name: string;
  description: string;
  image?: string;
  traits?: string[];
  attributes?: Partial<Record<AttributeId, number>>;
  fate?: number;
}

export interface Portrait {
  id: string;
  name: string;
  image: string;
  build: BuildType;
  skinTone: SkinTone;
  hairColor: HairColor;
  sex: 'male' | 'female';
  race: string;  // Dynamic - pulled from race options
  traits?: string[];
  fate?: number;
}

// Prompt preset for portrait generation
export interface PromptPreset {
  id: string;
  name: string;
  basePrompt: string;
}

// Portrait generation configuration
export interface PortraitPromptConfig {
  basePrompt: string;
  styleModifiers: string;
  aspectRatio: string;
  imageSize: string;
  model?: 'nano-banana-pro' | 'nano-banana';  // Default: nano-banana-pro
  presets?: PromptPreset[];
}

// A pending portrait awaiting review
export interface PendingPortrait {
  id: string;
  tempPath: string;  // Path to temp image file
  build: BuildType;
  skinTone: SkinTone;
  hairColor: HairColor;
  sex: 'male' | 'female';
  race: string;
  generatedAt: string;  // ISO timestamp
  prompt: string;  // The actual prompt used
}

// Portrait generation request
export interface PortraitGenerationRequest {
  builds: BuildType[];
  skinTones: SkinTone[];
  hairColors: HairColor[];
  sexes: ('male' | 'female')[];
  races: string[];
}

export interface AppearanceConfig {
  builds: (AppearanceOption & { id: BuildType })[];
  skinTones: (AppearanceOption & { id: SkinTone })[];
  hairColors: (AppearanceOption & { id: HairColor })[];
  portraits: Portrait[];
  portraitConfig?: PortraitPromptConfig;
}

// Appearance selections stored in builder state
export interface AppearanceSelections {
  build?: BuildType;
  skinTone?: SkinTone;
  hairColor?: HairColor;
  portraitId?: string;
}

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
  subcategory?: string; // Group within category (e.g., "Martial Skills", "Magic Skills")
  image?: string; // Path to background image (relative to /images/options/)
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
  appearanceSelections: AppearanceSelections; // Special handling for appearance
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
// NAME SELECTION TYPES
// ============================================

export interface NamesConfig {
  names: {
    male: Record<string, string[]>;   // race -> names
    female: Record<string, string[]>; // race -> names
  };
  displayCount: number;  // How many names to show at once
  allowCustom: boolean;  // Whether to allow free-text input
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

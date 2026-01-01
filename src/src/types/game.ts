// Character types
export interface Character {
  name: string;
  attributes: Record<string, number>;
  traits: string[];
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

// Scenario type
export interface Scenario {
  id: string;
  content: string; // markdown
  choices: Choice[];
  isStart?: boolean;
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

import type { Character, Condition, AttributeCondition, TraitCondition, Choice, Outcome } from '../types/game';

/**
 * Check if a condition is an attribute condition
 */
function isAttributeCondition(cond: Condition): cond is AttributeCondition {
  return typeof cond === 'object' && 'attribute' in cond;
}

/**
 * Check if a condition is a trait condition
 */
function isTraitCondition(cond: Condition): cond is TraitCondition {
  return typeof cond === 'object' && 'trait' in cond;
}

/**
 * Evaluate a single condition against a character
 */
export function evaluateCondition(condition: Condition, character: Character): boolean {
  if (condition === 'default') {
    return true;
  }

  if (isAttributeCondition(condition)) {
    const value = character.attributes[condition.attribute] ?? 0;
    switch (condition.op) {
      case '>': return value > condition.value;
      case '<': return value < condition.value;
      case '>=': return value >= condition.value;
      case '<=': return value <= condition.value;
      case '==': return value === condition.value;
      case '!=': return value !== condition.value;
      default: return false;
    }
  }

  if (isTraitCondition(condition)) {
    const hasTrait = character.traits.includes(condition.trait);
    const shouldHave = condition.has !== false; // defaults to true
    return hasTrait === shouldHave;
  }

  return false;
}

/**
 * Check if a choice is available to a character
 */
export function isChoiceAvailable(choice: Choice, character: Character): boolean {
  if (!choice.available) {
    return true;
  }

  const { requires, chance } = choice.available;

  // Check random chance first
  if (chance !== undefined) {
    if (Math.random() > chance) {
      return false;
    }
  }

  // Check requirements
  if (requires) {
    if (!evaluateCondition(requires as Condition, character)) {
      return false;
    }
  }

  return true;
}

/**
 * Determine which outcome applies for a choice
 * Returns the first matching outcome's next scenario ID
 */
export function resolveOutcome(outcomes: Outcome[], character: Character): string | null {
  for (const outcome of outcomes) {
    if (evaluateCondition(outcome.condition, character)) {
      return outcome.next;
    }
  }
  return null;
}

/**
 * Get all available choices for a character in a scenario
 */
export function getAvailableChoices(choices: Choice[], character: Character): Choice[] {
  return choices.filter(choice => isChoiceAvailable(choice, character));
}

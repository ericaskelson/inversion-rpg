import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Scenario, Character, Choice } from '../types/game';
import { getAvailableChoices, resolveOutcome } from '../engine/conditions';

interface ScenarioPlayerProps {
  scenario: Scenario;
  character: Character;
  onChoice: (nextScenarioId: string) => void;
  onRestart: () => void;
}

export function ScenarioPlayer({ scenario, character, onChoice, onRestart }: ScenarioPlayerProps) {
  const [availableChoices, setAvailableChoices] = useState<Choice[]>([]);

  useEffect(() => {
    // Recalculate available choices when scenario changes
    // Note: random availability is evaluated once per scenario load
    const choices = getAvailableChoices(scenario.choices, character);
    setAvailableChoices(choices);
  }, [scenario, character]);

  const handleChoice = (choice: Choice) => {
    const nextId = resolveOutcome(choice.outcomes, character);
    if (nextId) {
      onChoice(nextId);
    }
  };

  return (
    <div className="scenario-player">
      <div className="scenario-content">
        <ReactMarkdown>{scenario.content}</ReactMarkdown>
      </div>

      {scenario.isEnding ? (
        <div className="ending-screen">
          <button onClick={onRestart} className="restart-button">
            Play Again
          </button>
        </div>
      ) : (
        <div className="choices">
          {availableChoices.map((choice, index) => (
            <button
              key={index}
              onClick={() => handleChoice(choice)}
              className="choice-button"
            >
              {choice.text}
            </button>
          ))}
          {availableChoices.length === 0 && (
            <p className="no-choices">No available choices... (This shouldn't happen!)</p>
          )}
        </div>
      )}
    </div>
  );
}

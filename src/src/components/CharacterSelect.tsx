import type { Character } from '../types/game';

// Test characters for prototyping - will be replaced by character creator
export const TEST_CHARACTERS: Character[] = [
  {
    name: 'Gareth the Strong',
    attributes: { strength: 4, charisma: 2, cunning: 1 },
    traits: ['hot-headed'],
  },
  {
    name: 'Silvia Silvertongue',
    attributes: { strength: 1, charisma: 5, cunning: 3 },
    traits: ['silver-tongued'],
  },
  {
    name: 'Marcus the Clever',
    attributes: { strength: 2, charisma: 2, cunning: 4 },
    traits: [],
  },
  {
    name: 'Rage-Filled Brynn',
    attributes: { strength: 2, charisma: 1, cunning: 1 },
    traits: ['hot-headed'],
  },
];

interface CharacterSelectProps {
  onSelect: (character: Character) => void;
}

export function CharacterSelect({ onSelect }: CharacterSelectProps) {
  return (
    <div className="character-select">
      <h1>Choose Your Character</h1>
      <p className="subtitle">(Temporary test characters - character creator coming soon)</p>

      <div className="character-grid">
        {TEST_CHARACTERS.map((character, index) => (
          <button
            key={index}
            onClick={() => onSelect(character)}
            className="character-card"
          >
            <h2>{character.name}</h2>
            <div className="attributes">
              {Object.entries(character.attributes).map(([attr, value]) => (
                <div key={attr} className="attribute">
                  <span className="attr-name">{attr}</span>
                  <span className="attr-value">{value}</span>
                </div>
              ))}
            </div>
            {character.traits.length > 0 && (
              <div className="traits">
                {character.traits.map(trait => (
                  <span key={trait} className="trait">{trait}</span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

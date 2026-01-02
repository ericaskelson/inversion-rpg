import { useState } from 'react';
import type { AttributeId, Portrait } from '../types/game';

interface CharacterSummaryProps {
  name: string;
  fate: number;
  attributes: Record<AttributeId, number>;
  traits: string[];
  describeFate: (fate: number) => string;
  describeAttribute: (value: number) => string;
  portrait?: Portrait;
}

const ATTRIBUTE_NAMES: Record<AttributeId, string> = {
  strength: 'Strength',
  agility: 'Agility',
  endurance: 'Endurance',
  cunning: 'Cunning',
  charisma: 'Charisma',
  will: 'Will',
};

// Get difficulty description based on fate level
function getFateDifficultyDescription(fate: number): string {
  if (fate <= -5) return "Fate itself has forgotten you. Expect mundane struggles and humble beginnings.";
  if (fate <= -2) return "The stars look away. Your path begins with hardship, but destiny does not interfere.";
  if (fate <= 0) return "An ordinary life awaits. Neither blessed nor cursed, your challenges match your station.";
  if (fate <= 3) return "The threads of destiny stir. Greater trials await, but so do greater rewards.";
  if (fate <= 6) return "Heaven takes notice. Powerful forces will test your mettle from the start.";
  if (fate <= 10) return "Your name echoes in the halls of fate. Epic challenges will forge your legend—or break you.";
  return "The cosmos trembles at your potential. Only the most harrowing trials can measure your worth.";
}

export function CharacterSummary({
  name,
  fate,
  attributes,
  traits,
  describeFate,
  describeAttribute,
  portrait,
}: CharacterSummaryProps) {
  const [showLightbox, setShowLightbox] = useState(false);

  return (
    <div className="character-summary">
      {portrait && (
        <div className="summary-portrait" onClick={() => setShowLightbox(true)}>
          <img src={`/images/${portrait.image}`} alt={portrait.name} />
        </div>
      )}

      <h2>{name || 'Unnamed Character'}</h2>

      <div className={`fate-section ${fate >= 5 ? 'fate-high' : fate <= -2 ? 'fate-low' : ''}`}>
        <div className="fate-display">
          <span className="fate-label">Fate:</span>
          <span className={`fate-value ${fate > 0 ? 'positive' : fate < 0 ? 'negative' : ''}`}>
            {describeFate(fate)}
          </span>
          <span className="fate-number">({fate >= 0 ? '+' : ''}{fate})</span>
        </div>
        <p className="fate-description">{getFateDifficultyDescription(fate)}</p>
      </div>

      <div className="attributes-section">
        <h3>Attributes</h3>
        <div className="attributes-list">
          {(Object.entries(attributes) as [AttributeId, number][]).map(([attr, value]) => (
            <div key={attr} className="attribute-row">
              <span className="attribute-name">{ATTRIBUTE_NAMES[attr]}</span>
              <span className={`attribute-value ${value > 0 ? 'positive' : value < 0 ? 'negative' : ''}`}>
                {describeAttribute(value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="traits-section">
        <h3>Traits</h3>
        {traits.length > 0 ? (
          <div className="traits-list">
            {traits.map(trait => (
              <span key={trait} className="trait-tag">{trait}</span>
            ))}
          </div>
        ) : (
          <p className="no-traits">No traits yet</p>
        )}
      </div>

      {/* Portrait lightbox */}
      {showLightbox && portrait && (
        <div className="portrait-lightbox" onClick={() => setShowLightbox(false)}>
          <img src={`/images/${portrait.image}`} alt={portrait.name} />
        </div>
      )}
    </div>
  );
}

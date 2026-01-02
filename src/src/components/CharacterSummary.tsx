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

      <div className="fate-display">
        <span className="fate-label">Fate:</span>
        <span className={`fate-value ${fate > 0 ? 'positive' : fate < 0 ? 'negative' : ''}`}>
          {describeFate(fate)}
        </span>
        <span className="fate-number">({fate >= 0 ? '+' : ''}{fate})</span>
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

import { useState } from 'react';
import { getImageUrl } from '../utils/imagePath';
import type { CharacterBuilderState, CategoryConfig, CharacterOption, Portrait, AttributeId } from '../types/game';
import { describeFate, describeAttribute } from '../engine/characterBuilder';

interface CharacterReviewProps {
  state: CharacterBuilderState;
  categories: CategoryConfig[];
  portrait?: Portrait;
  onConfirm: () => void;
  onBack: () => void;
}

const ATTRIBUTE_NAMES: Record<AttributeId, string> = {
  strength: 'Strength',
  agility: 'Agility',
  endurance: 'Endurance',
  cunning: 'Cunning',
  charisma: 'Charisma',
  will: 'Will',
};

// Get fate tier for styling (matches CharacterSummary)
function getFateTier(fate: number): string {
  if (fate <= -2) return 'low';
  if (fate <= 4) return '';
  if (fate <= 9) return 'high';
  if (fate <= 15) return 'epic';
  if (fate <= 21) return 'legendary';
  return 'mythic';
}

// Get difficulty description based on fate level (matches CharacterSummary)
function getFateDifficultyDescription(fate: number): string {
  if (fate <= -5) return "Fate itself has forgotten you. Expect mundane struggles and humble beginnings.";
  if (fate <= -2) return "The stars look away. Your path begins with hardship, but destiny does not interfere.";
  if (fate <= 0) return "An ordinary life awaits. Neither blessed nor cursed, your challenges match your station.";
  if (fate <= 3) return "The threads of destiny stir. Greater trials await, but so do greater rewards.";
  if (fate <= 6) return "Heaven takes notice. Powerful forces will test your mettle from the start.";
  if (fate <= 9) return "Your name echoes in the halls of fate. Epic challenges will forge your legend—or break you.";
  if (fate <= 12) return "The cosmos trembles at your potential. Only the most harrowing trials can measure your worth.";
  if (fate <= 15) return "Prophecies speak your name. Ancient evils stir, drawn to the blinding light of your destiny.";
  if (fate <= 18) return "Gods and demons alike turn their gaze upon you. Your very existence reshapes the weave of fate.";
  if (fate <= 21) return "Reality itself bends around your legend. You are the fulcrum upon which worlds will turn.";
  if (fate <= 24) return "The heavens war over your soul. Your path will echo through eternity—in glory or ruin.";
  return "You have become a force of nature, a living myth. The universe holds its breath at your every step.";
}

// Get selected options for a category
function getSelectedOptionsForCategory(
  category: CategoryConfig,
  selections: string[]
): CharacterOption[] {
  return selections
    .map(id => category.options.find(opt => opt.id === id))
    .filter((opt): opt is CharacterOption => opt !== undefined);
}

// Track tooltip state with position
interface TooltipState {
  option: CharacterOption;
  x: number;
  y: number;
}

export function CharacterReview({
  state,
  categories,
  portrait,
  onConfirm,
  onBack,
}: CharacterReviewProps) {
  const { name, calculatedFate, calculatedAttributes, calculatedTraits, selections } = state;
  const [tooltipState, setTooltipState] = useState<TooltipState | null>(null);

  const handleOptionClick = (option: CharacterOption, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tooltipState?.option.id === option.id) {
      setTooltipState(null);
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setTooltipState({
        option,
        x: rect.left + rect.width / 2,
        y: rect.bottom + 10,
      });
    }
  };

  const handleOptionHover = (option: CharacterOption, e: React.MouseEvent) => {
    // On hover, show tooltip (unless clicking locked one open)
    if (!tooltipState || tooltipState.option.id !== option.id) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setTooltipState({
        option,
        x: rect.left + rect.width / 2,
        y: rect.bottom + 10,
      });
    }
  };

  const handleOptionLeave = () => {
    // Only close on mouse leave if not click-locked
    // For simplicity, always close on leave (click will reopen)
    setTooltipState(null);
  };

  const handleBackgroundClick = () => {
    setTooltipState(null);
  };

  return (
    <div className="character-review" onClick={handleBackgroundClick}>
      <header className="review-header">
        <h1>Review Your Character</h1>
        <p className="review-subtitle">
          Confirm your choices before embarking on your adventure
        </p>
      </header>

      <div className="review-content">
        {/* Character overview panel */}
        <div className="review-overview">
          {portrait && (
            <div className="review-portrait">
              <img src={getImageUrl(portrait.image)} alt={name} />
            </div>
          )}

          <div className="review-identity">
            <h2 className="review-name">{name}</h2>
            <div className={`fate-section ${getFateTier(calculatedFate) ? `fate-${getFateTier(calculatedFate)}` : ''}`}>
              <div className="fate-display">
                <span className="fate-label">Fate:</span>
                <span className={`fate-value ${calculatedFate > 0 ? 'positive' : calculatedFate < 0 ? 'negative' : ''}`}>
                  {describeFate(calculatedFate)}
                </span>
                <span className="fate-number">({calculatedFate >= 0 ? '+' : ''}{calculatedFate})</span>
              </div>
              <p className="fate-description">{getFateDifficultyDescription(calculatedFate)}</p>
            </div>
          </div>

          <div className="review-attributes">
            <h3>Attributes</h3>
            <div className="attributes-grid">
              {(Object.entries(calculatedAttributes) as [AttributeId, number][]).map(([attr, value]) => (
                <div key={attr} className="attr-item">
                  <span className="attr-name">{ATTRIBUTE_NAMES[attr]}</span>
                  <span className={`attr-value ${value > 0 ? 'positive' : value < 0 ? 'negative' : ''}`}>
                    {describeAttribute(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {calculatedTraits.length > 0 && (
            <div className="review-traits">
              <h3>Traits</h3>
              <div className="traits-list">
                {calculatedTraits.map(trait => (
                  <span key={trait} className="trait-tag">{trait}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Selected options by category */}
        <div className="review-selections">
          <h3>Your Choices</h3>
          <div className="review-categories-grid">
          {categories.map(category => {
            // Skip appearance category (handled separately via portrait)
            if (category.id === 'appearance') return null;

            const selectedIds = selections[category.id] || [];
            if (selectedIds.length === 0) return null;

            const selectedOptions = getSelectedOptionsForCategory(category, selectedIds);

            return (
              <div key={category.id} className="review-category">
                <h4>{category.name}</h4>
                <div className="review-options">
                  {selectedOptions.map(option => (
                    <div
                      key={option.id}
                      className={`review-option ${option.isDrawback ? 'drawback' : ''} ${tooltipState?.option.id === option.id ? 'tooltip-active' : ''}`}
                      onClick={(e) => handleOptionClick(option, e)}
                      onMouseEnter={(e) => handleOptionHover(option, e)}
                      onMouseLeave={handleOptionLeave}
                    >
                      {option.image && (
                        <img
                          src={getImageUrl(`options/${option.image}`)}
                          alt={option.name}
                          className="review-option-image"
                        />
                      )}
                      <div className="review-option-info">
                        <span className="review-option-name">{option.name}</span>
                        {option.fate !== undefined && option.fate !== 0 && (
                          <span className={`fate-badge ${option.fate > 0 ? 'positive' : 'negative'}`}>
                            {option.fate > 0 ? '+' : ''}{option.fate}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>

      <div className="review-actions">
        <button className="review-back-btn" onClick={onBack}>
          Go Back
        </button>
        <button className="review-confirm-btn" onClick={onConfirm}>
          Begin Adventure
        </button>
      </div>

      {/* Fixed-position tooltip overlay - rendered outside the column flow */}
      {tooltipState && (
        <div
          className="review-option-tooltip"
          style={{
            left: `${tooltipState.x}px`,
            top: `${tooltipState.y}px`,
            transform: 'translateX(-50%)',
          }}
        >
          {tooltipState.option.image && (
            <img
              src={getImageUrl(`options/${tooltipState.option.image}`)}
              alt={tooltipState.option.name}
              className="tooltip-image"
            />
          )}
          <h4 className="tooltip-name">{tooltipState.option.name}</h4>
          <p className="tooltip-description">{tooltipState.option.description}</p>
          {tooltipState.option.attributes && Object.keys(tooltipState.option.attributes).length > 0 && (
            <div className="tooltip-attributes">
              {(Object.entries(tooltipState.option.attributes) as [AttributeId, number][]).map(([attr, value]) => (
                <span key={attr} className={`tooltip-attr ${value > 0 ? 'positive' : 'negative'}`}>
                  {ATTRIBUTE_NAMES[attr]}: {value > 0 ? '+' : ''}{value}
                </span>
              ))}
            </div>
          )}
          {tooltipState.option.traits && tooltipState.option.traits.length > 0 && (
            <div className="tooltip-traits">
              {tooltipState.option.traits.map(trait => (
                <span key={trait} className="tooltip-trait">{trait}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

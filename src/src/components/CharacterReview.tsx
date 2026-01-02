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

// Get selected options for a category
function getSelectedOptionsForCategory(
  category: CategoryConfig,
  selections: string[]
): CharacterOption[] {
  return selections
    .map(id => category.options.find(opt => opt.id === id))
    .filter((opt): opt is CharacterOption => opt !== undefined);
}

export function CharacterReview({
  state,
  categories,
  portrait,
  onConfirm,
  onBack,
}: CharacterReviewProps) {
  const { name, calculatedFate, calculatedAttributes, calculatedTraits, selections } = state;

  return (
    <div className="character-review">
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
              <img src={`/images/${portrait.image}`} alt={name} />
            </div>
          )}

          <div className="review-identity">
            <h2 className="review-name">{name}</h2>
            <div className={`review-fate ${calculatedFate >= 5 ? 'high' : calculatedFate <= -2 ? 'low' : ''}`}>
              <span className="fate-label">Fate:</span>
              <span className={`fate-value ${calculatedFate > 0 ? 'positive' : calculatedFate < 0 ? 'negative' : ''}`}>
                {describeFate(calculatedFate)}
              </span>
              <span className="fate-number">({calculatedFate >= 0 ? '+' : ''}{calculatedFate})</span>
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
          {categories.map(category => {
            const selectedIds = selections[category.id] || [];
            if (selectedIds.length === 0 && category.id !== 'appearance') return null;

            const selectedOptions = getSelectedOptionsForCategory(category, selectedIds);

            return (
              <div key={category.id} className="review-category">
                <h4>{category.name}</h4>
                <div className="review-options">
                  {selectedOptions.map(option => (
                    <div key={option.id} className={`review-option ${option.isDrawback ? 'drawback' : ''}`}>
                      {option.image && (
                        <img
                          src={`/images/options/${option.image}`}
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

      <div className="review-actions">
        <button className="review-back-btn" onClick={onBack}>
          Go Back
        </button>
        <button className="review-confirm-btn" onClick={onConfirm}>
          Begin Adventure
        </button>
      </div>
    </div>
  );
}

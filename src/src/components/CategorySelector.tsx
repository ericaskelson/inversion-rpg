import type { CategoryConfig, CharacterOption, CharacterBuilderState } from '../types/game';

interface CategorySelectorProps {
  category: CategoryConfig;
  state: CharacterBuilderState;
  onToggle: (optionId: string, category: CategoryConfig) => void;
  isOptionAvailable: (option: CharacterOption) => boolean;
  isOptionSelected: (optionId: string) => boolean;
}

export function CategorySelector({
  category,
  state,
  onToggle,
  isOptionAvailable,
  isOptionSelected,
}: CategorySelectorProps) {
  const selectedCount = (state.selections[category.id] || []).length;

  return (
    <div className="category-selector">
      <div className="category-header">
        <h2>{category.name}</h2>
        <p className="category-description">{category.description}</p>
        <p className="pick-count">
          Selected: {selectedCount} / {category.maxPicks}
          {category.minPicks > 0 && ` (min: ${category.minPicks})`}
        </p>
      </div>

      <div className="options-grid">
        {category.options.map(option => {
          const available = isOptionAvailable(option);
          const selected = isOptionSelected(option.id);
          const canSelect = available && (selected || selectedCount < category.maxPicks);

          return (
            <button
              key={option.id}
              onClick={() => canSelect && onToggle(option.id, category)}
              disabled={!canSelect}
              className={`option-card ${selected ? 'selected' : ''} ${
                option.isDrawback ? 'drawback' : ''
              } ${!available ? 'unavailable' : ''}`}
            >
              <h3 className="option-name">
                {option.name}
                {option.fate !== undefined && option.fate !== 0 && (
                  <span className={`fate-badge ${option.fate > 0 ? 'positive' : 'negative'}`}>
                    {option.fate > 0 ? '+' : ''}{option.fate}
                  </span>
                )}
              </h3>
              <p className="option-description">{option.description}</p>

              {/* Show what this option provides */}
              <div className="option-effects">
                {option.attributes && Object.entries(option.attributes).length > 0 && (
                  <div className="effect-row">
                    {Object.entries(option.attributes).map(([attr, value]) => (
                      <span
                        key={attr}
                        className={`attr-mod ${value > 0 ? 'positive' : 'negative'}`}
                      >
                        {attr.slice(0, 3).toUpperCase()} {value > 0 ? '+' : ''}{value}
                      </span>
                    ))}
                  </div>
                )}
                {option.traits && option.traits.length > 0 && (
                  <div className="effect-row traits">
                    {option.traits.slice(0, 3).map(trait => (
                      <span key={trait} className="trait-badge">{trait}</span>
                    ))}
                    {option.traits.length > 3 && (
                      <span className="trait-badge more">+{option.traits.length - 3}</span>
                    )}
                  </div>
                )}
              </div>

              {!available && (
                <div className="unavailable-overlay">
                  <span>Requires prerequisites</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import type { CategoryConfig, CharacterOption, CharacterBuilderState } from '../types/game';

interface CategorySelectorProps {
  category: CategoryConfig;
  state: CharacterBuilderState;
  onToggle: (optionId: string, category: CategoryConfig) => void;
  isOptionAvailable: (option: CharacterOption) => boolean;
  isOptionSelected: (optionId: string) => boolean;
}

// Group options by subcategory
function groupBySubcategory(options: CharacterOption[]): Map<string | null, CharacterOption[]> {
  const groups = new Map<string | null, CharacterOption[]>();

  for (const option of options) {
    const key = option.subcategory ?? null;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(option);
  }

  return groups;
}

interface OptionCardProps {
  option: CharacterOption;
  selected: boolean;
  available: boolean;
  canSelect: boolean;
  onToggle: () => void;
}

function OptionCard({ option, selected, available, canSelect, onToggle }: OptionCardProps) {
  const imageUrl = option.image ? `/images/options/${option.image}` : null;

  return (
    <button
      onClick={() => canSelect && onToggle()}
      disabled={!canSelect}
      className={`option-card ${selected ? 'selected' : ''} ${
        option.isDrawback ? 'drawback' : ''
      } ${!available ? 'unavailable' : ''} ${imageUrl ? 'has-image' : ''}`}
      style={imageUrl ? { '--option-bg-image': `url(${imageUrl})` } as React.CSSProperties : undefined}
    >
      <div className="option-card-content">
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
      </div>

      {!available && (
        <div className="unavailable-overlay">
          <span>Requires prerequisites</span>
        </div>
      )}
    </button>
  );
}

export function CategorySelector({
  category,
  state,
  onToggle,
  isOptionAvailable,
  isOptionSelected,
}: CategorySelectorProps) {
  const selectedCount = (state.selections[category.id] || []).length;

  // Group options by subcategory
  const groupedOptions = useMemo(
    () => groupBySubcategory(category.options),
    [category.options]
  );

  // Check if we have any subcategories
  const hasSubcategories = groupedOptions.size > 1 || !groupedOptions.has(null);

  const renderOptions = (options: CharacterOption[]) => (
    <div className="options-grid">
      {options.map(option => {
        const available = isOptionAvailable(option);
        const selected = isOptionSelected(option.id);
        const canSelect = available && (selected || selectedCount < category.maxPicks);

        return (
          <OptionCard
            key={option.id}
            option={option}
            selected={selected}
            available={available}
            canSelect={canSelect}
            onToggle={() => onToggle(option.id, category)}
          />
        );
      })}
    </div>
  );

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

      {hasSubcategories ? (
        // Render with subcategory groupings
        <div className="subcategory-groups">
          {Array.from(groupedOptions.entries()).map(([subcategory, options]) => (
            <div key={subcategory ?? 'ungrouped'} className="subcategory-group">
              {subcategory && (
                <h3 className="subcategory-heading">{subcategory}</h3>
              )}
              {renderOptions(options)}
            </div>
          ))}
        </div>
      ) : (
        // Render flat (no subcategories)
        renderOptions(category.options)
      )}
    </div>
  );
}

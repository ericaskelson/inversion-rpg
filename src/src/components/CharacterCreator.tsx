import { useState, useCallback } from 'react';
import type { Character, CategoryConfig, CharacterBuilderState } from '../types/game';
import { characterCreationData } from '../data/characterCreation';
import {
  createInitialBuilderState,
  toggleOption,
  isOptionAvailable,
  isOptionSelected,
  isCategoryComplete,
  isCharacterComplete,
  buildCharacter,
  describeFate,
  describeAttribute,
} from '../engine/characterBuilder';
import { CategorySelector } from './CategorySelector';
import { CharacterSummary } from './CharacterSummary';

interface CharacterCreatorProps {
  onComplete: (character: Character) => void;
}

export function CharacterCreator({ onComplete }: CharacterCreatorProps) {
  const [state, setState] = useState<CharacterBuilderState>(createInitialBuilderState);
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);

  const categories = characterCreationData.categories;
  const currentCategory = categories[currentCategoryIndex];

  const handleToggleOption = useCallback((optionId: string, category: CategoryConfig) => {
    setState(prev => toggleOption(optionId, category, prev, characterCreationData));
  }, []);

  const handleNameChange = useCallback((name: string) => {
    setState(prev => ({ ...prev, name }));
  }, []);

  const handlePrevCategory = () => {
    if (currentCategoryIndex > 0) {
      setCurrentCategoryIndex(prev => prev - 1);
    }
  };

  const handleNextCategory = () => {
    if (currentCategoryIndex < categories.length - 1) {
      setCurrentCategoryIndex(prev => prev + 1);
    }
  };

  const handleFinish = () => {
    if (isCharacterComplete(characterCreationData, state)) {
      const character = buildCharacter(state);
      onComplete(character);
    }
  };

  const canGoNext = isCategoryComplete(currentCategory, state);
  const isLastCategory = currentCategoryIndex === categories.length - 1;
  const canFinish = isCharacterComplete(characterCreationData, state);

  return (
    <div className="character-creator">
      <header className="creator-header">
        <h1>Create Your Character</h1>
        <div className="name-input-container">
          <label htmlFor="character-name">Name:</label>
          <input
            id="character-name"
            type="text"
            value={state.name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Enter character name..."
            className="name-input"
          />
        </div>
      </header>

      <div className="creator-layout">
        <div className="creator-main">
          <nav className="category-nav">
            {categories.map((cat, index) => (
              <button
                key={cat.id}
                onClick={() => setCurrentCategoryIndex(index)}
                className={`category-tab ${index === currentCategoryIndex ? 'active' : ''} ${
                  isCategoryComplete(cat, state) ? 'complete' : ''
                }`}
              >
                {cat.name}
                {isCategoryComplete(cat, state) && <span className="check">✓</span>}
              </button>
            ))}
          </nav>

          <CategorySelector
            category={currentCategory}
            state={state}
            onToggle={handleToggleOption}
            isOptionAvailable={(opt) => isOptionAvailable(opt, currentCategory, state)}
            isOptionSelected={(optId) => isOptionSelected(optId, currentCategory.id, state)}
          />

          <div className="creator-navigation">
            <button
              onClick={handlePrevCategory}
              disabled={currentCategoryIndex === 0}
              className="nav-button"
            >
              ← Previous
            </button>

            {!isLastCategory ? (
              <button
                onClick={handleNextCategory}
                disabled={!canGoNext}
                className="nav-button primary"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={!canFinish}
                className="nav-button finish"
              >
                Begin Adventure
              </button>
            )}
          </div>
        </div>

        <aside className="creator-sidebar">
          <CharacterSummary
            name={state.name}
            fate={state.calculatedFate}
            attributes={state.calculatedAttributes}
            traits={state.calculatedTraits}
            describeFate={describeFate}
            describeAttribute={describeAttribute}
          />
        </aside>
      </div>
    </div>
  );
}

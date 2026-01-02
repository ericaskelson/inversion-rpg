import { useState, useCallback } from 'react';
import type { Character, CategoryConfig, CharacterBuilderState, AppearanceSelections } from '../types/game';
import { characterCreationData as initialData } from '../data/characterCreation';
import { appearanceConfig } from '../data/appearanceConfig';
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
  updateAppearanceSelections,
} from '../engine/characterBuilder';
import { CategorySelector } from './CategorySelector';
import { CharacterSummary } from './CharacterSummary';
import { AppearanceSelector } from './AppearanceSelector';
import { OptionEditorModal } from './OptionEditorModal';
import { AppearanceEditorModal } from './AppearanceEditorModal';
import { EditModeProvider, useEditMode } from '../contexts/EditModeContext';

interface CharacterCreatorProps {
  onComplete: (character: Character) => void;
}

function CharacterCreatorInner({ onComplete }: CharacterCreatorProps) {
  const { editMode, editorAvailable, toggleEditMode, characterData, appearanceData } = useEditMode();
  const [state, setState] = useState<CharacterBuilderState>(createInitialBuilderState);
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);

  // Use data from context (allows live editing)
  const categories = characterData?.categories ?? initialData.categories;
  const currentCategory = categories[currentCategoryIndex];

  // Determine character sex and race from selections
  const characterSex = (state.selections.sex?.[0] === 'female' ? 'female' : 'male') as 'male' | 'female';
  const characterRace = state.selections.race?.[0] ?? 'human';

  const handleToggleOption = useCallback((optionId: string, category: CategoryConfig) => {
    // Use the live data from context
    const data = { categories };
    setState(prev => toggleOption(optionId, category, prev, data));
  }, [categories]);

  const handleNameChange = useCallback((name: string) => {
    setState(prev => ({ ...prev, name }));
  }, []);

  // Use live appearance data from context if available
  const liveAppearanceConfig = appearanceData ?? appearanceConfig;

  // Look up the selected portrait
  const selectedPortrait = state.appearanceSelections.portraitId
    ? liveAppearanceConfig.portraits.find(p => p.id === state.appearanceSelections.portraitId)
    : undefined;

  const handleAppearanceUpdate = useCallback((selections: AppearanceSelections) => {
    setState(prev => updateAppearanceSelections(selections, prev, liveAppearanceConfig));
  }, [liveAppearanceConfig]);

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
    const data = { categories };
    if (isCharacterComplete(data, state)) {
      const character = buildCharacter(state);
      onComplete(character);
    }
  };

  const canGoNext = isCategoryComplete(currentCategory, state);
  const isLastCategory = currentCategoryIndex === categories.length - 1;
  const canFinish = isCharacterComplete({ categories }, state);

  // Check if current category is appearance (uses special selector)
  const isAppearanceCategory = currentCategory.id === 'appearance';

  return (
    <div className="character-creator">
      <header className="creator-header">
        <h1>Create Your Character</h1>
        <div className="header-controls">
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
          {editorAvailable && (
            <button
              className={`edit-mode-toggle ${editMode ? 'active' : ''}`}
              onClick={toggleEditMode}
            >
              Edit Mode: {editMode ? 'ON' : 'OFF'}
            </button>
          )}
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

          {isAppearanceCategory ? (
            <AppearanceSelector
              config={liveAppearanceConfig}
              selections={state.appearanceSelections}
              characterSex={characterSex}
              characterRace={characterRace}
              onUpdate={handleAppearanceUpdate}
            />
          ) : (
            <CategorySelector
              category={currentCategory}
              state={state}
              onToggle={handleToggleOption}
              isOptionAvailable={(opt) => isOptionAvailable(opt, currentCategory, state)}
              isOptionSelected={(optId) => isOptionSelected(optId, currentCategory.id, state)}
            />
          )}

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
                disabled={!canGoNext && !editMode}
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
            portrait={selectedPortrait}
          />
        </aside>
      </div>

      <OptionEditorModal />
      <AppearanceEditorModal />
    </div>
  );
}

export function CharacterCreator({ onComplete }: CharacterCreatorProps) {
  return (
    <EditModeProvider initialData={initialData} initialAppearanceData={appearanceConfig}>
      <CharacterCreatorInner onComplete={onComplete} />
    </EditModeProvider>
  );
}

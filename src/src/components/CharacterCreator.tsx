import { useState, useCallback, useEffect, useRef } from 'react';
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
import { NameSelector } from './NameSelector';
import { CharacterReview } from './CharacterReview';
import { OptionEditorModal } from './OptionEditorModal';
import { AppearanceEditorModal } from './AppearanceEditorModal';
import OptionImageManager from './OptionImageManager';
import { EditModeProvider, useEditMode } from '../contexts/EditModeContext';

// Preload an image and return a promise
function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // Don't fail on missing images
    img.src = src;
  });
}

// Preload multiple images with optional concurrency limit
async function preloadImages(srcs: string[], concurrency = 4): Promise<void> {
  const queue = [...srcs];
  const workers = Array(Math.min(concurrency, queue.length)).fill(null).map(async () => {
    while (queue.length > 0) {
      const src = queue.shift();
      if (src) await preloadImage(src);
    }
  });
  await Promise.all(workers);
}

interface CharacterCreatorProps {
  onComplete: (character: Character) => void;
}

function CharacterCreatorInner({ onComplete }: CharacterCreatorProps) {
  const { editMode, editorAvailable, toggleEditMode, characterData, appearanceData } = useEditMode();
  const [state, setState] = useState<CharacterBuilderState>(createInitialBuilderState);
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [showOptionImageManager, setShowOptionImageManager] = useState(false);
  const [showReview, setShowReview] = useState(false);

  // Track which categories have been preloaded
  const preloadedCategories = useRef<Set<number>>(new Set());
  const allImagesPreloaded = useRef(false);

  // Use data from context (allows live editing)
  const categories = characterData?.categories ?? initialData.categories;

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
    if (currentCategoryIndex < totalTabs - 1) {
      setCurrentCategoryIndex(prev => prev + 1);
    }
  };

  const handleFinish = () => {
    const data = { categories };
    if (isCharacterComplete(data, state)) {
      setShowReview(true);
    }
  };

  const handleConfirmAdventure = () => {
    const character = buildCharacter(state);
    onComplete(character);
  };

  const handleBackFromReview = () => {
    setShowReview(false);
  };

  // Total tabs = categories + 1 for Name tab
  const totalTabs = categories.length + 1;
  const isNameTab = currentCategoryIndex === categories.length;
  const isLastTab = currentCategoryIndex === totalTabs - 1;

  // For regular categories
  const currentCategory = !isNameTab ? categories[currentCategoryIndex] : null;
  const canGoNext = isNameTab
    ? state.name.trim().length > 0  // Name tab is complete if name is set
    : currentCategory
      ? isCategoryComplete(currentCategory, state)
      : false;
  const canFinish = isCharacterComplete({ categories }, state) && state.name.trim().length > 0;

  // Check if current category is appearance (uses special selector)
  const isAppearanceCategory = currentCategory?.id === 'appearance';

  // Helper to get image URLs for a category
  const getCategoryImageUrls = useCallback((categoryIndex: number): string[] => {
    const cat = categories[categoryIndex];
    if (!cat) return [];

    // For appearance category, preload portrait images
    if (cat.id === 'appearance') {
      return liveAppearanceConfig.portraits
        .filter(p => p.image)
        .map(p => `/images/${p.image}`);
    }

    // For regular categories, preload option images
    return cat.options
      .filter(opt => opt.image)
      .map(opt => `/images/options/${opt.image}`);
  }, [categories, liveAppearanceConfig]);

  // Preload adjacent categories when current category changes
  useEffect(() => {
    const indicesToPreload = [
      currentCategoryIndex - 1,
      currentCategoryIndex,
      currentCategoryIndex + 1,
    ].filter(i => i >= 0 && i < categories.length);

    for (const index of indicesToPreload) {
      if (!preloadedCategories.current.has(index)) {
        preloadedCategories.current.add(index);
        const urls = getCategoryImageUrls(index);
        if (urls.length > 0) {
          preloadImages(urls, 6); // Higher concurrency for adjacent categories
        }
      }
    }
  }, [currentCategoryIndex, categories.length, getCategoryImageUrls]);

  // Preload all remaining images in the background after initial render
  useEffect(() => {
    if (allImagesPreloaded.current) return;
    allImagesPreloaded.current = true;

    // Delay background preloading to not compete with initial render
    const timer = setTimeout(() => {
      const allUrls: string[] = [];

      // Collect all option images
      for (let i = 0; i < categories.length; i++) {
        if (!preloadedCategories.current.has(i)) {
          allUrls.push(...getCategoryImageUrls(i));
        }
      }

      if (allUrls.length > 0) {
        preloadImages(allUrls, 2); // Lower concurrency for background loading
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [categories, getCategoryImageUrls]);

  // Show review page if in review mode
  if (showReview) {
    return (
      <div className="character-creator">
        <CharacterReview
          state={state}
          categories={categories}
          portrait={selectedPortrait}
          onConfirm={handleConfirmAdventure}
          onBack={handleBackFromReview}
        />
      </div>
    );
  }

  return (
    <div className="character-creator">
      <header className="creator-header">
        <h1>Create Your Character</h1>
        {editorAvailable && (
          <div className="header-controls">
            <div className="editor-controls">
              <button
                className={`edit-mode-toggle ${editMode ? 'active' : ''}`}
                onClick={toggleEditMode}
              >
                Edit Mode: {editMode ? 'ON' : 'OFF'}
              </button>
              {editMode && (
                <button
                  className={`option-images-btn ${showOptionImageManager ? 'active' : ''}`}
                  onClick={() => setShowOptionImageManager(!showOptionImageManager)}
                >
                  {showOptionImageManager ? '← Back to Creator' : 'Option Images'}
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {showOptionImageManager && editMode ? (
        <OptionImageManager categories={categories} />
      ) : (
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
              {/* Name tab - always last */}
              <button
                onClick={() => setCurrentCategoryIndex(categories.length)}
                className={`category-tab ${isNameTab ? 'active' : ''} ${
                  state.name.trim().length > 0 ? 'complete' : ''
                }`}
              >
                Name
                {state.name.trim().length > 0 && <span className="check">✓</span>}
              </button>
            </nav>

            {isNameTab ? (
              <NameSelector
                currentName={state.name}
                characterSex={characterSex}
                characterRace={characterRace}
                onNameSelect={handleNameChange}
              />
            ) : isAppearanceCategory ? (
              <AppearanceSelector
                config={liveAppearanceConfig}
                selections={state.appearanceSelections}
                characterSex={characterSex}
                characterRace={characterRace}
                onUpdate={handleAppearanceUpdate}
              />
            ) : currentCategory ? (
              <CategorySelector
                category={currentCategory}
                state={state}
                onToggle={handleToggleOption}
                isOptionAvailable={(opt) => isOptionAvailable(opt, currentCategory, state)}
                isOptionSelected={(optId) => isOptionSelected(optId, currentCategory.id, state)}
              />
            ) : null}

            <div className="creator-navigation">
              <button
                onClick={handlePrevCategory}
                disabled={currentCategoryIndex === 0}
                className="nav-button"
              >
                ← Previous
              </button>

              {!isLastTab ? (
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
      )}

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

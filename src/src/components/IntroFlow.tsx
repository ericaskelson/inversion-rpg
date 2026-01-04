import { useState, useMemo, useEffect, useCallback } from 'react';
import type { IntroConfig, StoryScreen as StoryScreenType } from '../types/game';
import { TitleScreen } from './TitleScreen';
import { StoryScreen } from './StoryScreen';
import { IntroEditorModal } from './IntroEditorModal';
import { isEditorAvailable, fetchIntroConfig, saveIntroConfig } from '../api/editorApi';
import { getImageUrl } from '../utils/imagePath';

// Preload an image and return a promise
function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // Don't fail on missing images
    img.src = src;
  });
}

// Preload multiple images concurrently
async function preloadImages(srcs: string[]): Promise<void> {
  await Promise.all(srcs.map(src => preloadImage(src)));
}

type IntroPhase =
  | { screen: 'title' }
  | { screen: 'story'; index: number };

type EditingTarget =
  | { type: 'title' }
  | { type: 'story'; screen: StoryScreenType }
  | { type: 'newStory' }
  | { type: 'settings' }
  | null;

interface IntroFlowProps {
  config: IntroConfig;
  onComplete: () => void;
  startAtEnd?: boolean;  // If true, start at the last story screen instead of title
}

export function IntroFlow({ config: initialConfig, onComplete, startAtEnd = false }: IntroFlowProps) {
  const [editorAvailable, setEditorAvailable] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [config, setConfig] = useState<IntroConfig>(initialConfig);
  const [editing, setEditing] = useState<EditingTarget>(null);

  // Sort story screens by order (needs to be computed before phase initialization)
  const sortedStoryScreens = useMemo(() => {
    return [...config.storyScreens].sort((a, b) => a.order - b.order);
  }, [config.storyScreens]);

  // Initialize phase - if startAtEnd, go to last story screen
  const [phase, setPhase] = useState<IntroPhase>(() => {
    if (startAtEnd && initialConfig.storyScreens.length > 0) {
      const sorted = [...initialConfig.storyScreens].sort((a, b) => a.order - b.order);
      return { screen: 'story', index: sorted.length - 1 };
    }
    return { screen: 'title' };
  });

  // Check if editor server is available on mount
  useEffect(() => {
    isEditorAvailable().then(async (available) => {
      setEditorAvailable(available);
      if (available) {
        try {
          const data = await fetchIntroConfig() as IntroConfig;
          setConfig(data);
        } catch (err) {
          console.error('Failed to fetch intro config:', err);
        }
      }
    });
  }, []);

  // Preload all intro background images when config changes
  useEffect(() => {
    const imagesToPreload: string[] = [];

    // Title screen background
    if (config.titleScreen.backgroundImage) {
      imagesToPreload.push(getImageUrl(config.titleScreen.backgroundImage));
    }

    // All story screen backgrounds
    for (const screen of config.storyScreens) {
      if (screen.backgroundImage) {
        imagesToPreload.push(getImageUrl(screen.backgroundImage));
      }
    }

    if (imagesToPreload.length > 0) {
      preloadImages(imagesToPreload);
    }
  }, [config]);

  const handleBegin = () => {
    if (sortedStoryScreens.length > 0) {
      setPhase({ screen: 'story', index: 0 });
    } else {
      onComplete();
    }
  };

  const handleNext = () => {
    if (phase.screen === 'story') {
      const nextIndex = phase.index + 1;
      if (nextIndex < sortedStoryScreens.length) {
        setPhase({ screen: 'story', index: nextIndex });
      } else {
        onComplete();
      }
    }
  };

  const handleBack = () => {
    if (phase.screen === 'story') {
      if (phase.index > 0) {
        setPhase({ screen: 'story', index: phase.index - 1 });
      } else {
        // Go back to title screen
        setPhase({ screen: 'title' });
      }
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const toggleEditMode = useCallback(() => {
    setEditMode(prev => !prev);
  }, []);

  // Edit handlers
  const handleEditTitle = () => setEditing({ type: 'title' });
  const handleEditStory = (screen: StoryScreenType) => setEditing({ type: 'story', screen });
  const handleAddStory = () => setEditing({ type: 'newStory' });
  const handleEditSettings = () => setEditing({ type: 'settings' });
  const handleCancelEdit = () => setEditing(null);

  const handleSaveConfig = async (updatedConfig: IntroConfig) => {
    await saveIntroConfig(updatedConfig);
    setConfig(updatedConfig);
    setEditing(null);
  };

  const handleDeleteStory = async (screenId: string) => {
    const updatedConfig = {
      ...config,
      storyScreens: config.storyScreens.filter(s => s.id !== screenId),
    };
    await saveIntroConfig(updatedConfig);
    setConfig(updatedConfig);
    setEditing(null);
    // If we deleted the current screen, go back to title
    if (phase.screen === 'story') {
      const newScreens = updatedConfig.storyScreens.sort((a, b) => a.order - b.order);
      if (phase.index >= newScreens.length) {
        if (newScreens.length > 0) {
          setPhase({ screen: 'story', index: newScreens.length - 1 });
        } else {
          setPhase({ screen: 'title' });
        }
      }
    }
  };

  // Render header with edit mode toggle
  const renderHeader = () => {
    if (!editorAvailable) return null;

    return (
      <div className="intro-header">
        <div className="header-controls">
          <label className="edit-mode-toggle">
            <input
              type="checkbox"
              checked={editMode}
              onChange={toggleEditMode}
            />
            <span>Edit Mode: {editMode ? 'ON' : 'OFF'}</span>
          </label>
          {editMode && (
            <button className="settings-button" onClick={handleEditSettings}>
              Settings
            </button>
          )}
        </div>
      </div>
    );
  };

  // Render edit overlay for current screen
  const renderEditOverlay = () => {
    if (!editMode) return null;

    if (phase.screen === 'title') {
      return (
        <div className="intro-edit-overlay">
          <button className="edit-button" onClick={handleEditTitle}>
            Edit Title Screen
          </button>
          {sortedStoryScreens.length === 0 && (
            <button className="add-button" onClick={handleAddStory}>
              Add Story Screen
            </button>
          )}
        </div>
      );
    }

    if (phase.screen === 'story') {
      const currentScreen = sortedStoryScreens[phase.index];
      return (
        <div className="intro-edit-overlay">
          <button className="edit-button" onClick={() => handleEditStory(currentScreen)}>
            Edit This Screen
          </button>
          <button className="add-button" onClick={handleAddStory}>
            Add Story Screen
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="intro-flow">
      {renderHeader()}

      {phase.screen === 'title' && (
        <TitleScreen
          config={config.titleScreen}
          settings={config.settings}
          onBegin={handleBegin}
          onSkip={handleSkip}
        />
      )}

      {phase.screen === 'story' && (
        <StoryScreen
          screen={sortedStoryScreens[phase.index]}
          settings={config.settings}
          currentIndex={phase.index}
          totalScreens={sortedStoryScreens.length}
          onNext={handleNext}
          onBack={handleBack}
          onSkip={handleSkip}
        />
      )}

      {renderEditOverlay()}

      {editing && (
        <IntroEditorModal
          config={config}
          editing={editing}
          onSave={handleSaveConfig}
          onDelete={editing.type === 'story' ? () => handleDeleteStory(editing.screen.id) : undefined}
          onCancel={handleCancelEdit}
        />
      )}
    </div>
  );
}

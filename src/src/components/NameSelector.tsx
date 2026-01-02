import { useState, useMemo, useCallback } from 'react';
import { namesConfig as staticNamesConfig } from '../data/namesConfig';
import { useEditMode } from '../contexts/EditModeContext';
import type { NamesConfig } from '../types/game';

interface NameSelectorProps {
  currentName: string;
  characterSex: 'male' | 'female';
  characterRace: string;
  onNameSelect: (name: string) => void;
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function NameSelector({
  currentName,
  characterSex,
  characterRace,
  onNameSelect,
}: NameSelectorProps) {
  const { editMode, namesData, addName, deleteName } = useEditMode();
  const [shuffleKey, setShuffleKey] = useState(0);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState('');
  const [newNameInput, setNewNameInput] = useState('');

  // Use live data from context if available, otherwise static
  const namesConfig: NamesConfig = namesData ?? staticNamesConfig;

  // Check if race has its own names or falls back to human
  const hasOwnNames = useMemo(() => {
    const sexNames = namesConfig.names[characterSex];
    if (!sexNames) return false;
    const raceNames = sexNames[characterRace];
    return raceNames && raceNames.length > 0;
  }, [namesConfig, characterSex, characterRace]);

  // Get names for current sex/race combo
  const availableNames = useMemo(() => {
    const sexNames = namesConfig.names[characterSex];
    if (!sexNames) return [];

    const raceNames = sexNames[characterRace];
    if (!raceNames || raceNames.length === 0) {
      // Fallback to human names if race not found
      return sexNames['human'] || [];
    }
    return raceNames;
  }, [namesConfig, characterSex, characterRace]);

  // Shuffle and take displayCount names (only used when not in edit mode)
  const displayedNames = useMemo(() => {
    if (editMode) return availableNames; // Show all in edit mode
    const shuffled = shuffleArray(availableNames);
    return shuffled.slice(0, namesConfig.displayCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableNames, shuffleKey, editMode, namesConfig.displayCount]);

  const handleShuffle = useCallback(() => {
    setShuffleKey(k => k + 1);
  }, []);

  const handleCustomSubmit = useCallback(() => {
    if (customName.trim()) {
      onNameSelect(customName.trim());
      setShowCustomInput(false);
      setCustomName('');
    }
  }, [customName, onNameSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCustomSubmit();
    } else if (e.key === 'Escape') {
      setShowCustomInput(false);
      setCustomName('');
    }
  }, [handleCustomSubmit]);

  const handleAddName = useCallback(async () => {
    if (newNameInput.trim() && addName) {
      await addName(characterSex, characterRace, newNameInput.trim());
      setNewNameInput('');
    }
  }, [newNameInput, addName, characterSex, characterRace]);

  const handleAddNameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddName();
    }
  }, [handleAddName]);

  const handleDeleteName = useCallback(async (name: string) => {
    if (deleteName && confirm(`Delete "${name}" from the name list?`)) {
      await deleteName(characterSex, characterRace, name);
    }
  }, [deleteName, characterSex, characterRace]);

  // Format race name for display
  const raceDisplay = characterRace.charAt(0).toUpperCase() + characterRace.slice(1);
  const sexDisplay = characterSex.charAt(0).toUpperCase() + characterSex.slice(1);

  return (
    <div className="name-selector">
      <div className="name-selector-header">
        <h2>{editMode ? 'Edit Names' : 'Choose Your Name'}</h2>
        <p className="name-selector-subtitle">
          {editMode ? (
            <>
              Managing names for <strong>{sexDisplay} {raceDisplay}</strong>
              {!hasOwnNames && (
                <span className="fallback-notice"> (using Human names as fallback)</span>
              )}
            </>
          ) : (
            `Select a name for your ${sexDisplay} ${raceDisplay} character`
          )}
        </p>
      </div>

      {!editMode && currentName && (
        <div className="current-name-display">
          <span className="current-name-label">Current Name:</span>
          <span className="current-name-value">{currentName}</span>
        </div>
      )}

      {editMode && (
        <div className="name-edit-controls">
          <div className="add-name-row">
            <input
              type="text"
              className="add-name-input"
              value={newNameInput}
              onChange={(e) => setNewNameInput(e.target.value)}
              onKeyDown={handleAddNameKeyDown}
              placeholder={`Add new ${sexDisplay} ${raceDisplay} name...`}
            />
            <button
              className="add-name-btn"
              onClick={handleAddName}
              disabled={!newNameInput.trim()}
            >
              + Add Name
            </button>
          </div>
          {!hasOwnNames && (
            <p className="create-list-hint">
              Adding a name will create a new name list for {raceDisplay} characters.
            </p>
          )}
        </div>
      )}

      <div className={`name-grid ${editMode ? 'edit-mode' : ''}`}>
        {displayedNames.map((name) => (
          <div key={name} className="name-chip-wrapper">
            <button
              className={`name-chip ${currentName === name ? 'selected' : ''}`}
              onClick={() => !editMode && onNameSelect(name)}
              disabled={editMode}
            >
              {name}
              {!editMode && currentName === name && <span className="name-check">✓</span>}
            </button>
            {editMode && (
              <button
                className="name-delete-btn"
                onClick={() => handleDeleteName(name)}
                title={`Delete ${name}`}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {!editMode && (
        <div className="name-actions">
          <button className="shuffle-btn" onClick={handleShuffle}>
            <span className="shuffle-icon">⟳</span> Show Different Names
          </button>

          {namesConfig.allowCustom && !showCustomInput && (
            <button
              className="custom-name-btn"
              onClick={() => setShowCustomInput(true)}
            >
              Enter Custom Name
            </button>
          )}
        </div>
      )}

      {!editMode && showCustomInput && (
        <div className="custom-name-input-container">
          <input
            type="text"
            className="custom-name-input"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your character's name..."
            autoFocus
          />
          <div className="custom-name-buttons">
            <button
              className="custom-name-confirm"
              onClick={handleCustomSubmit}
              disabled={!customName.trim()}
            >
              Use This Name
            </button>
            <button
              className="custom-name-cancel"
              onClick={() => {
                setShowCustomInput(false);
                setCustomName('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="name-hint">
        {availableNames.length} names available for {sexDisplay} {raceDisplay} characters
        {!hasOwnNames && !editMode && ' (from Human list)'}
      </p>
    </div>
  );
}

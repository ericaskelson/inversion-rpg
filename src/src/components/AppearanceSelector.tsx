import { useMemo, useState } from 'react';
import type {
  AppearanceConfig,
  AppearanceSelections,
  AppearanceOption,
  Portrait,
  BuildType,
  SkinTone,
  HairColor,
} from '../types/game';
import { useEditMode } from '../contexts/EditModeContext';
import { PortraitManager } from './PortraitManager';

type AppearanceStep = 'build' | 'skinTone' | 'hairColor' | 'portrait';
type AppearanceOptionType = 'build' | 'skinTone' | 'hairColor';

interface AppearanceSelectorProps {
  config: AppearanceConfig;
  selections: AppearanceSelections;
  characterSex: 'male' | 'female';
  characterRace: string;
  onUpdate: (selections: AppearanceSelections) => void;
}

interface StepIndicatorProps {
  currentStep: AppearanceStep;
  selections: AppearanceSelections;
  onStepClick: (step: AppearanceStep) => void;
  editMode: boolean;
}

const STEPS: { id: AppearanceStep; label: string }[] = [
  { id: 'build', label: 'Build' },
  { id: 'skinTone', label: 'Skin Tone' },
  { id: 'hairColor', label: 'Hair Color' },
  { id: 'portrait', label: 'Portrait' },
];

function StepIndicator({ currentStep, selections, onStepClick, editMode }: StepIndicatorProps) {
  const isStepComplete = (step: AppearanceStep): boolean => {
    switch (step) {
      case 'build': return !!selections.build;
      case 'skinTone': return !!selections.skinTone;
      case 'hairColor': return !!selections.hairColor;
      case 'portrait': return !!selections.portraitId;
    }
  };

  const isStepAccessible = (step: AppearanceStep): boolean => {
    if (editMode) return true; // All steps accessible in edit mode
    const stepIndex = STEPS.findIndex(s => s.id === step);
    if (stepIndex === 0) return true;
    for (let i = 0; i < stepIndex; i++) {
      if (!isStepComplete(STEPS[i].id)) return false;
    }
    return true;
  };

  return (
    <div className="appearance-steps">
      {STEPS.map((step, index) => {
        const complete = isStepComplete(step.id);
        const accessible = isStepAccessible(step.id);
        const active = currentStep === step.id;

        return (
          <button
            key={step.id}
            className={`appearance-step ${active ? 'active' : ''} ${complete ? 'complete' : ''} ${!accessible ? 'disabled' : ''}`}
            onClick={() => accessible && onStepClick(step.id)}
            disabled={!accessible}
          >
            <span className="step-number">{index + 1}</span>
            <span className="step-label">{step.label}</span>
            {complete && <span className="step-check">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

interface OptionGridProps<T extends string> {
  options: (AppearanceOption & { id: T })[];
  selectedId?: T;
  onSelect: (id: T) => void;
  editMode: boolean;
  optionType: AppearanceOptionType;
  onEdit: (option: AppearanceOption & { id: T }) => void;
  onDelete: (id: T) => void;
  onAdd: () => void;
}

function OptionGrid<T extends string>({
  options,
  selectedId,
  onSelect,
  editMode,
  optionType,
  onEdit,
  onDelete,
  onAdd,
}: OptionGridProps<T>) {
  const handleDelete = (id: T, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this option?')) {
      onDelete(id);
    }
  };

  return (
    <div className="appearance-options-grid">
      {options.map(option => (
        <div key={option.id} className={`option-card-wrapper ${editMode ? 'edit-mode' : ''}`}>
          <button
            className={`appearance-option ${selectedId === option.id ? 'selected' : ''}`}
            onClick={() => !editMode && onSelect(option.id)}
          >
            {option.image && (
              <div className="appearance-option-image">
                <img src={`/images/options/${option.image}`} alt={option.name} />
              </div>
            )}
            <div className="appearance-option-content">
              <h4 className="appearance-option-name">
                {option.name}
                {option.fate !== undefined && option.fate !== 0 && (
                  <span className={`fate-badge ${option.fate > 0 ? 'positive' : 'negative'}`}>
                    {option.fate > 0 ? '+' : ''}{option.fate}
                  </span>
                )}
              </h4>
              <p className="appearance-option-description">{option.description}</p>
              {option.traits && option.traits.length > 0 && (
                <div className="appearance-option-traits">
                  {option.traits.map(trait => (
                    <span key={trait} className="trait-badge">{trait}</span>
                  ))}
                </div>
              )}
            </div>
          </button>
          {editMode && (
            <div className="edit-buttons">
              <button className="edit-btn" onClick={() => onEdit(option)} title="Edit option">
                Edit
              </button>
              <button className="delete-btn" onClick={(e) => handleDelete(option.id, e)} title="Delete option">
                Del
              </button>
            </div>
          )}
        </div>
      ))}
      {editMode && (
        <button className="add-option-card" onClick={onAdd}>
          <span className="add-icon">+</span>
          <span>Add {optionType === 'build' ? 'Build' : optionType === 'skinTone' ? 'Skin Tone' : 'Hair Color'}</span>
        </button>
      )}
    </div>
  );
}

interface PortraitGridProps {
  portraits: Portrait[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

function PortraitGrid({ portraits, selectedId, onSelect }: PortraitGridProps) {
  if (portraits.length === 0) {
    return (
      <div className="no-portraits">
        <p>No portraits available for this combination yet.</p>
        <p className="no-portraits-hint">Portraits will be generated to match your selections.</p>
      </div>
    );
  }

  return (
    <div className="portrait-grid">
      {portraits.map(portrait => (
        <button
          key={portrait.id}
          className={`portrait-option ${selectedId === portrait.id ? 'selected' : ''}`}
          onClick={() => onSelect(portrait.id)}
        >
          <img src={`/images/${portrait.image}`} alt={portrait.name} />
        </button>
      ))}
    </div>
  );
}

export function AppearanceSelector({
  config,
  selections,
  characterSex,
  characterRace,
  onUpdate,
}: AppearanceSelectorProps) {
  const {
    editMode,
    appearanceData,
    startEditingAppearanceOption,
    startCreatingAppearanceOption,
    deleteAppearanceOption,
    refreshAppearanceConfig,
  } = useEditMode();

  // Use live data from context if available
  const liveConfig = appearanceData ?? config;

  // Track current step explicitly (allows navigating back without losing selections)
  const [currentStep, setCurrentStep] = useState<AppearanceStep>(() => {
    if (!selections.build) return 'build';
    if (!selections.skinTone) return 'skinTone';
    if (!selections.hairColor) return 'hairColor';
    return 'portrait';
  });

  // Filter portraits based on selections, sex, and race
  const filteredPortraits = useMemo(() => {
    if (!selections.build || !selections.skinTone || !selections.hairColor) {
      return [];
    }
    return liveConfig.portraits.filter(p =>
      p.sex === characterSex &&
      p.race === characterRace &&
      p.build === selections.build &&
      p.skinTone === selections.skinTone &&
      p.hairColor === selections.hairColor
    );
  }, [liveConfig.portraits, selections, characterSex, characterRace]);

  const handleStepClick = (step: AppearanceStep) => {
    setCurrentStep(step);
  };

  const handleBuildSelect = (id: BuildType) => {
    onUpdate({ ...selections, build: id });
    setCurrentStep('skinTone');
  };

  const handleSkinToneSelect = (id: SkinTone) => {
    onUpdate({ ...selections, skinTone: id });
    setCurrentStep('hairColor');
  };

  const handleHairColorSelect = (id: HairColor) => {
    onUpdate({ ...selections, hairColor: id });
    setCurrentStep('portrait');
  };

  const handlePortraitSelect = (id: string) => {
    onUpdate({ ...selections, portraitId: id });
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'build':
        return (
          <>
            <div className="appearance-step-header">
              <h3>Choose Your Build</h3>
              <p>Your physical frame affects your capabilities.</p>
            </div>
            <OptionGrid
              options={liveConfig.builds}
              selectedId={selections.build}
              onSelect={handleBuildSelect}
              editMode={editMode}
              optionType="build"
              onEdit={(opt) => startEditingAppearanceOption(opt, 'build')}
              onDelete={(id) => deleteAppearanceOption(id, 'build')}
              onAdd={() => startCreatingAppearanceOption('build')}
            />
          </>
        );

      case 'skinTone':
        return (
          <>
            <div className="appearance-step-header">
              <h3>Choose Your Skin Tone</h3>
              <p>The shade of your complexion.</p>
            </div>
            <OptionGrid
              options={liveConfig.skinTones}
              selectedId={selections.skinTone}
              onSelect={handleSkinToneSelect}
              editMode={editMode}
              optionType="skinTone"
              onEdit={(opt) => startEditingAppearanceOption(opt, 'skinTone')}
              onDelete={(id) => deleteAppearanceOption(id, 'skinTone')}
              onAdd={() => startCreatingAppearanceOption('skinTone')}
            />
          </>
        );

      case 'hairColor':
        return (
          <>
            <div className="appearance-step-header">
              <h3>Choose Your Hair Color</h3>
              <p>The color of your hair, if any.</p>
            </div>
            <OptionGrid
              options={liveConfig.hairColors}
              selectedId={selections.hairColor}
              onSelect={handleHairColorSelect}
              editMode={editMode}
              optionType="hairColor"
              onEdit={(opt) => startEditingAppearanceOption(opt, 'hairColor')}
              onDelete={(id) => deleteAppearanceOption(id, 'hairColor')}
              onAdd={() => startCreatingAppearanceOption('hairColor')}
            />
          </>
        );

      case 'portrait':
        return (
          <>
            <div className="appearance-step-header">
              <h3>Choose Your Portrait</h3>
              <p>
                Select a portrait that matches your vision.
                {filteredPortraits.length > 0 && ` (${filteredPortraits.length} available)`}
              </p>
            </div>
            {editMode ? (
              <PortraitManager onRefreshConfig={refreshAppearanceConfig} />
            ) : (
              <PortraitGrid
                portraits={filteredPortraits}
                selectedId={selections.portraitId}
                onSelect={handlePortraitSelect}
              />
            )}
          </>
        );
    }
  };

  // Summary of current selections
  const selectionSummary = useMemo(() => {
    const parts: string[] = [];
    if (selections.build) {
      const build = liveConfig.builds.find(b => b.id === selections.build);
      if (build) parts.push(build.name);
    }
    if (selections.skinTone) {
      const skin = liveConfig.skinTones.find(s => s.id === selections.skinTone);
      if (skin) parts.push(skin.name);
    }
    if (selections.hairColor) {
      const hair = liveConfig.hairColors.find(h => h.id === selections.hairColor);
      if (hair) parts.push(hair.name + ' hair');
    }
    return parts.join(', ');
  }, [selections, liveConfig]);

  return (
    <div className="appearance-selector">
      <StepIndicator
        currentStep={currentStep}
        selections={selections}
        onStepClick={handleStepClick}
        editMode={editMode}
      />

      {selectionSummary && (
        <div className="appearance-summary">
          <span className="summary-label">Current:</span>
          <span className="summary-value">{selectionSummary}</span>
        </div>
      )}

      <div className="appearance-step-content">
        {renderCurrentStep()}
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import type {
  AppearanceConfig,
  AppearanceSelections,
  AppearanceOption,
  Portrait,
  BuildType,
  SkinTone,
  HairColor,
} from '../types/game';

type AppearanceStep = 'build' | 'skinTone' | 'hairColor' | 'portrait';

interface AppearanceSelectorProps {
  config: AppearanceConfig;
  selections: AppearanceSelections;
  characterSex: 'male' | 'female';
  onUpdate: (selections: AppearanceSelections) => void;
}

interface StepIndicatorProps {
  currentStep: AppearanceStep;
  selections: AppearanceSelections;
  onStepClick: (step: AppearanceStep) => void;
}

const STEPS: { id: AppearanceStep; label: string }[] = [
  { id: 'build', label: 'Build' },
  { id: 'skinTone', label: 'Skin Tone' },
  { id: 'hairColor', label: 'Hair Color' },
  { id: 'portrait', label: 'Portrait' },
];

function StepIndicator({ currentStep, selections, onStepClick }: StepIndicatorProps) {
  const isStepComplete = (step: AppearanceStep): boolean => {
    switch (step) {
      case 'build': return !!selections.build;
      case 'skinTone': return !!selections.skinTone;
      case 'hairColor': return !!selections.hairColor;
      case 'portrait': return !!selections.portraitId;
    }
  };

  const isStepAccessible = (step: AppearanceStep): boolean => {
    const stepIndex = STEPS.findIndex(s => s.id === step);
    if (stepIndex === 0) return true;
    // Can access a step if all previous steps are complete
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
}

function OptionGrid<T extends string>({ options, selectedId, onSelect }: OptionGridProps<T>) {
  return (
    <div className="appearance-options-grid">
      {options.map(option => (
        <button
          key={option.id}
          className={`appearance-option ${selectedId === option.id ? 'selected' : ''}`}
          onClick={() => onSelect(option.id)}
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
      ))}
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
          <span className="portrait-name">{portrait.name}</span>
        </button>
      ))}
    </div>
  );
}

export function AppearanceSelector({
  config,
  selections,
  characterSex,
  onUpdate,
}: AppearanceSelectorProps) {
  // Determine current step based on what's selected
  const currentStep: AppearanceStep = useMemo(() => {
    if (!selections.build) return 'build';
    if (!selections.skinTone) return 'skinTone';
    if (!selections.hairColor) return 'hairColor';
    return 'portrait';
  }, [selections]);

  // Filter portraits based on selections and sex
  const filteredPortraits = useMemo(() => {
    if (!selections.build || !selections.skinTone || !selections.hairColor) {
      return [];
    }
    return config.portraits.filter(p =>
      p.sex === characterSex &&
      p.build === selections.build &&
      p.skinTone === selections.skinTone &&
      p.hairColor === selections.hairColor
    );
  }, [config.portraits, selections, characterSex]);

  const handleStepClick = (step: AppearanceStep) => {
    // Clear selections from this step forward
    const newSelections = { ...selections };
    const stepIndex = STEPS.findIndex(s => s.id === step);

    STEPS.slice(stepIndex).forEach(s => {
      switch (s.id) {
        case 'build': newSelections.build = undefined; break;
        case 'skinTone': newSelections.skinTone = undefined; break;
        case 'hairColor': newSelections.hairColor = undefined; break;
        case 'portrait': newSelections.portraitId = undefined; break;
      }
    });

    onUpdate(newSelections);
  };

  const handleBuildSelect = (id: BuildType) => {
    onUpdate({ ...selections, build: id, skinTone: undefined, hairColor: undefined, portraitId: undefined });
  };

  const handleSkinToneSelect = (id: SkinTone) => {
    onUpdate({ ...selections, skinTone: id, hairColor: undefined, portraitId: undefined });
  };

  const handleHairColorSelect = (id: HairColor) => {
    onUpdate({ ...selections, hairColor: id, portraitId: undefined });
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
              options={config.builds}
              selectedId={selections.build}
              onSelect={handleBuildSelect}
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
              options={config.skinTones}
              selectedId={selections.skinTone}
              onSelect={handleSkinToneSelect}
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
              options={config.hairColors}
              selectedId={selections.hairColor}
              onSelect={handleHairColorSelect}
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
            <PortraitGrid
              portraits={filteredPortraits}
              selectedId={selections.portraitId}
              onSelect={handlePortraitSelect}
            />
          </>
        );
    }
  };

  // Summary of current selections
  const selectionSummary = useMemo(() => {
    const parts: string[] = [];
    if (selections.build) {
      const build = config.builds.find(b => b.id === selections.build);
      if (build) parts.push(build.name);
    }
    if (selections.skinTone) {
      const skin = config.skinTones.find(s => s.id === selections.skinTone);
      if (skin) parts.push(skin.name);
    }
    if (selections.hairColor) {
      const hair = config.hairColors.find(h => h.id === selections.hairColor);
      if (hair) parts.push(hair.name + ' hair');
    }
    return parts.join(', ');
  }, [selections, config]);

  return (
    <div className="appearance-selector">
      <StepIndicator
        currentStep={currentStep}
        selections={selections}
        onStepClick={handleStepClick}
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

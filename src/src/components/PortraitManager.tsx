import { useState, useEffect, useMemo, useCallback } from 'react';
import { useEditMode } from '../contexts/EditModeContext';
import {
  generatePortraits,
  fetchPendingPortraits,
  fetchGenerationStatus,
  fetchRateLimits,
  acceptPortrait,
  rejectPortrait,
  acceptAllPortraits,
  rejectAllPortraits,
  saveAppearanceConfig,
  createBatchJob,
  fetchBatchJobs,
  fetchBatchJobStatus,
  importBatchResults,
  deleteBatchJob,
  type PendingPortrait,
  type GenerationStatus,
  type RateLimitInfo,
  type BatchJob,
  type PortraitCombination,
} from '../api/editorApi';

interface PortraitManagerProps {
  onRefreshConfig: () => void;
}

interface CheckboxGroupProps {
  label: string;
  options: { id: string; name: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  missingCount: number;
}

function CheckboxGroup({ label, options, selected, onToggle, missingCount }: CheckboxGroupProps) {
  const allSelected = options.every(opt => selected.has(opt.id));

  const toggleAll = () => {
    if (allSelected) {
      options.forEach(opt => {
        if (selected.has(opt.id)) onToggle(opt.id);
      });
    } else {
      options.forEach(opt => {
        if (!selected.has(opt.id)) onToggle(opt.id);
      });
    }
  };

  return (
    <div className="checkbox-group">
      <div className="checkbox-group-header">
        <label className="checkbox-group-label">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
          />
          <span>{label}</span>
        </label>
        <span className="missing-badge" title="Portraits missing for this category">
          {missingCount} missing
        </span>
      </div>
      <div className="checkbox-group-options">
        {options.map(opt => (
          <label key={opt.id} className="checkbox-option">
            <input
              type="checkbox"
              checked={selected.has(opt.id)}
              onChange={() => onToggle(opt.id)}
            />
            <span>{opt.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function PortraitManager({ onRefreshConfig }: PortraitManagerProps) {
  const { characterData, appearanceData } = useEditMode();

  // Selected options for generation
  const [selectedBuilds, setSelectedBuilds] = useState<Set<string>>(new Set());
  const [selectedSkinTones, setSelectedSkinTones] = useState<Set<string>>(new Set());
  const [selectedHairColors, setSelectedHairColors] = useState<Set<string>>(new Set());
  const [selectedSexes, setSelectedSexes] = useState<Set<string>>(new Set());
  const [selectedRaces, setSelectedRaces] = useState<Set<string>>(new Set());
  const [countPerCombination, setCountPerCombination] = useState(1);
  const [generateMissingOnly, setGenerateMissingOnly] = useState(true);

  // Generation state
  const [pendingPortraits, setPendingPortraits] = useState<PendingPortrait[]>([]);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lightbox state for viewing portraits larger
  const [lightboxPortrait, setLightboxPortrait] = useState<PendingPortrait | null>(null);

  // Prompt editing state
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [basePrompt, setBasePrompt] = useState('');
  const [styleModifiers, setStyleModifiers] = useState('');
  const [selectedModel, setSelectedModel] = useState('nano-banana-pro');
  const [promptSaving, setPromptSaving] = useState(false);

  // Preset management
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Rate limit tracking
  const [rateLimits, setRateLimits] = useState<RateLimitInfo | null>(null);

  // Batch jobs
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  // Initialize prompt state from config
  useEffect(() => {
    if (appearanceData?.portraitConfig) {
      setBasePrompt(appearanceData.portraitConfig.basePrompt || '');
      setStyleModifiers(appearanceData.portraitConfig.styleModifiers || '');
      setSelectedModel(appearanceData.portraitConfig.model || 'nano-banana-pro');
    }
  }, [appearanceData?.portraitConfig]);

  // Save prompt config
  const handleSavePrompt = async () => {
    if (!appearanceData) return;
    setPromptSaving(true);
    try {
      const updatedConfig = {
        ...appearanceData,
        portraitConfig: {
          ...appearanceData.portraitConfig,
          basePrompt,
          styleModifiers,
          model: selectedModel,
        },
      };
      await saveAppearanceConfig(updatedConfig);
      onRefreshConfig();
      setEditingPrompt(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save prompt');
    } finally {
      setPromptSaving(false);
    }
  };

  // Get presets from config
  const presets = useMemo(() =>
    appearanceData?.portraitConfig?.presets || [],
    [appearanceData?.portraitConfig?.presets]
  );

  // Load a preset
  const handleLoadPreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setBasePrompt(preset.basePrompt);
    }
  };

  // Save current prompt as a new preset
  const handleSaveAsPreset = async () => {
    if (!appearanceData || !newPresetName.trim()) return;
    setPromptSaving(true);
    try {
      const newPreset = {
        id: `preset-${Date.now()}`,
        name: newPresetName.trim(),
        basePrompt,
      };
      const updatedConfig = {
        ...appearanceData,
        portraitConfig: {
          ...appearanceData.portraitConfig,
          basePrompt,
          styleModifiers,
          model: selectedModel,
          presets: [...presets, newPreset],
        },
      };
      await saveAppearanceConfig(updatedConfig);
      onRefreshConfig();
      setShowSavePreset(false);
      setNewPresetName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preset');
    } finally {
      setPromptSaving(false);
    }
  };

  // Delete a preset
  const handleDeletePreset = async (presetId: string) => {
    if (!appearanceData) return;
    setPromptSaving(true);
    try {
      const updatedConfig = {
        ...appearanceData,
        portraitConfig: {
          ...appearanceData.portraitConfig,
          presets: presets.filter(p => p.id !== presetId),
        },
      };
      await saveAppearanceConfig(updatedConfig);
      onRefreshConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete preset');
    } finally {
      setPromptSaving(false);
    }
  };

  // Extract options from data
  const builds = useMemo(() =>
    appearanceData?.builds.map(b => ({ id: b.id, name: b.name })) ?? [],
    [appearanceData]
  );

  const skinTones = useMemo(() =>
    appearanceData?.skinTones.map(s => ({ id: s.id, name: s.name })) ?? [],
    [appearanceData]
  );

  const hairColors = useMemo(() =>
    appearanceData?.hairColors.map(h => ({ id: h.id, name: h.name })) ?? [],
    [appearanceData]
  );

  const sexOptions = useMemo(() => {
    const sexCategory = characterData?.categories.find(c => c.id === 'sex');
    return sexCategory?.options.map(o => ({ id: o.id, name: o.name })) ?? [
      { id: 'male', name: 'Male' },
      { id: 'female', name: 'Female' }
    ];
  }, [characterData]);

  const races = useMemo(() => {
    const raceCategory = characterData?.categories.find(c => c.id === 'race');
    return raceCategory?.options.map(o => ({ id: o.id, name: o.name })) ?? [];
  }, [characterData]);

  // Get existing portrait combinations for quick lookup (by characteristics, not ID)
  const existingPortraitCombos = useMemo(() => {
    const combos = new Set<string>();
    appearanceData?.portraits.forEach(p => {
      // Create a key from the portrait's actual characteristics
      const key = `${p.sex}-${p.race}-${p.build}-${p.skinTone}-${p.hairColor}`;
      combos.add(key);
    });
    return combos;
  }, [appearanceData]);

  // Calculate missing counts by category
  const missingCounts = useMemo(() => {
    const counts = {
      builds: {} as Record<string, number>,
      skinTones: {} as Record<string, number>,
      hairColors: {} as Record<string, number>,
      sexes: {} as Record<string, number>,
      races: {} as Record<string, number>,
    };

    // Initialize all counts to 0
    builds.forEach(b => counts.builds[b.id] = 0);
    skinTones.forEach(s => counts.skinTones[s.id] = 0);
    hairColors.forEach(h => counts.hairColors[h.id] = 0);
    sexOptions.forEach(s => counts.sexes[s.id] = 0);
    races.forEach(r => counts.races[r.id] = 0);

    // Count missing for each combination
    for (const build of builds) {
      for (const skinTone of skinTones) {
        for (const hairColor of hairColors) {
          for (const sex of sexOptions) {
            for (const race of races) {
              const key = `${sex.id}-${race.id}-${build.id}-${skinTone.id}-${hairColor.id}`;
              if (!existingPortraitCombos.has(key)) {
                counts.builds[build.id]++;
                counts.skinTones[skinTone.id]++;
                counts.hairColors[hairColor.id]++;
                counts.sexes[sex.id]++;
                counts.races[race.id]++;
              }
            }
          }
        }
      }
    }

    return counts;
  }, [builds, skinTones, hairColors, sexOptions, races, existingPortraitCombos]);

  // Calculate total missing
  const totalMissing = useMemo(() => {
    let count = 0;
    for (const build of builds) {
      for (const skinTone of skinTones) {
        for (const hairColor of hairColors) {
          for (const sex of sexOptions) {
            for (const race of races) {
              const key = `${sex.id}-${race.id}-${build.id}-${skinTone.id}-${hairColor.id}`;
              if (!existingPortraitCombos.has(key)) {
                count++;
              }
            }
          }
        }
      }
    }
    return count;
  }, [builds, skinTones, hairColors, sexOptions, races, existingPortraitCombos]);

  // Calculate how many will be generated from current selection
  const baseCombinations = useMemo(() => {
    if (selectedBuilds.size === 0 || selectedSkinTones.size === 0 ||
        selectedHairColors.size === 0 || selectedSexes.size === 0 ||
        selectedRaces.size === 0) {
      return 0;
    }
    return selectedBuilds.size * selectedSkinTones.size *
           selectedHairColors.size * selectedSexes.size * selectedRaces.size;
  }, [selectedBuilds, selectedSkinTones, selectedHairColors, selectedSexes, selectedRaces]);

  const totalToGenerate = baseCombinations * countPerCombination;

  // Calculate missing combinations in current selection (both count and list)
  const { missingCount: missingInSelection, missingCombinations } = useMemo(() => {
    if (baseCombinations === 0) return { missingCount: 0, missingCombinations: [] as PortraitCombination[] };

    const missing: PortraitCombination[] = [];
    for (const build of selectedBuilds) {
      for (const skinTone of selectedSkinTones) {
        for (const hairColor of selectedHairColors) {
          for (const sex of selectedSexes) {
            for (const race of selectedRaces) {
              const key = `${sex}-${race}-${build}-${skinTone}-${hairColor}`;
              if (!existingPortraitCombos.has(key)) {
                missing.push({
                  build,
                  skinTone,
                  hairColor,
                  sex: sex as 'male' | 'female',
                  race,
                });
              }
            }
          }
        }
      }
    }
    return { missingCount: missing.length, missingCombinations: missing };
  }, [selectedBuilds, selectedSkinTones, selectedHairColors, selectedSexes, selectedRaces, existingPortraitCombos, baseCombinations]);

  // Calculate effective generation count based on "missing only" toggle
  const effectiveToGenerate = generateMissingOnly
    ? missingInSelection * countPerCombination
    : totalToGenerate;

  // Toggle helpers
  const toggleBuild = useCallback((id: string) => {
    setSelectedBuilds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSkinTone = useCallback((id: string) => {
    setSelectedSkinTones(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleHairColor = useCallback((id: string) => {
    setSelectedHairColors(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSex = useCallback((id: string) => {
    setSelectedSexes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleRace = useCallback((id: string) => {
    setSelectedRaces(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Load pending portraits, generation status, rate limits, and batch jobs
  const refreshStatus = useCallback(async () => {
    try {
      const [pending, status, limits, jobs] = await Promise.all([
        fetchPendingPortraits(),
        fetchGenerationStatus(),
        fetchRateLimits(),
        fetchBatchJobs()
      ]);
      setPendingPortraits(pending);
      setGenerationStatus(status);
      setRateLimits(limits);
      setBatchJobs(jobs);
    } catch (err) {
      console.error('Failed to refresh status:', err);
    }
  }, []);

  // Poll for status while generating
  useEffect(() => {
    refreshStatus();

    const interval = setInterval(() => {
      if (generationStatus?.isGenerating) {
        refreshStatus();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [refreshStatus, generationStatus?.isGenerating]);

  // Generate portraits
  const handleGenerate = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const request = generateMissingOnly && missingCombinations.length > 0
        ? {
            // Use specific combinations for missing-only mode
            builds: [],
            skinTones: [],
            hairColors: [],
            sexes: [] as ('male' | 'female')[],
            races: [],
            count: countPerCombination,
            combinations: missingCombinations,
          }
        : {
            builds: Array.from(selectedBuilds),
            skinTones: Array.from(selectedSkinTones),
            hairColors: Array.from(selectedHairColors),
            sexes: Array.from(selectedSexes) as ('male' | 'female')[],
            races: Array.from(selectedRaces),
            count: countPerCombination,
          };
      const result = await generatePortraits(request);
      console.log('Generation queued:', result);
      refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue generation');
    } finally {
      setIsLoading(false);
    }
  };

  // Accept a single portrait
  const handleAccept = async (id: string) => {
    try {
      await acceptPortrait(id);
      await refreshStatus();
      onRefreshConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept portrait');
    }
  };

  // Reject a single portrait
  const handleReject = async (id: string) => {
    try {
      await rejectPortrait(id);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject portrait');
    }
  };

  // Accept all
  const handleAcceptAll = async () => {
    try {
      await acceptAllPortraits();
      await refreshStatus();
      onRefreshConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept all portraits');
    }
  };

  // Reject all
  const handleRejectAll = async () => {
    if (!confirm('Are you sure you want to reject all pending portraits?')) return;
    try {
      await rejectAllPortraits();
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject all portraits');
    }
  };

  // Create batch job
  const handleCreateBatch = async () => {
    setError(null);
    setIsCreatingBatch(true);
    try {
      const request = generateMissingOnly && missingCombinations.length > 0
        ? {
            builds: [],
            skinTones: [],
            hairColors: [],
            sexes: [] as ('male' | 'female')[],
            races: [],
            count: countPerCombination,
            combinations: missingCombinations,
          }
        : {
            builds: Array.from(selectedBuilds),
            skinTones: Array.from(selectedSkinTones),
            hairColors: Array.from(selectedHairColors),
            sexes: Array.from(selectedSexes) as ('male' | 'female')[],
            races: Array.from(selectedRaces),
            count: countPerCombination,
          };
      const result = await createBatchJob(request);
      console.log('Batch job created:', result);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create batch job');
    } finally {
      setIsCreatingBatch(false);
    }
  };

  // Check batch job status
  const handleCheckBatchStatus = async (jobId: string) => {
    try {
      await fetchBatchJobStatus(jobId);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check batch status');
    }
  };

  // Import batch results
  const handleImportBatch = async (jobId: string) => {
    try {
      const result = await importBatchResults(jobId);
      console.log('Batch import result:', result);
      await refreshStatus();
      onRefreshConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import batch results');
    }
  };

  // Delete batch job record
  const handleDeleteBatch = async (jobId: string) => {
    if (!confirm('Delete this batch job record?')) return;
    try {
      await deleteBatchJob(jobId);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete batch job');
    }
  };

  // Get category-level missing counts
  const buildMissing = Object.values(missingCounts.builds).reduce((a, b) => a + b, 0) /
    (skinTones.length * hairColors.length * sexOptions.length * races.length || 1);
  const skinToneMissing = Object.values(missingCounts.skinTones).reduce((a, b) => a + b, 0) /
    (builds.length * hairColors.length * sexOptions.length * races.length || 1);
  const hairColorMissing = Object.values(missingCounts.hairColors).reduce((a, b) => a + b, 0) /
    (builds.length * skinTones.length * sexOptions.length * races.length || 1);
  const sexMissing = Object.values(missingCounts.sexes).reduce((a, b) => a + b, 0) /
    (builds.length * skinTones.length * hairColors.length * races.length || 1);
  const raceMissing = Object.values(missingCounts.races).reduce((a, b) => a + b, 0) /
    (builds.length * skinTones.length * hairColors.length * sexOptions.length || 1);

  return (
    <div className="portrait-manager">
      <h3>Portrait Generation</h3>

      <div className="portrait-stats">
        <div className="stat">
          <span className="stat-value">{appearanceData?.portraits.length ?? 0}</span>
          <span className="stat-label">Existing</span>
        </div>
        <div className="stat">
          <span className="stat-value">{totalMissing}</span>
          <span className="stat-label">Missing</span>
        </div>
        <div className="stat">
          <span className="stat-value">{pendingPortraits.length}</span>
          <span className="stat-label">Pending Review</span>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {generationStatus?.isGenerating && (
        <div className="generation-progress">
          <div className="progress-text">
            Generating: {generationStatus.progress.current} / {generationStatus.progress.total}
            {generationStatus.progress.currentItem && (
              <span className="current-item"> ({generationStatus.progress.currentItem.id})</span>
            )}
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(generationStatus.progress.current / generationStatus.progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="prompt-config">
        <div className="prompt-header">
          <h4>Generation Settings</h4>
          {!editingPrompt ? (
            <button className="btn-secondary btn-small" onClick={() => setEditingPrompt(true)}>
              Edit
            </button>
          ) : (
            <div className="prompt-actions">
              <button
                className="btn-secondary btn-small"
                onClick={() => {
                  setEditingPrompt(false);
                  setBasePrompt(appearanceData?.portraitConfig?.basePrompt || '');
                  setStyleModifiers(appearanceData?.portraitConfig?.styleModifiers || '');
                  setSelectedModel(appearanceData?.portraitConfig?.model || 'nano-banana-pro');
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary btn-small"
                onClick={handleSavePrompt}
                disabled={promptSaving}
              >
                {promptSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
        {editingPrompt ? (
          <div className="prompt-editor">
            <div className="prompt-field">
              <label>Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="model-select"
              >
                <option value="nano-banana-pro">Nano Banana Pro (Higher Quality, 250 RPD)</option>
                <option value="nano-banana">Nano Banana Flash (Faster, 2000 RPD)</option>
              </select>
            </div>

            {/* Preset selector */}
            {presets.length > 0 && (
              <div className="prompt-field prompt-presets">
                <label>Load Preset</label>
                <div className="preset-list">
                  {presets.map(preset => (
                    <div key={preset.id} className="preset-item">
                      <button
                        className="btn-secondary btn-small preset-load"
                        onClick={() => handleLoadPreset(preset.id)}
                        title={preset.basePrompt}
                      >
                        {preset.name}
                      </button>
                      <button
                        className="btn-danger btn-tiny preset-delete"
                        onClick={() => handleDeletePreset(preset.id)}
                        title="Delete preset"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="prompt-field">
              <div className="prompt-field-header">
                <label>Base Prompt</label>
                {!showSavePreset ? (
                  <button
                    className="btn-secondary btn-tiny"
                    onClick={() => setShowSavePreset(true)}
                  >
                    Save as Preset
                  </button>
                ) : (
                  <div className="save-preset-inline">
                    <input
                      type="text"
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      placeholder="Preset name"
                      className="preset-name-input"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveAsPreset();
                        if (e.key === 'Escape') {
                          setShowSavePreset(false);
                          setNewPresetName('');
                        }
                      }}
                      autoFocus
                    />
                    <button
                      className="btn-primary btn-tiny"
                      onClick={handleSaveAsPreset}
                      disabled={!newPresetName.trim() || promptSaving}
                    >
                      Save
                    </button>
                    <button
                      className="btn-secondary btn-tiny"
                      onClick={() => {
                        setShowSavePreset(false);
                        setNewPresetName('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              <textarea
                value={basePrompt}
                onChange={(e) => setBasePrompt(e.target.value)}
                rows={3}
                placeholder="Use {sex}, {race}, {build}, {skinTone}, {hairColor} as placeholders"
              />
            </div>
            <div className="prompt-field">
              <label>Style Modifiers</label>
              <textarea
                value={styleModifiers}
                onChange={(e) => setStyleModifiers(e.target.value)}
                rows={2}
                placeholder="Additional style instructions appended to base prompt"
              />
            </div>
          </div>
        ) : (
          <div className="prompt-preview">
            <div className="model-display">
              <span className="model-label">Model:</span>
              <span className="model-value">
                {selectedModel === 'nano-banana-pro' ? 'Nano Banana Pro' : 'Nano Banana Flash'}
              </span>
              {rateLimits && rateLimits.remaining !== null && rateLimits.limit !== null && (
                <span className="rate-limit-badge" title={`Resets: ${rateLimits.reset || 'unknown'}`}>
                  {rateLimits.remaining} / {rateLimits.limit} remaining
                </span>
              )}
            </div>
            <div className="prompt-text">{basePrompt || 'No prompt configured'}</div>
            {styleModifiers && (
              <div className="prompt-style">+ {styleModifiers}</div>
            )}
          </div>
        )}
      </div>

      <div className="generation-controls">
        <h4>Select Characteristics to Generate</h4>
        <p className="help-text">
          Select options from each category. All combinations of selected options will be generated.
        </p>

        <div className="checkbox-groups">
          <CheckboxGroup
            label="Sex"
            options={sexOptions}
            selected={selectedSexes}
            onToggle={toggleSex}
            missingCount={Math.round(sexMissing)}
          />
          <CheckboxGroup
            label="Race"
            options={races}
            selected={selectedRaces}
            onToggle={toggleRace}
            missingCount={Math.round(raceMissing)}
          />
          <CheckboxGroup
            label="Build"
            options={builds}
            selected={selectedBuilds}
            onToggle={toggleBuild}
            missingCount={Math.round(buildMissing)}
          />
          <CheckboxGroup
            label="Skin Tone"
            options={skinTones}
            selected={selectedSkinTones}
            onToggle={toggleSkinTone}
            missingCount={Math.round(skinToneMissing)}
          />
          <CheckboxGroup
            label="Hair Color"
            options={hairColors}
            selected={selectedHairColors}
            onToggle={toggleHairColor}
            missingCount={Math.round(hairColorMissing)}
          />
        </div>

        <div className="generation-summary">
          <div className="generation-count-row">
            <label className="count-label">
              Per combination:
              <input
                type="number"
                min={1}
                max={10}
                value={countPerCombination}
                onChange={(e) => setCountPerCombination(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                className="count-input"
              />
            </label>
            <label className="missing-only-toggle">
              <input
                type="checkbox"
                checked={generateMissingOnly}
                onChange={(e) => setGenerateMissingOnly(e.target.checked)}
              />
              <span>Missing only</span>
            </label>
            <span className="combination-count">
              {baseCombinations === 0
                ? 'Select at least one option from each category'
                : generateMissingOnly
                  ? (missingInSelection === 0
                      ? 'All combinations have portraits'
                      : `${effectiveToGenerate} portrait${effectiveToGenerate !== 1 ? 's' : ''} (${missingInSelection} missing × ${countPerCombination})`)
                  : `${totalToGenerate} portrait${totalToGenerate !== 1 ? 's' : ''} (${baseCombinations} combo${baseCombinations !== 1 ? 's' : ''} × ${countPerCombination})`
              }
            </span>
            {baseCombinations > 0 && !generateMissingOnly && (
              <span className={`missing-in-selection ${missingInSelection === 0 ? 'all-covered' : ''}`}>
                {missingInSelection === 0
                  ? '✓ All covered'
                  : `${missingInSelection} missing`
                }
              </span>
            )}
          </div>
          <div className="generation-buttons">
            <button
              className="btn-primary generate-btn"
              onClick={handleGenerate}
              disabled={effectiveToGenerate === 0 || isLoading || generationStatus?.isGenerating}
            >
              {isLoading ? 'Queuing...' : generationStatus?.isGenerating ? 'Generating...' : 'Generate Now'}
            </button>
            <button
              className="btn-secondary batch-btn"
              onClick={handleCreateBatch}
              disabled={effectiveToGenerate === 0 || isCreatingBatch}
              title="Create async batch job (50% cheaper, takes hours)"
            >
              {isCreatingBatch ? 'Creating...' : 'Create Batch Job'}
            </button>
          </div>
        </div>
      </div>

      {pendingPortraits.length > 0 && (
        <div className="pending-review">
          <div className="pending-header">
            <h4>Pending Review ({pendingPortraits.length})</h4>
            <div className="pending-actions">
              <button className="btn-secondary" onClick={handleAcceptAll}>
                Accept All
              </button>
              <button className="btn-danger" onClick={handleRejectAll}>
                Reject All
              </button>
            </div>
          </div>

          <div className="pending-grid">
            {pendingPortraits.map(portrait => (
              <div key={portrait.id} className="pending-portrait">
                <img
                  src={`/images/${portrait.tempPath}`}
                  alt={portrait.id}
                  onClick={() => setLightboxPortrait(portrait)}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/placeholder.png';
                  }}
                />
                <div className="pending-info">
                  <span className="pending-id">{portrait.sex} {portrait.race}</span>
                  <span className="pending-details">
                    {portrait.build} / {portrait.skinTone} / {portrait.hairColor}
                  </span>
                </div>
                <div className="pending-buttons">
                  <button
                    className="btn-accept"
                    onClick={() => handleAccept(portrait.id)}
                    title="Accept"
                  >
                    ✓
                  </button>
                  <button
                    className="btn-reject"
                    onClick={() => handleReject(portrait.id)}
                    title="Reject"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Batch Jobs Panel */}
      {batchJobs.length > 0 && (
        <div className="batch-jobs-panel">
          <h4>Batch Jobs</h4>
          <div className="batch-jobs-list">
            {batchJobs.map(job => (
              <div key={job.id} className={`batch-job ${job.state === 'JOB_STATE_SUCCEEDED' ? 'succeeded' : ''} ${job.imported ? 'imported' : ''}`}>
                <div className="batch-job-info">
                  <div className="batch-job-header">
                    <span className="batch-job-name">{job.displayName}</span>
                    <span className={`batch-job-state state-${job.state?.toLowerCase().replace('job_state_', '')}`}>
                      {job.state?.replace('JOB_STATE_', '') || 'UNKNOWN'}
                    </span>
                  </div>
                  <div className="batch-job-details">
                    <span>{job.requestCount} portraits</span>
                    <span>Created: {new Date(job.createdAt).toLocaleString()}</span>
                    {job.stats && (
                      <span>
                        {job.stats.successfulRequestCount || 0} / {job.stats.totalRequestCount || job.requestCount} complete
                      </span>
                    )}
                    {job.imported && (
                      <span className="imported-badge">
                        Imported: {job.importedCount} ({job.failedCount} failed)
                      </span>
                    )}
                  </div>
                </div>
                <div className="batch-job-actions">
                  <button
                    className="btn-small btn-secondary"
                    onClick={() => handleCheckBatchStatus(job.id)}
                    title="Refresh status"
                  >
                    ↻
                  </button>
                  {job.state === 'JOB_STATE_SUCCEEDED' && (
                    <button
                      className="btn-small btn-primary"
                      onClick={() => handleImportBatch(job.id)}
                      title={job.imported ? "Re-import results to pending" : "Import results to pending"}
                    >
                      {job.imported ? 'Re-import' : 'Import'}
                    </button>
                  )}
                  <button
                    className="btn-small btn-danger"
                    onClick={() => handleDeleteBatch(job.id)}
                    title="Delete job record"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox for enlarged view */}
      {lightboxPortrait && (
        <div className="portrait-lightbox" onClick={() => setLightboxPortrait(null)}>
          <img
            src={`/images/${lightboxPortrait.tempPath}`}
            alt={lightboxPortrait.id}
          />
          <div className="portrait-lightbox-info">
            <div className="lightbox-title">
              {lightboxPortrait.sex} {lightboxPortrait.race}
            </div>
            <div className="lightbox-details">
              {lightboxPortrait.build} / {lightboxPortrait.skinTone} / {lightboxPortrait.hairColor}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

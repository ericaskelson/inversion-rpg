import { useState, useEffect, useCallback } from 'react';
import {
  fetchOptionImageConfig,
  saveOptionImageConfig,
  generateOptionImages,
  fetchPendingOptionImages,
  fetchOptionGenerationStatus,
  acceptOptionImage,
  rejectOptionImage,
  acceptAllOptionImages,
  rejectAllOptionImages,
  createOptionBatchJob,
  fetchOptionBatchJobs,
  fetchOptionBatchJobStatus,
  importOptionBatchResults,
  deleteOptionBatchJob,
  fetchRateLimits,
  type OptionImageConfig,
  type OptionForGeneration,
  type PendingOptionImage,
  type OptionGenerationStatus,
  type OptionBatchJob,
  type RateLimitInfo,
} from '../api/editorApi';
import type { CategoryConfig, CharacterOption } from '../types/game';
import { useEditMode } from '../contexts/EditModeContext';

interface OptionImageManagerProps {
  categories: CategoryConfig[];
}

export default function OptionImageManager({ categories }: OptionImageManagerProps) {
  const { refreshCharacterData } = useEditMode();

  // Config state
  const [config, setConfig] = useState<OptionImageConfig>({
    basePrompt: `You are generating option card art for a dark fantasy RPG character creator.
These are selection cards shown during character creation - the image should be iconic and symbolic of the option.
Square 1:1 format, suitable for a card/button.`,
    styleModifiers: 'Dark fantasy art style, painterly, dramatic lighting, striking color palette',
    aspectRatio: '1:1',
    imageSize: '1K',
    model: 'nano-banana-pro',
  });
  const [configDirty, setConfigDirty] = useState(false);

  // Selection state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showMissingOnly, setShowMissingOnly] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());

  // Generation state
  const [generationStatus, setGenerationStatus] = useState<OptionGenerationStatus | null>(null);
  const [pendingImages, setPendingImages] = useState<PendingOptionImage[]>([]);
  const [rateLimits, setRateLimits] = useState<RateLimitInfo | null>(null);

  // Batch jobs state
  const [batchJobs, setBatchJobs] = useState<OptionBatchJob[]>([]);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  // UI state
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Track previous generation state to detect completion
  const [wasGenerating, setWasGenerating] = useState(false);

  // Load initial data
  useEffect(() => {
    loadConfig();
    loadPendingImages();
    loadBatchJobs();
    loadRateLimits();
  }, []);

  // Poll for generation status and pending images
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const status = await fetchOptionGenerationStatus();
        setGenerationStatus(status);

        // Always reload pending images to catch new ones
        loadPendingImages();

        // Reload rate limits when generating
        if (status.isGenerating) {
          loadRateLimits();
        }

        // Detect when generation just finished
        if (wasGenerating && !status.isGenerating) {
          console.log('Generation finished, reloading pending images');
          loadPendingImages();
        }
        setWasGenerating(status.isGenerating);
      } catch (err) {
        console.error('Error fetching generation status:', err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [wasGenerating]);

  const loadConfig = async () => {
    try {
      const cfg = await fetchOptionImageConfig();
      setConfig(cfg);
    } catch (err) {
      console.error('Error loading config:', err);
    }
  };

  const loadPendingImages = async () => {
    try {
      const pending = await fetchPendingOptionImages();
      setPendingImages(pending);
    } catch (err) {
      console.error('Error loading pending images:', err);
    }
  };

  const loadBatchJobs = async () => {
    try {
      const jobs = await fetchOptionBatchJobs();
      setBatchJobs(jobs);
    } catch (err) {
      console.error('Error loading batch jobs:', err);
    }
  };

  const loadRateLimits = async () => {
    try {
      const limits = await fetchRateLimits();
      setRateLimits(limits);
    } catch (err) {
      console.error('Error loading rate limits:', err);
    }
  };

  const handleSaveConfig = async () => {
    try {
      await saveOptionImageConfig(config);
      setConfigDirty(false);
    } catch (err) {
      console.error('Error saving config:', err);
    }
  };

  // Get all options with their image status
  const getAllOptions = useCallback((): (CharacterOption & { category: string; hasImage: boolean })[] => {
    const result: (CharacterOption & { category: string; hasImage: boolean })[] = [];
    for (const category of categories) {
      for (const option of category.options) {
        result.push({
          ...option,
          category: category.id,
          hasImage: !!option.image,
        });
      }
    }
    return result;
  }, [categories]);

  // Filter options based on current filters
  const getFilteredOptions = useCallback(() => {
    let options = getAllOptions();

    if (selectedCategory !== 'all') {
      options = options.filter(o => o.category === selectedCategory);
    }

    if (showMissingOnly) {
      options = options.filter(o => !o.hasImage);
    }

    return options;
  }, [getAllOptions, selectedCategory, showMissingOnly]);

  // Stats
  const allOptions = getAllOptions();
  const totalOptions = allOptions.length;
  const withImages = allOptions.filter(o => o.hasImage).length;
  const missingImages = totalOptions - withImages;

  // Category stats
  const getCategoryStats = (categoryId: string) => {
    const catOptions = allOptions.filter(o => o.category === categoryId);
    const missing = catOptions.filter(o => !o.hasImage).length;
    return { total: catOptions.length, missing };
  };

  const toggleOptionSelection = (optionKey: string) => {
    const newSelected = new Set(selectedOptions);
    if (newSelected.has(optionKey)) {
      newSelected.delete(optionKey);
    } else {
      newSelected.add(optionKey);
    }
    setSelectedOptions(newSelected);
  };

  const selectAllVisible = () => {
    const filtered = getFilteredOptions();
    const newSelected = new Set(selectedOptions);
    for (const opt of filtered) {
      newSelected.add(`${opt.category}-${opt.id}`);
    }
    setSelectedOptions(newSelected);
  };

  const clearSelection = () => {
    setSelectedOptions(new Set());
  };

  const toggleCategoryExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleGenerateSelected = async () => {
    if (selectedOptions.size === 0) return;

    const options: OptionForGeneration[] = [];
    for (const key of selectedOptions) {
      const [category, ...idParts] = key.split('-');
      const id = idParts.join('-');
      const opt = allOptions.find(o => o.category === category && o.id === id);
      if (opt) {
        options.push({
          category: opt.category,
          id: opt.id,
          name: opt.name,
          description: opt.description,
          traits: opt.traits,
          attributes: opt.attributes,
          isDrawback: opt.isDrawback,
          subcategory: opt.subcategory,
        });
      }
    }

    try {
      await generateOptionImages(options);
      clearSelection();
    } catch (err) {
      console.error('Error starting generation:', err);
    }
  };

  const handleCreateBatch = async () => {
    if (selectedOptions.size === 0) return;

    setIsCreatingBatch(true);
    const options: OptionForGeneration[] = [];
    for (const key of selectedOptions) {
      const [category, ...idParts] = key.split('-');
      const id = idParts.join('-');
      const opt = allOptions.find(o => o.category === category && o.id === id);
      if (opt) {
        options.push({
          category: opt.category,
          id: opt.id,
          name: opt.name,
          description: opt.description,
          traits: opt.traits,
          attributes: opt.attributes,
          isDrawback: opt.isDrawback,
          subcategory: opt.subcategory,
        });
      }
    }

    try {
      await createOptionBatchJob(options);
      clearSelection();
      loadBatchJobs();
    } catch (err) {
      console.error('Error creating batch:', err);
    } finally {
      setIsCreatingBatch(false);
    }
  };

  const handleRefreshBatchJob = async (jobId: string) => {
    try {
      await fetchOptionBatchJobStatus(jobId);
      loadBatchJobs();
    } catch (err) {
      console.error('Error refreshing batch job:', err);
    }
  };

  const handleImportBatchJob = async (jobId: string) => {
    try {
      await importOptionBatchResults(jobId);
      loadBatchJobs();
      loadPendingImages();
    } catch (err) {
      console.error('Error importing batch results:', err);
    }
  };

  const handleDeleteBatchJob = async (jobId: string) => {
    try {
      await deleteOptionBatchJob(jobId);
      loadBatchJobs();
    } catch (err) {
      console.error('Error deleting batch job:', err);
    }
  };

  const handleAcceptImage = async (id: string) => {
    try {
      await acceptOptionImage(id);
      loadPendingImages();
      // Refresh character data so the accepted image shows up immediately
      await refreshCharacterData();
    } catch (err) {
      console.error('Error accepting image:', err);
    }
  };

  const handleRejectImage = async (id: string) => {
    try {
      await rejectOptionImage(id);
      loadPendingImages();
    } catch (err) {
      console.error('Error rejecting image:', err);
    }
  };

  const handleAcceptAll = async () => {
    try {
      await acceptAllOptionImages();
      loadPendingImages();
      // Refresh character data so the accepted images show up immediately
      await refreshCharacterData();
    } catch (err) {
      console.error('Error accepting all images:', err);
    }
  };

  const handleRejectAll = async () => {
    try {
      await rejectAllOptionImages();
      loadPendingImages();
    } catch (err) {
      console.error('Error rejecting all images:', err);
    }
  };

  // Group filtered options by category for display
  const groupedOptions = getFilteredOptions().reduce((acc, opt) => {
    if (!acc[opt.category]) {
      acc[opt.category] = [];
    }
    acc[opt.category].push(opt);
    return acc;
  }, {} as Record<string, typeof allOptions>);

  return (
    <div className="option-image-manager">
      {/* Two-column layout */}
      <div className="option-manager-layout">
        {/* Left column: Options List */}
        <div className="option-manager-left">
          {/* Filters */}
          <div className="option-filters">
            <label>
              Category:
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                <option value="all">All Categories</option>
                {categories.map(cat => {
                  const stats = getCategoryStats(cat.id);
                  return (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({stats.missing} missing)
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showMissingOnly}
                onChange={(e) => setShowMissingOnly(e.target.checked)}
              />
              Missing only
            </label>
          </div>

          {/* Selection Actions */}
          <div className="selection-bar">
            <button onClick={selectAllVisible}>Select All</button>
            <button onClick={clearSelection} disabled={selectedOptions.size === 0}>
              Clear ({selectedOptions.size})
            </button>
          </div>

          {/* Options List */}
          <div className="options-list">
            {Object.entries(groupedOptions).map(([categoryId, options]) => {
              const category = categories.find(c => c.id === categoryId);
              const isExpanded = expandedCategories.has(categoryId) || selectedCategory !== 'all';

              return (
                <div key={categoryId} className="category-section">
                  <div
                    className="category-header"
                    onClick={() => selectedCategory === 'all' && toggleCategoryExpanded(categoryId)}
                  >
                    <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                    <span className="category-name">{category?.name || categoryId}</span>
                    <span className="category-count">({options.length})</span>
                  </div>

                  {isExpanded && (
                    <div className="category-options">
                      {options.map(opt => {
                        const key = `${opt.category}-${opt.id}`;
                        const isSelected = selectedOptions.has(key);

                        return (
                          <div
                            key={key}
                            className={`option-item ${isSelected ? 'selected' : ''} ${opt.hasImage ? 'has-image' : 'missing-image'}`}
                            onClick={() => toggleOptionSelection(key)}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                            />
                            <div className="option-thumbnail">
                              {opt.hasImage ? (
                                <img src={`/images/options/${opt.image}`} alt={opt.name} />
                              ) : (
                                <div className="no-image">?</div>
                              )}
                            </div>
                            <div className="option-info">
                              <span className="option-name">{opt.name}</span>
                              {opt.subcategory && (
                                <span className="option-subcategory">{opt.subcategory}</span>
                              )}
                            </div>
                            {opt.isDrawback && <span className="drawback-badge">D</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: Controls and Review */}
        <div className="option-manager-right">
          {/* Stats Bar */}
          <div className="option-stats-bar">
            <div className="stat">
              <span className="stat-value">{withImages}</span>
              <span className="stat-label">with images</span>
            </div>
            <div className="stat">
              <span className="stat-value missing">{missingImages}</span>
              <span className="stat-label">missing</span>
            </div>
            <div className="stat">
              <span className="stat-value pending">{pendingImages.length}</span>
              <span className="stat-label">pending</span>
            </div>
            {rateLimits && rateLimits.remaining !== null && (
              <div className="stat">
                <span className="stat-value">{rateLimits.remaining}/{rateLimits.limit}</span>
                <span className="stat-label">API quota</span>
              </div>
            )}
          </div>

          {/* Generation Actions */}
          <div className="generation-actions">
            <button
              className="generate-btn"
              onClick={handleGenerateSelected}
              disabled={selectedOptions.size === 0 || generationStatus?.isGenerating}
            >
              Generate Now ({selectedOptions.size})
            </button>
            <button
              className="batch-btn"
              onClick={handleCreateBatch}
              disabled={selectedOptions.size === 0 || isCreatingBatch}
            >
              {isCreatingBatch ? 'Creating...' : `Batch (${selectedOptions.size})`}
            </button>
          </div>

          {/* Generation Progress */}
          {generationStatus?.isGenerating && (
            <div className="generation-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${(generationStatus.progress.current / generationStatus.progress.total) * 100}%`,
                  }}
                />
              </div>
              <span>
                {generationStatus.progress.current}/{generationStatus.progress.total}
                {generationStatus.progress.currentItem && ` - ${generationStatus.progress.currentItem.name}`}
              </span>
            </div>
          )}

          {/* Batch Jobs Panel */}
          {batchJobs.length > 0 && (
            <div className="batch-jobs-panel">
              <h3>Batch Jobs</h3>
              {batchJobs.map(job => (
                <div key={job.id} className={`batch-job batch-job-state-${job.state.toLowerCase().replace(/_/g, '-')}`}>
                  <div className="batch-job-info">
                    <span className="batch-job-name">{job.displayName}</span>
                    <span className="batch-job-count">{job.requestCount} images</span>
                    <span className={`batch-job-state state-${job.state.toLowerCase().replace(/_/g, '-')}`}>
                      {job.state.replace('JOB_STATE_', '')}
                    </span>
                    {job.imported && (
                      <span className="batch-job-imported">
                        Imported: {job.importedCount}/{job.requestCount}
                      </span>
                    )}
                  </div>
                  <div className="batch-job-actions">
                    <button onClick={() => handleRefreshBatchJob(job.id)}>Refresh</button>
                    {job.state === 'JOB_STATE_SUCCEEDED' && !job.imported && (
                      <button onClick={() => handleImportBatchJob(job.id)}>Import</button>
                    )}
                    <button onClick={() => handleDeleteBatchJob(job.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pending Review */}
          {pendingImages.length > 0 && (
            <div className="pending-review-section">
              <div className="pending-header">
                <h3>Pending Review ({pendingImages.length})</h3>
                <div className="pending-actions">
                  <button className="accept-all-btn" onClick={handleAcceptAll}>
                    Accept All
                  </button>
                  <button className="reject-all-btn" onClick={handleRejectAll}>
                    Reject All
                  </button>
                </div>
              </div>
              <div className="pending-grid">
                {pendingImages.map(img => (
                  <div key={img.id} className="pending-image-card">
                    <img
                      src={`/images/${img.tempPath}`}
                      alt={img.name}
                      onClick={() => setLightboxImage(`/images/${img.tempPath}`)}
                    />
                    <div className="pending-image-info">
                      <span className="pending-image-name">{img.name}</span>
                      <span className="pending-image-category">{img.category}</span>
                    </div>
                    <div className="pending-image-actions">
                      <button className="accept-btn" onClick={() => handleAcceptImage(img.id)}>
                        ✓
                      </button>
                      <button className="reject-btn" onClick={() => handleRejectImage(img.id)}>
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prompt Config (collapsible) */}
          <details className="prompt-config-section">
            <summary>Prompt Configuration</summary>
            <div className="prompt-fields">
              <label>
                Base Prompt:
                <textarea
                  value={config.basePrompt}
                  onChange={(e) => {
                    setConfig({ ...config, basePrompt: e.target.value });
                    setConfigDirty(true);
                  }}
                  rows={4}
                />
              </label>
              <label>
                Style Modifiers:
                <textarea
                  value={config.styleModifiers}
                  onChange={(e) => {
                    setConfig({ ...config, styleModifiers: e.target.value });
                    setConfigDirty(true);
                  }}
                  rows={2}
                />
              </label>
              <div className="prompt-options">
                <label>
                  Aspect Ratio:
                  <select
                    value={config.aspectRatio}
                    onChange={(e) => {
                      setConfig({ ...config, aspectRatio: e.target.value });
                      setConfigDirty(true);
                    }}
                  >
                    <option value="1:1">1:1 (Square)</option>
                    <option value="4:3">4:3</option>
                    <option value="3:4">3:4</option>
                  </select>
                </label>
                <label>
                  Image Size:
                  <select
                    value={config.imageSize}
                    onChange={(e) => {
                      setConfig({ ...config, imageSize: e.target.value });
                      setConfigDirty(true);
                    }}
                  >
                    <option value="1K">1K</option>
                    <option value="2K">2K</option>
                    <option value="4K">4K</option>
                  </select>
                </label>
              </div>
              {configDirty && (
                <button className="save-config-btn" onClick={handleSaveConfig}>
                  Save Configuration
                </button>
              )}
            </div>
          </details>
        </div>
      </div>

      {/* Lightbox - full page overlay */}
      {lightboxImage && (
        <div className="option-lightbox" onClick={() => setLightboxImage(null)}>
          <img src={lightboxImage} alt="Full size" />
        </div>
      )}
    </div>
  );
}

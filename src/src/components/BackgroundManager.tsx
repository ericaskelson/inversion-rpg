import { useState, useEffect, useCallback } from 'react';
import {
  generateBackground,
  fetchPendingBackgrounds,
  acceptBackground,
  rejectBackground,
  fetchBackgroundConfig,
  saveBackgroundConfig,
  type BackgroundType,
  type PendingBackground,
  type BackgroundImageConfig,
} from '../api/editorApi';
import { getImageUrl } from '../utils/imagePath';

interface BackgroundManagerProps {
  type: BackgroundType;
  targetId: string;
  currentImage?: string;
  onImageChange: (imagePath: string | undefined) => void;
  description?: string;  // Context for AI generation (e.g., screen title + content)
}

const DEFAULT_CONFIG: BackgroundImageConfig = {
  basePrompt: 'Background image for a dark fantasy RPG game\'s {screenType}.\n\nThe screen will display this text:\n"{content}"\n\nCreate a moody, atmospheric scene that sets the tone. Focus on environment, mood, and atmosphere. Do not include any text, letters, words, or writing in the image.',
  styleModifiers: 'Dark fantasy art style, painterly, atmospheric, moody lighting, cinematic composition, no text, no letters, no words',
  aspectRatio: '16:9',
  imageSize: '2K',
  model: 'nano-banana-pro',
};

export function BackgroundManager({
  type,
  targetId,
  currentImage,
  onImageChange,
  description = '',
}: BackgroundManagerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingBackgrounds, setPendingBackgrounds] = useState<PendingBackground[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Config state
  const [config, setConfig] = useState<BackgroundImageConfig>(DEFAULT_CONFIG);
  const [editedConfig, setEditedConfig] = useState<BackgroundImageConfig>(DEFAULT_CONFIG);
  const [configDirty, setConfigDirty] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Resolution options for the dropdown
  const resolutionOptions = [
    { value: '1K', label: '1K (1024px)' },
    { value: '2K', label: '2K (2048px) - Recommended' },
    { value: '4K', label: '4K (4096px)' },
  ] as const;

  // Filter pending backgrounds for this specific target
  const relevantPending = pendingBackgrounds.filter(
    bg => bg.type === type && bg.targetId === targetId
  );

  // Get screen type label for placeholder
  const getScreenTypeLabel = () => {
    switch (type) {
      case 'intro-title': return 'title screen';
      case 'intro-story': return 'story/lore screen';
      case 'scenario': return 'scenario scene';
      case 'category': return 'category screen';
      default: return 'screen';
    }
  };

  // Build the final prompt by replacing placeholders
  const buildFinalPrompt = () => {
    const baseWithPlaceholders = editedConfig.basePrompt
      .replace(/\{screenType\}/g, getScreenTypeLabel())
      .replace(/\{content\}/g, description);
    return baseWithPlaceholders + ' ' + editedConfig.styleModifiers;
  };

  // Fetch config on mount
  useEffect(() => {
    fetchBackgroundConfig()
      .then(cfg => {
        setConfig(cfg);
        setEditedConfig(cfg);
      })
      .catch(err => console.error('Failed to fetch background config:', err));
  }, []);

  // Track if config has been edited
  useEffect(() => {
    setConfigDirty(
      editedConfig.basePrompt !== config.basePrompt ||
      editedConfig.styleModifiers !== config.styleModifiers ||
      editedConfig.imageSize !== config.imageSize
    );
  }, [editedConfig, config]);

  // Fetch pending backgrounds on mount and periodically while generating
  const refreshPending = useCallback(async () => {
    try {
      const pending = await fetchPendingBackgrounds();
      setPendingBackgrounds(pending);
    } catch (err) {
      console.error('Failed to fetch pending backgrounds:', err);
    }
  }, []);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  // Poll while generating
  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(refreshPending, 2000);
    return () => clearInterval(interval);
  }, [isGenerating, refreshPending]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await saveBackgroundConfig(editedConfig);
      setConfig(editedConfig);
      setConfigDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleResetConfig = () => {
    setEditedConfig(config);
    setConfigDirty(false);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const finalPrompt = buildFinalPrompt();
      await generateBackground({
        type,
        targetId,
        description: finalPrompt,
        config: {
          aspectRatio: editedConfig.aspectRatio,
          imageSize: editedConfig.imageSize,
          // styleModifiers is already included in the prompt
        },
      });
      // Refresh pending list to show the new background
      await refreshPending();
      setShowPromptEditor(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate background');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAccept = async (bg: PendingBackground) => {
    try {
      const result = await acceptBackground(bg.id);
      onImageChange(result.finalPath);
      await refreshPending();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept background');
    }
  };

  const handleReject = async (bg: PendingBackground) => {
    try {
      await rejectBackground(bg.id);
      await refreshPending();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject background');
    }
  };

  const handleClearImage = () => {
    onImageChange(undefined);
  };

  return (
    <div className="background-manager">
      <label>Background Image</label>

      {error && <div className="background-error">{error}</div>}

      {/* Current image preview */}
      {currentImage && (
        <div className="current-background">
          <div
            className="background-preview"
            onClick={() => setZoomedImage(getImageUrl(currentImage))}
          >
            <img src={getImageUrl(currentImage)} alt="Current background" />
          </div>
          <div className="background-info">
            <span className="background-path">{currentImage}</span>
            <button
              type="button"
              className="btn-clear"
              onClick={handleClearImage}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Generate section */}
      <div className="background-generate">
        {showPromptEditor ? (
          <div className="prompt-editor">
            <div className="prompt-field">
              <label className="prompt-label">
                Base Prompt
                <span className="placeholder-hint">Use {'{screenType}'} and {'{content}'} as placeholders</span>
              </label>
              <textarea
                value={editedConfig.basePrompt}
                onChange={e => setEditedConfig({ ...editedConfig, basePrompt: e.target.value })}
                rows={5}
              />
            </div>

            <div className="prompt-field">
              <label className="prompt-label">Style Modifiers</label>
              <textarea
                value={editedConfig.styleModifiers}
                onChange={e => setEditedConfig({ ...editedConfig, styleModifiers: e.target.value })}
                rows={2}
              />
            </div>

            <div className="prompt-preview">
              <label className="prompt-label">Preview (with placeholders replaced):</label>
              <div className="preview-text">{buildFinalPrompt()}</div>
            </div>

            <div className="prompt-options">
              <div className="resolution-selector">
                <label>Resolution:</label>
                <select
                  value={editedConfig.imageSize}
                  onChange={e => setEditedConfig({ ...editedConfig, imageSize: e.target.value })}
                  disabled={isGenerating}
                >
                  {resolutionOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="prompt-actions">
              {configDirty && (
                <>
                  <button
                    type="button"
                    className="btn-save-config"
                    onClick={handleSaveConfig}
                    disabled={savingConfig}
                  >
                    {savingConfig ? 'Saving...' : 'Save Template'}
                  </button>
                  <button
                    type="button"
                    className="btn-reset-config"
                    onClick={handleResetConfig}
                  >
                    Reset
                  </button>
                </>
              )}
              <div className="spacer" />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowPromptEditor(false)}
                disabled={isGenerating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleGenerate}
                disabled={isGenerating || !editedConfig.basePrompt.trim()}
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn-generate"
            onClick={() => setShowPromptEditor(true)}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate Background'}
          </button>
        )}
      </div>

      {/* Pending backgrounds */}
      {relevantPending.length > 0 && (
        <div className="pending-backgrounds">
          <h4>Pending ({relevantPending.length})</h4>
          <div className="pending-grid">
            {relevantPending.map(bg => (
              <div key={bg.id} className="pending-background-card">
                <div
                  className="pending-background-preview"
                  onClick={() => setZoomedImage(`/images/${bg.tempPath}`)}
                >
                  <img
                    src={`/images/${bg.tempPath}`}
                    alt="Pending background"
                  />
                </div>
                <div className="pending-background-actions">
                  <button
                    type="button"
                    className="btn-accept"
                    onClick={() => handleAccept(bg)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn-reject"
                    onClick={() => handleReject(bg)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox for zoomed images */}
      {zoomedImage && (
        <div className="background-lightbox" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} alt="Zoomed background" />
        </div>
      )}
    </div>
  );
}

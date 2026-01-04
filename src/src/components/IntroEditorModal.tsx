import { useState, useEffect } from 'react';
import type { IntroConfig, TitleScreenConfig, StoryScreen, IntroSettings } from '../types/game';
import { BackgroundManager } from './BackgroundManager';

type EditingTarget =
  | { type: 'title' }
  | { type: 'story'; screen: StoryScreen }
  | { type: 'newStory' }
  | { type: 'settings' };

interface IntroEditorModalProps {
  config: IntroConfig;
  editing: EditingTarget;
  onSave: (config: IntroConfig) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}

export function IntroEditorModal({
  config,
  editing,
  onSave,
  onDelete,
  onCancel,
}: IntroEditorModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Title screen form state
  const [titleForm, setTitleForm] = useState<TitleScreenConfig>(config.titleScreen);

  // Story screen form state
  const [storyForm, setStoryForm] = useState<StoryScreen>({
    id: '',
    title: '',
    content: '',
    backgroundImage: '',
    order: 1,
  });

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<IntroSettings>(config.settings);

  // Initialize form based on editing target
  useEffect(() => {
    if (editing.type === 'title') {
      setTitleForm(config.titleScreen);
    } else if (editing.type === 'story') {
      setStoryForm(editing.screen);
    } else if (editing.type === 'newStory') {
      const maxOrder = config.storyScreens.reduce((max, s) => Math.max(max, s.order), 0);
      setStoryForm({
        id: `story-${Date.now()}`,
        title: '',
        content: '',
        backgroundImage: '',
        order: maxOrder + 1,
      });
    } else if (editing.type === 'settings') {
      setSettingsForm(config.settings);
    }
  }, [editing, config]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      let updatedConfig: IntroConfig;

      if (editing.type === 'title') {
        updatedConfig = {
          ...config,
          titleScreen: titleForm,
        };
      } else if (editing.type === 'story') {
        updatedConfig = {
          ...config,
          storyScreens: config.storyScreens.map(s =>
            s.id === editing.screen.id ? storyForm : s
          ),
        };
      } else if (editing.type === 'newStory') {
        updatedConfig = {
          ...config,
          storyScreens: [...config.storyScreens, storyForm],
        };
      } else if (editing.type === 'settings') {
        updatedConfig = {
          ...config,
          settings: settingsForm,
        };
      } else {
        return;
      }

      await onSave(updatedConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm('Are you sure you want to delete this story screen?')) return;

    setSaving(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setSaving(false);
    }
  };

  const renderTitleForm = () => (
    <>
      <h2>Edit Title Screen</h2>
      <div className="editor-form">
        <div className="form-group">
          <label>Title</label>
          <input
            type="text"
            value={titleForm.title}
            onChange={e => setTitleForm({ ...titleForm, title: e.target.value })}
            placeholder="Game title"
          />
        </div>
        <div className="form-group">
          <label>Subtitle</label>
          <input
            type="text"
            value={titleForm.subtitle || ''}
            onChange={e => setTitleForm({ ...titleForm, subtitle: e.target.value || undefined })}
            placeholder="Optional subtitle"
          />
        </div>
        <div className="form-group">
          <label>Button Text</label>
          <input
            type="text"
            value={titleForm.buttonText}
            onChange={e => setTitleForm({ ...titleForm, buttonText: e.target.value })}
            placeholder="Begin button text"
          />
        </div>
        <BackgroundManager
          type="intro-title"
          targetId="title"
          currentImage={titleForm.backgroundImage}
          onImageChange={(path) => setTitleForm({ ...titleForm, backgroundImage: path })}
          description={`${titleForm.title}${titleForm.subtitle ? ': ' + titleForm.subtitle : ''}`}
        />
      </div>
    </>
  );

  const renderStoryForm = () => (
    <>
      <h2>{editing.type === 'newStory' ? 'Add Story Screen' : 'Edit Story Screen'}</h2>
      <div className="editor-form">
        <div className="form-group">
          <label>Title (optional)</label>
          <input
            type="text"
            value={storyForm.title || ''}
            onChange={e => setStoryForm({ ...storyForm, title: e.target.value || undefined })}
            placeholder="Screen title"
          />
        </div>
        <div className="form-group">
          <label>Content (Markdown supported)</label>
          <textarea
            rows={8}
            value={storyForm.content}
            onChange={e => setStoryForm({ ...storyForm, content: e.target.value })}
            placeholder="Story text... Use **bold** and *italic* for emphasis."
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Order</label>
            <input
              type="number"
              value={storyForm.order}
              onChange={e => setStoryForm({ ...storyForm, order: parseInt(e.target.value) || 1 })}
              min={1}
            />
            <span className="field-hint">Lower numbers appear first</span>
          </div>
        </div>
        <BackgroundManager
          type="intro-story"
          targetId={storyForm.id}
          currentImage={storyForm.backgroundImage}
          onImageChange={(path) => setStoryForm({ ...storyForm, backgroundImage: path })}
          description={`${storyForm.title || 'Story screen'}: ${storyForm.content}`}
        />
      </div>
    </>
  );

  const renderSettingsForm = () => (
    <>
      <h2>Intro Settings</h2>
      <div className="editor-form">
        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={settingsForm.allowSkip}
              onChange={e => setSettingsForm({ ...settingsForm, allowSkip: e.target.checked })}
            />
            Allow players to skip intro
          </label>
        </div>
        <div className="form-group">
          <label>Skip Button Text</label>
          <input
            type="text"
            value={settingsForm.skipButtonText}
            onChange={e => setSettingsForm({ ...settingsForm, skipButtonText: e.target.value })}
            placeholder="Skip Intro"
            disabled={!settingsForm.allowSkip}
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="intro-editor-modal" onClick={e => e.stopPropagation()}>
        {error && <div className="editor-error">{error}</div>}

        {editing.type === 'title' && renderTitleForm()}
        {(editing.type === 'story' || editing.type === 'newStory') && renderStoryForm()}
        {editing.type === 'settings' && renderSettingsForm()}

        <div className="modal-actions">
          {editing.type === 'story' && onDelete && (
            <button
              className="btn-delete"
              onClick={handleDelete}
              disabled={saving}
            >
              Delete
            </button>
          )}
          <div className="spacer" />
          <button
            className="btn-secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

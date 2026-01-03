import { useState, useEffect } from 'react';
import type { CategoryConfig, CategoryId } from '../types/game';
import { useEditMode } from '../contexts/EditModeContext';

export function CategoryEditorModal() {
  const {
    editingCategory,
    isCreatingNewCategory,
    cancelCategoryEditing,
    saveCategory,
    deleteCategory,
  } = useEditMode();

  const [formData, setFormData] = useState<CategoryConfig | null>(null);
  const [originalId, setOriginalId] = useState<CategoryId | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when editingCategory changes
  useEffect(() => {
    if (editingCategory) {
      setFormData({ ...editingCategory });
      setOriginalId(editingCategory.id);
      setError(null);
      setSaving(false);  // Reset saving state for new category
    } else {
      setFormData(null);
      setOriginalId(null);
    }
  }, [editingCategory]);

  if (!editingCategory || !formData) return null;

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!formData.id.trim()) {
      setError('ID is required');
      return;
    }
    if (formData.minPicks < 0) {
      setError('Min picks cannot be negative');
      return;
    }
    if (formData.maxPicks < formData.minPicks) {
      setError('Max picks must be >= min picks');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveCategory(formData, originalId || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete category "${formData.name}"? This will also delete all options in this category.`)) {
      return;
    }
    setSaving(true);
    try {
      await deleteCategory(formData.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={cancelCategoryEditing}>
      <div className="modal-content category-editor-modal" onClick={e => e.stopPropagation()}>
        <h2>{isCreatingNewCategory ? 'Create New Category' : 'Edit Category'}</h2>

        {error && <div className="editor-error">{error}</div>}

        <div className="editor-form">
          <div className="form-group">
            <label htmlFor="cat-name">Name</label>
            <input
              id="cat-name"
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Skills, Feats, Background"
            />
          </div>

          <div className="form-group">
            <label htmlFor="cat-id">
              ID
              <span className="label-hint">(internal identifier, no spaces)</span>
            </label>
            <input
              id="cat-id"
              type="text"
              value={formData.id}
              onChange={e => setFormData({ ...formData, id: e.target.value as CategoryId })}
              placeholder="e.g., skills, feats, background"
            />
          </div>

          <div className="form-group">
            <label htmlFor="cat-description">Description</label>
            <textarea
              id="cat-description"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description shown to players"
              rows={2}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="cat-min-picks">Min Picks</label>
              <input
                id="cat-min-picks"
                type="number"
                min={0}
                value={formData.minPicks}
                onChange={e => setFormData({ ...formData, minPicks: parseInt(e.target.value) || 0 })}
              />
              <span className="field-hint">0 = optional category</span>
            </div>

            <div className="form-group">
              <label htmlFor="cat-max-picks">Max Picks</label>
              <input
                id="cat-max-picks"
                type="number"
                min={1}
                value={formData.maxPicks}
                onChange={e => setFormData({ ...formData, maxPicks: parseInt(e.target.value) || 1 })}
              />
              <span className="field-hint">1 = single selection</span>
            </div>
          </div>

          <div className="picks-preview">
            {formData.minPicks === 0 && formData.maxPicks === 1 && (
              <span className="preview-text">Optional single-select (shown with checkmark by default)</span>
            )}
            {formData.minPicks === 1 && formData.maxPicks === 1 && (
              <span className="preview-text">Required single-select</span>
            )}
            {formData.minPicks === 0 && formData.maxPicks > 1 && (
              <span className="preview-text">Optional, up to {formData.maxPicks} picks</span>
            )}
            {formData.minPicks > 0 && formData.maxPicks > 1 && (
              <span className="preview-text">Required: {formData.minPicks}-{formData.maxPicks} picks</span>
            )}
          </div>

          {!isCreatingNewCategory && (
            <div className="category-stats">
              <span>{formData.options.length} option{formData.options.length !== 1 ? 's' : ''} in this category</span>
            </div>
          )}
        </div>

        <div className="modal-actions">
          {!isCreatingNewCategory && (
            <button
              className="btn-delete"
              onClick={handleDelete}
              disabled={saving}
            >
              Delete Category
            </button>
          )}
          <div className="spacer" />
          <button
            className="btn-secondary"
            onClick={cancelCategoryEditing}
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

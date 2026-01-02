import { useState, useEffect } from 'react';
import type { CharacterOption, AttributeId } from '../types/game';
import { useEditMode } from '../contexts/EditModeContext';

const ATTRIBUTE_IDS: AttributeId[] = ['strength', 'agility', 'endurance', 'cunning', 'charisma', 'will'];

export function OptionEditorModal() {
  const { editingOption, cancelEditing, saveOption, isCreatingNew, characterData } = useEditMode();

  const [formData, setFormData] = useState<CharacterOption>({
    id: '',
    name: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Store raw traits input to allow typing commas freely
  const [traitsInput, setTraitsInput] = useState('');

  // Reset form when editing option changes
  useEffect(() => {
    if (editingOption) {
      setFormData({ ...editingOption.option });
      setTraitsInput(editingOption.option.traits?.join(', ') ?? '');
      setError(null);
    }
  }, [editingOption]);

  if (!editingOption) return null;

  // Get existing subcategories for this category
  const category = characterData?.categories.find(c => c.id === editingOption.categoryId);
  const existingSubcategories = category
    ? [...new Set(category.options.map(o => o.subcategory).filter(Boolean))]
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Validate
      if (!formData.id.trim()) {
        throw new Error('ID is required');
      }
      if (!formData.name.trim()) {
        throw new Error('Name is required');
      }
      if (!formData.description.trim()) {
        throw new Error('Description is required');
      }

      // Clean up empty values
      const cleanedOption: CharacterOption = {
        id: formData.id.trim(),
        name: formData.name.trim(),
        description: formData.description.trim(),
      };

      if (formData.subcategory?.trim()) {
        cleanedOption.subcategory = formData.subcategory.trim();
      }
      if (formData.image?.trim()) {
        cleanedOption.image = formData.image.trim();
      }
      if (formData.fate !== undefined && formData.fate !== 0) {
        cleanedOption.fate = formData.fate;
      }
      if (formData.attributes && Object.keys(formData.attributes).length > 0) {
        // Filter out zero values
        const nonZeroAttrs = Object.fromEntries(
          Object.entries(formData.attributes).filter(([, v]) => v !== 0)
        );
        if (Object.keys(nonZeroAttrs).length > 0) {
          cleanedOption.attributes = nonZeroAttrs as Partial<Record<AttributeId, number>>;
        }
      }
      if (formData.traits && formData.traits.length > 0) {
        cleanedOption.traits = formData.traits.filter(t => t.trim());
      }
      if (formData.requires && formData.requires.length > 0) {
        cleanedOption.requires = formData.requires;
      }
      if (formData.incompatibleWith && formData.incompatibleWith.length > 0) {
        cleanedOption.incompatibleWith = formData.incompatibleWith;
      }
      if (formData.isDrawback) {
        cleanedOption.isDrawback = true;
      }

      await saveOption(cleanedOption);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateAttribute = (attr: AttributeId, value: number) => {
    setFormData(prev => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [attr]: value,
      },
    }));
  };

  const updateTraitsInput = (value: string) => {
    setTraitsInput(value);
    // Parse traits but don't filter empty - let the user type freely
    // Empty strings will be filtered on save
    const traits = value.split(',').map(t => t.trim());
    setFormData(prev => ({
      ...prev,
      traits: traits.some(t => t) ? traits : undefined,
    }));
  };

  return (
    <div className="modal-overlay" onClick={cancelEditing}>
      <div className="modal-content option-editor" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{isCreatingNew ? 'Create New Option' : 'Edit Option'}</h2>
          <button className="modal-close" onClick={cancelEditing}>&times;</button>
        </header>

        <form onSubmit={handleSubmit} className="option-editor-form">
          {error && <div className="form-error">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="option-id">ID</label>
              <input
                id="option-id"
                type="text"
                value={formData.id}
                onChange={e => setFormData(prev => ({ ...prev, id: e.target.value }))}
                placeholder="unique-option-id"
                disabled={!isCreatingNew}
              />
            </div>
            <div className="form-group">
              <label htmlFor="option-name">Name</label>
              <input
                id="option-name"
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Display Name"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="option-description">Description</label>
            <textarea
              id="option-description"
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe this option..."
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="option-subcategory">Subcategory</label>
              <input
                id="option-subcategory"
                type="text"
                value={formData.subcategory ?? ''}
                onChange={e => setFormData(prev => ({ ...prev, subcategory: e.target.value || undefined }))}
                placeholder="Optional grouping"
                list="subcategory-list"
              />
              <datalist id="subcategory-list">
                {existingSubcategories.map(sub => (
                  <option key={sub} value={sub} />
                ))}
              </datalist>
            </div>
            <div className="form-group">
              <label htmlFor="option-image">Image</label>
              <input
                id="option-image"
                type="text"
                value={formData.image ?? ''}
                onChange={e => setFormData(prev => ({ ...prev, image: e.target.value || undefined }))}
                placeholder="filename.png"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group small">
              <label htmlFor="option-fate">Fate</label>
              <input
                id="option-fate"
                type="number"
                value={formData.fate ?? 0}
                onChange={e => setFormData(prev => ({ ...prev, fate: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={formData.isDrawback ?? false}
                  onChange={e => setFormData(prev => ({ ...prev, isDrawback: e.target.checked || undefined }))}
                />
                Is Drawback
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Attributes</label>
            <div className="attributes-grid">
              {ATTRIBUTE_IDS.map(attr => (
                <div key={attr} className="attribute-input">
                  <span className="attr-label">{attr.slice(0, 3).toUpperCase()}</span>
                  <input
                    type="number"
                    value={formData.attributes?.[attr] ?? 0}
                    onChange={e => updateAttribute(attr, parseInt(e.target.value) || 0)}
                    min={-5}
                    max={5}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="option-traits">Traits (comma-separated)</label>
            <input
              id="option-traits"
              type="text"
              value={traitsInput}
              onChange={e => updateTraitsInput(e.target.value)}
              placeholder="trait-one, trait-two"
            />
          </div>

          <footer className="modal-footer">
            <button type="button" className="btn-secondary" onClick={cancelEditing}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import type { AppearanceOption, AttributeId } from '../types/game';
import { useEditMode } from '../contexts/EditModeContext';

const ATTRIBUTE_IDS: AttributeId[] = ['strength', 'agility', 'endurance', 'cunning', 'charisma', 'will'];

const TYPE_LABELS = {
  build: 'Build',
  skinTone: 'Skin Tone',
  hairColor: 'Hair Color',
};

export function AppearanceEditorModal() {
  const {
    editingAppearanceOption,
    cancelAppearanceEditing,
    saveAppearanceOption,
    isCreatingNewAppearance,
  } = useEditMode();

  const [formData, setFormData] = useState<AppearanceOption & { id: string }>({
    id: '',
    name: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when editing option changes
  useEffect(() => {
    if (editingAppearanceOption) {
      setFormData({ ...editingAppearanceOption.option });
      setError(null);
    }
  }, [editingAppearanceOption]);

  if (!editingAppearanceOption) return null;

  const typeLabel = TYPE_LABELS[editingAppearanceOption.type];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
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
      const cleanedOption: AppearanceOption & { id: string } = {
        id: formData.id.trim(),
        name: formData.name.trim(),
        description: formData.description.trim(),
      };

      if (formData.image?.trim()) {
        cleanedOption.image = formData.image.trim();
      }
      if (formData.fate !== undefined && formData.fate !== 0) {
        cleanedOption.fate = formData.fate;
      }
      if (formData.attributes && Object.keys(formData.attributes).length > 0) {
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

      await saveAppearanceOption(cleanedOption);
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

  const updateTraits = (traitsString: string) => {
    const traits = traitsString.split(',').map(t => t.trim()).filter(Boolean);
    setFormData(prev => ({
      ...prev,
      traits: traits.length > 0 ? traits : undefined,
    }));
  };

  return (
    <div className="modal-overlay" onClick={cancelAppearanceEditing}>
      <div className="modal-content option-editor" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{isCreatingNewAppearance ? `Create New ${typeLabel}` : `Edit ${typeLabel}`}</h2>
          <button className="modal-close" onClick={cancelAppearanceEditing}>&times;</button>
        </header>

        <form onSubmit={handleSubmit} className="option-editor-form">
          {error && <div className="form-error">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="appearance-id">ID</label>
              <input
                id="appearance-id"
                type="text"
                value={formData.id}
                onChange={e => setFormData(prev => ({ ...prev, id: e.target.value }))}
                placeholder={`${editingAppearanceOption.type}-id`}
                disabled={!isCreatingNewAppearance}
              />
            </div>
            <div className="form-group">
              <label htmlFor="appearance-name">Name</label>
              <input
                id="appearance-name"
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Display Name"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="appearance-description">Description</label>
            <textarea
              id="appearance-description"
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe this option..."
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="appearance-image">Image</label>
              <input
                id="appearance-image"
                type="text"
                value={formData.image ?? ''}
                onChange={e => setFormData(prev => ({ ...prev, image: e.target.value || undefined }))}
                placeholder="filename.png"
              />
            </div>
            <div className="form-group small">
              <label htmlFor="appearance-fate">Fate</label>
              <input
                id="appearance-fate"
                type="number"
                value={formData.fate ?? 0}
                onChange={e => setFormData(prev => ({ ...prev, fate: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Attributes (affects character stats)</label>
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
            <label htmlFor="appearance-traits">Traits (comma-separated)</label>
            <input
              id="appearance-traits"
              type="text"
              value={formData.traits?.join(', ') ?? ''}
              onChange={e => updateTraits(e.target.value)}
              placeholder="trait-one, trait-two"
            />
          </div>

          <footer className="modal-footer">
            <button type="button" className="btn-secondary" onClick={cancelAppearanceEditing}>
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

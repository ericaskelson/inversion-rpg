import { useState, useEffect, useMemo } from 'react';
import type { CharacterOption, AttributeId, OptionRequirement, CategoryId } from '../types/game';
import { useEditMode } from '../contexts/EditModeContext';

const ATTRIBUTE_IDS: AttributeId[] = ['strength', 'agility', 'endurance', 'cunning', 'charisma', 'will'];
const OPERATORS: Array<'>=' | '>' | '<=' | '<'> = ['>=', '>', '<=', '<'];

type RequirementType = 'trait' | 'notTrait' | 'attribute' | 'selection' | 'notSelection';

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

  // Requirements form state
  const [showAddRequirement, setShowAddRequirement] = useState(false);
  const [newReqType, setNewReqType] = useState<RequirementType>('trait');
  const [newReqTrait, setNewReqTrait] = useState('');
  const [newReqAttrId, setNewReqAttrId] = useState<AttributeId>('strength');
  const [newReqAttrOp, setNewReqAttrOp] = useState<'>=' | '>' | '<=' | '<'>('>=');
  const [newReqAttrValue, setNewReqAttrValue] = useState(1);
  const [newReqCategory, setNewReqCategory] = useState<CategoryId | ''>('');
  const [newReqOptionId, setNewReqOptionId] = useState('');

  // Reset form when editing option changes
  useEffect(() => {
    if (editingOption) {
      setFormData({ ...editingOption.option });
      setTraitsInput(editingOption.option.traits?.join(', ') ?? '');
      setError(null);
      setShowAddRequirement(false);
    }
  }, [editingOption]);

  // Collect all unique traits from all options
  const allTraits = useMemo(() => {
    if (!characterData) return [];
    const traits = new Set<string>();
    for (const cat of characterData.categories) {
      for (const opt of cat.options) {
        if (opt.traits) {
          for (const t of opt.traits) {
            traits.add(t);
          }
        }
      }
    }
    return [...traits].sort();
  }, [characterData]);

  if (!editingOption) return null;

  // Get existing subcategories for this category
  const category = characterData?.categories.find(c => c.id === editingOption.categoryId);
  const existingSubcategories = category
    ? [...new Set(category.options.map(o => o.subcategory).filter(Boolean))]
    : [];

  // Get other options in same category (for incompatibleWith)
  const otherOptionsInCategory = category
    ? category.options.filter(o => o.id !== formData.id)
    : [];

  // Format a requirement for display
  const formatRequirement = (req: OptionRequirement): string => {
    if (req.trait) return `Has trait: ${req.trait}`;
    if (req.notTrait) return `NOT trait: ${req.notTrait}`;
    if (req.attribute) {
      const attrName = req.attribute.id.charAt(0).toUpperCase() + req.attribute.id.slice(1);
      return `${attrName} ${req.attribute.op} ${req.attribute.value}`;
    }
    if (req.selection) {
      const cat = characterData?.categories.find(c => c.id === req.selection!.category);
      const opt = cat?.options.find(o => o.id === req.selection!.optionId);
      return `Selected: ${opt?.name ?? req.selection.optionId} (${cat?.name ?? req.selection.category})`;
    }
    if (req.notSelection) {
      const cat = characterData?.categories.find(c => c.id === req.notSelection!.category);
      const opt = cat?.options.find(o => o.id === req.notSelection!.optionId);
      return `NOT selected: ${opt?.name ?? req.notSelection.optionId} (${cat?.name ?? req.notSelection.category})`;
    }
    return 'Unknown requirement';
  };

  // Add a new requirement
  const addRequirement = () => {
    let newReq: OptionRequirement;

    switch (newReqType) {
      case 'trait':
        if (!newReqTrait.trim()) return;
        newReq = { trait: newReqTrait.trim() };
        break;
      case 'notTrait':
        if (!newReqTrait.trim()) return;
        newReq = { notTrait: newReqTrait.trim() };
        break;
      case 'attribute':
        newReq = { attribute: { id: newReqAttrId, op: newReqAttrOp, value: newReqAttrValue } };
        break;
      case 'selection':
        if (!newReqCategory || !newReqOptionId) return;
        newReq = { selection: { category: newReqCategory as CategoryId, optionId: newReqOptionId } };
        break;
      case 'notSelection':
        if (!newReqCategory || !newReqOptionId) return;
        newReq = { notSelection: { category: newReqCategory as CategoryId, optionId: newReqOptionId } };
        break;
    }

    setFormData(prev => ({
      ...prev,
      requires: [...(prev.requires ?? []), newReq],
    }));

    // Reset form
    setShowAddRequirement(false);
    setNewReqTrait('');
    setNewReqOptionId('');
  };

  // Remove a requirement by index
  const removeRequirement = (index: number) => {
    setFormData(prev => ({
      ...prev,
      requires: prev.requires?.filter((_, i) => i !== index),
    }));
  };

  // Toggle an option in incompatibleWith
  const toggleIncompatible = (optionId: string) => {
    setFormData(prev => {
      const current = prev.incompatibleWith ?? [];
      if (current.includes(optionId)) {
        return { ...prev, incompatibleWith: current.filter(id => id !== optionId) };
      } else {
        return { ...prev, incompatibleWith: [...current, optionId] };
      }
    });
  };

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

          {/* Prerequisites Section */}
          <div className="form-group">
            <label>Prerequisites</label>
            {formData.requires && formData.requires.length > 0 ? (
              <ul className="requirements-list">
                {formData.requires.map((req, idx) => (
                  <li key={idx} className="requirement-item">
                    <span>{formatRequirement(req)}</span>
                    <button
                      type="button"
                      className="btn-remove"
                      onClick={() => removeRequirement(idx)}
                      title="Remove requirement"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-requirements">No prerequisites</p>
            )}

            {!showAddRequirement ? (
              <button
                type="button"
                className="btn-add-requirement"
                onClick={() => setShowAddRequirement(true)}
              >
                + Add Prerequisite
              </button>
            ) : (
              <div className="add-requirement-form">
                <div className="form-row">
                  <select
                    value={newReqType}
                    onChange={e => {
                      setNewReqType(e.target.value as RequirementType);
                      setNewReqTrait('');
                      setNewReqOptionId('');
                    }}
                  >
                    <option value="trait">Has Trait</option>
                    <option value="notTrait">NOT Trait</option>
                    <option value="attribute">Attribute Check</option>
                    <option value="selection">Has Selection</option>
                    <option value="notSelection">NOT Selection</option>
                  </select>
                </div>

                {/* Trait input */}
                {(newReqType === 'trait' || newReqType === 'notTrait') && (
                  <div className="form-row">
                    <input
                      type="text"
                      value={newReqTrait}
                      onChange={e => setNewReqTrait(e.target.value)}
                      placeholder="trait-name"
                      list="all-traits-list"
                    />
                    <datalist id="all-traits-list">
                      {allTraits.map(t => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                )}

                {/* Attribute input */}
                {newReqType === 'attribute' && (
                  <div className="form-row attribute-requirement">
                    <select
                      value={newReqAttrId}
                      onChange={e => setNewReqAttrId(e.target.value as AttributeId)}
                    >
                      {ATTRIBUTE_IDS.map(attr => (
                        <option key={attr} value={attr}>
                          {attr.charAt(0).toUpperCase() + attr.slice(1)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newReqAttrOp}
                      onChange={e => setNewReqAttrOp(e.target.value as '>=' | '>' | '<=' | '<')}
                    >
                      {OPERATORS.map(op => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={newReqAttrValue}
                      onChange={e => setNewReqAttrValue(parseInt(e.target.value) || 0)}
                      min={-10}
                      max={10}
                    />
                  </div>
                )}

                {/* Selection input */}
                {(newReqType === 'selection' || newReqType === 'notSelection') && (
                  <div className="form-row selection-requirement">
                    <select
                      value={newReqCategory}
                      onChange={e => {
                        setNewReqCategory(e.target.value as CategoryId);
                        setNewReqOptionId('');
                      }}
                    >
                      <option value="">Select category...</option>
                      {characterData?.categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    {newReqCategory && (
                      <select
                        value={newReqOptionId}
                        onChange={e => setNewReqOptionId(e.target.value)}
                      >
                        <option value="">Select option...</option>
                        {characterData?.categories
                          .find(c => c.id === newReqCategory)
                          ?.options.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                          ))}
                      </select>
                    )}
                  </div>
                )}

                <div className="form-row requirement-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowAddRequirement(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn-primary" onClick={addRequirement}>
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Incompatibilities Section */}
          {otherOptionsInCategory.length > 0 && (
            <div className="form-group">
              <label>Incompatible With (same category)</label>
              <div className="incompatible-options">
                {otherOptionsInCategory.map(opt => (
                  <label key={opt.id} className="incompatible-checkbox">
                    <input
                      type="checkbox"
                      checked={formData.incompatibleWith?.includes(opt.id) ?? false}
                      onChange={() => toggleIncompatible(opt.id)}
                    />
                    <span>{opt.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

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

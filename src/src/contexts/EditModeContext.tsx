import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { CharacterCreationData, CharacterOption, AppearanceConfig, AppearanceOption, NamesConfig, CategoryConfig, CategoryId } from '../types/game';
import { isEditorAvailable, saveCharacterCreation, saveAppearanceConfig, fetchAppearanceConfig, fetchCharacterCreation, fetchNamesConfig, addNameToList, deleteNameFromList } from '../api/editorApi';
import { namesConfig as staticNamesConfig } from '../data/namesConfig';

type AppearanceOptionType = 'build' | 'skinTone' | 'hairColor';

interface EditingAppearanceOption {
  option: AppearanceOption & { id: string };
  type: AppearanceOptionType;
}

interface EditModeContextType {
  editMode: boolean;
  editorAvailable: boolean;
  toggleEditMode: () => void;
  // Character data management
  characterData: CharacterCreationData | null;
  setCharacterData: (data: CharacterCreationData) => void;
  refreshCharacterData: () => Promise<void>;
  // Character option editing
  editingOption: { option: CharacterOption; categoryId: string } | null;
  startEditingOption: (option: CharacterOption, categoryId: string) => void;
  startCreatingOption: (categoryId: string, subcategory?: string) => void;
  cancelEditing: () => void;
  saveOption: (option: CharacterOption) => Promise<void>;
  deleteOption: (optionId: string, categoryId: string) => Promise<void>;
  currentCategoryId: string | null;
  isCreatingNew: boolean;
  newOptionSubcategory?: string;
  // Appearance config management
  appearanceData: AppearanceConfig | null;
  setAppearanceData: (data: AppearanceConfig) => void;
  refreshAppearanceConfig: () => Promise<void>;
  // Appearance option editing
  editingAppearanceOption: EditingAppearanceOption | null;
  startEditingAppearanceOption: (option: AppearanceOption & { id: string }, type: AppearanceOptionType) => void;
  startCreatingAppearanceOption: (type: AppearanceOptionType) => void;
  cancelAppearanceEditing: () => void;
  saveAppearanceOption: (option: AppearanceOption & { id: string }) => Promise<void>;
  deleteAppearanceOption: (optionId: string, type: AppearanceOptionType) => Promise<void>;
  isCreatingNewAppearance: boolean;
  currentAppearanceType: AppearanceOptionType | null;
  // Names management
  namesData: NamesConfig | null;
  addName: (sex: 'male' | 'female', race: string, name: string) => Promise<void>;
  deleteName: (sex: 'male' | 'female', race: string, name: string) => Promise<void>;
  // Category editing
  editingCategory: CategoryConfig | null;
  isCreatingNewCategory: boolean;
  startEditingCategory: (category: CategoryConfig) => void;
  startCreatingCategory: () => void;
  cancelCategoryEditing: () => void;
  saveCategory: (category: CategoryConfig, originalId?: CategoryId) => Promise<void>;
  deleteCategory: (categoryId: CategoryId) => Promise<void>;
  moveCategoryUp: (categoryId: CategoryId) => Promise<void>;
  moveCategoryDown: (categoryId: CategoryId) => Promise<void>;
}

const EditModeContext = createContext<EditModeContextType | null>(null);

export function useEditMode() {
  const context = useContext(EditModeContext);
  if (!context) {
    throw new Error('useEditMode must be used within EditModeProvider');
  }
  return context;
}

interface EditModeProviderProps {
  children: ReactNode;
  initialData: CharacterCreationData;
  initialAppearanceData: AppearanceConfig;
}

export function EditModeProvider({ children, initialData, initialAppearanceData }: EditModeProviderProps) {
  const [editMode, setEditMode] = useState(false);
  const [editorAvailable, setEditorAvailable] = useState(false);
  const [characterData, setCharacterData] = useState<CharacterCreationData>(initialData);
  const [appearanceData, setAppearanceData] = useState<AppearanceConfig>(initialAppearanceData);
  const [editingOption, setEditingOption] = useState<{ option: CharacterOption; categoryId: string } | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newOptionSubcategory, setNewOptionSubcategory] = useState<string | undefined>();

  // Appearance editing state
  const [editingAppearanceOption, setEditingAppearanceOption] = useState<EditingAppearanceOption | null>(null);
  const [isCreatingNewAppearance, setIsCreatingNewAppearance] = useState(false);

  // Names state
  const [namesData, setNamesData] = useState<NamesConfig>(staticNamesConfig);

  // Category editing state
  const [editingCategory, setEditingCategory] = useState<CategoryConfig | null>(null);
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);

  // Check if editor server is available on mount and load names
  useEffect(() => {
    isEditorAvailable().then(async (available) => {
      setEditorAvailable(available);
      if (available) {
        try {
          const data = await fetchNamesConfig() as NamesConfig;
          setNamesData(data);
        } catch (err) {
          console.error('Failed to fetch names config:', err);
        }
      }
    });
  }, []);

  const toggleEditMode = useCallback(() => {
    setEditMode(prev => !prev);
  }, []);

  // Character option editing
  const startEditingOption = useCallback((option: CharacterOption, categoryId: string) => {
    setEditingOption({ option, categoryId });
    setIsCreatingNew(false);
    setNewOptionSubcategory(undefined);
  }, []);

  const startCreatingOption = useCallback((categoryId: string, subcategory?: string) => {
    const newOption: CharacterOption = {
      id: `new-option-${Date.now()}`,
      name: '',
      description: '',
      subcategory,
    };
    setEditingOption({ option: newOption, categoryId });
    setIsCreatingNew(true);
    setNewOptionSubcategory(subcategory);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingOption(null);
    setIsCreatingNew(false);
    setNewOptionSubcategory(undefined);
  }, []);

  const saveOption = useCallback(async (option: CharacterOption) => {
    if (!editingOption) return;

    const categoryId = editingOption.categoryId;
    const updatedData = { ...characterData };
    const categoryIndex = updatedData.categories.findIndex(c => c.id === categoryId);

    if (categoryIndex === -1) {
      throw new Error(`Category ${categoryId} not found`);
    }

    const category = { ...updatedData.categories[categoryIndex] };

    if (isCreatingNew) {
      category.options = [...category.options, option];
    } else {
      const optionIndex = category.options.findIndex(o => o.id === editingOption.option.id);
      if (optionIndex === -1) {
        throw new Error(`Option ${editingOption.option.id} not found`);
      }
      category.options = [...category.options];
      category.options[optionIndex] = option;
    }

    updatedData.categories = [...updatedData.categories];
    updatedData.categories[categoryIndex] = category;

    await saveCharacterCreation(updatedData);
    setCharacterData(updatedData);
    setEditingOption(null);
    setIsCreatingNew(false);
    setNewOptionSubcategory(undefined);
  }, [editingOption, characterData, isCreatingNew]);

  const deleteOption = useCallback(async (optionId: string, categoryId: string) => {
    const updatedData = { ...characterData };
    const categoryIndex = updatedData.categories.findIndex(c => c.id === categoryId);

    if (categoryIndex === -1) {
      throw new Error(`Category ${categoryId} not found`);
    }

    const category = { ...updatedData.categories[categoryIndex] };
    category.options = category.options.filter(o => o.id !== optionId);

    updatedData.categories = [...updatedData.categories];
    updatedData.categories[categoryIndex] = category;

    await saveCharacterCreation(updatedData);
    setCharacterData(updatedData);
  }, [characterData]);

  // Appearance option editing
  const startEditingAppearanceOption = useCallback((option: AppearanceOption & { id: string }, type: AppearanceOptionType) => {
    setEditingAppearanceOption({ option, type });
    setIsCreatingNewAppearance(false);
  }, []);

  const startCreatingAppearanceOption = useCallback((type: AppearanceOptionType) => {
    const newOption: AppearanceOption & { id: string } = {
      id: `new-${type}-${Date.now()}`,
      name: '',
      description: '',
    };
    setEditingAppearanceOption({ option: newOption, type });
    setIsCreatingNewAppearance(true);
  }, []);

  const cancelAppearanceEditing = useCallback(() => {
    setEditingAppearanceOption(null);
    setIsCreatingNewAppearance(false);
  }, []);

  const saveAppearanceOption = useCallback(async (option: AppearanceOption & { id: string }) => {
    if (!editingAppearanceOption) return;

    const { type } = editingAppearanceOption;
    const updatedData = { ...appearanceData };

    // Get the correct array based on type
    const arrayKey = type === 'build' ? 'builds' : type === 'skinTone' ? 'skinTones' : 'hairColors';
    const optionArray = [...updatedData[arrayKey]] as (AppearanceOption & { id: string })[];

    if (isCreatingNewAppearance) {
      optionArray.push(option as typeof optionArray[0]);
    } else {
      const optionIndex = optionArray.findIndex(o => o.id === editingAppearanceOption.option.id);
      if (optionIndex === -1) {
        throw new Error(`Option ${editingAppearanceOption.option.id} not found`);
      }
      optionArray[optionIndex] = option as typeof optionArray[0];
    }

    (updatedData as Record<string, unknown>)[arrayKey] = optionArray;

    await saveAppearanceConfig(updatedData);
    setAppearanceData(updatedData);
    setEditingAppearanceOption(null);
    setIsCreatingNewAppearance(false);
  }, [editingAppearanceOption, appearanceData, isCreatingNewAppearance]);

  const deleteAppearanceOption = useCallback(async (optionId: string, type: AppearanceOptionType) => {
    const updatedData = { ...appearanceData };
    const arrayKey = type === 'build' ? 'builds' : type === 'skinTone' ? 'skinTones' : 'hairColors';

    (updatedData as Record<string, unknown>)[arrayKey] =
      (updatedData[arrayKey] as (AppearanceOption & { id: string })[]).filter(o => o.id !== optionId);

    await saveAppearanceConfig(updatedData);
    setAppearanceData(updatedData);
  }, [appearanceData]);

  // Refresh character data from server (used after option image acceptance)
  const refreshCharacterData = useCallback(async () => {
    try {
      const data = await fetchCharacterCreation() as CharacterCreationData;
      setCharacterData(data);
    } catch (err) {
      console.error('Failed to refresh character data:', err);
    }
  }, []);

  // Refresh appearance config from server (used after portrait generation)
  const refreshAppearanceConfig = useCallback(async () => {
    try {
      const data = await fetchAppearanceConfig() as AppearanceConfig;
      setAppearanceData(data);
    } catch (err) {
      console.error('Failed to refresh appearance config:', err);
    }
  }, []);

  // Add a name to a sex/race combination
  const addName = useCallback(async (sex: 'male' | 'female', race: string, name: string) => {
    await addNameToList(sex, race, name);
    // Refresh names data
    try {
      const data = await fetchNamesConfig() as NamesConfig;
      setNamesData(data);
    } catch (err) {
      console.error('Failed to refresh names after add:', err);
    }
  }, []);

  // Delete a name from a sex/race combination
  const deleteName = useCallback(async (sex: 'male' | 'female', race: string, name: string) => {
    await deleteNameFromList(sex, race, name);
    // Refresh names data
    try {
      const data = await fetchNamesConfig() as NamesConfig;
      setNamesData(data);
    } catch (err) {
      console.error('Failed to refresh names after delete:', err);
    }
  }, []);

  // Category editing functions
  const startEditingCategory = useCallback((category: CategoryConfig) => {
    setEditingCategory(category);
    setIsCreatingNewCategory(false);
  }, []);

  const startCreatingCategory = useCallback(() => {
    const newCategory: CategoryConfig = {
      id: `category-${Date.now()}` as CategoryId,
      name: 'New Category',
      description: '',
      minPicks: 0,
      maxPicks: 1,
      options: [],
    };
    setEditingCategory(newCategory);
    setIsCreatingNewCategory(true);
  }, []);

  const cancelCategoryEditing = useCallback(() => {
    setEditingCategory(null);
    setIsCreatingNewCategory(false);
  }, []);

  const saveCategory = useCallback(async (category: CategoryConfig, originalId?: CategoryId) => {
    const updatedData = { ...characterData };
    const idToFind = originalId || category.id;
    const categoryIndex = updatedData.categories.findIndex(c => c.id === idToFind);

    if (isCreatingNewCategory) {
      // Add new category at the end
      updatedData.categories = [...updatedData.categories, category];
    } else if (categoryIndex === -1) {
      throw new Error(`Category ${idToFind} not found`);
    } else {
      // Update existing category
      updatedData.categories = [...updatedData.categories];
      updatedData.categories[categoryIndex] = category;
    }

    await saveCharacterCreation(updatedData);
    setCharacterData(updatedData);
    setEditingCategory(null);
    setIsCreatingNewCategory(false);
  }, [characterData, isCreatingNewCategory]);

  const deleteCategory = useCallback(async (categoryId: CategoryId) => {
    const updatedData = { ...characterData };
    updatedData.categories = updatedData.categories.filter(c => c.id !== categoryId);

    await saveCharacterCreation(updatedData);
    setCharacterData(updatedData);
  }, [characterData]);

  const moveCategoryUp = useCallback(async (categoryId: CategoryId) => {
    const updatedData = { ...characterData };
    const categories = [...updatedData.categories];
    const index = categories.findIndex(c => c.id === categoryId);

    if (index > 0) {
      [categories[index - 1], categories[index]] = [categories[index], categories[index - 1]];
      updatedData.categories = categories;
      await saveCharacterCreation(updatedData);
      setCharacterData(updatedData);
    }
  }, [characterData]);

  const moveCategoryDown = useCallback(async (categoryId: CategoryId) => {
    const updatedData = { ...characterData };
    const categories = [...updatedData.categories];
    const index = categories.findIndex(c => c.id === categoryId);

    if (index < categories.length - 1) {
      [categories[index], categories[index + 1]] = [categories[index + 1], categories[index]];
      updatedData.categories = categories;
      await saveCharacterCreation(updatedData);
      setCharacterData(updatedData);
    }
  }, [characterData]);

  const value: EditModeContextType = {
    editMode,
    editorAvailable,
    toggleEditMode,
    characterData,
    setCharacterData,
    refreshCharacterData,
    editingOption,
    startEditingOption,
    startCreatingOption,
    cancelEditing,
    saveOption,
    deleteOption,
    currentCategoryId: editingOption?.categoryId ?? null,
    isCreatingNew,
    newOptionSubcategory,
    // Appearance
    appearanceData,
    setAppearanceData,
    refreshAppearanceConfig,
    editingAppearanceOption,
    startEditingAppearanceOption,
    startCreatingAppearanceOption,
    cancelAppearanceEditing,
    saveAppearanceOption,
    deleteAppearanceOption,
    isCreatingNewAppearance,
    currentAppearanceType: editingAppearanceOption?.type ?? null,
    // Names
    namesData,
    addName,
    deleteName,
    // Category editing
    editingCategory,
    isCreatingNewCategory,
    startEditingCategory,
    startCreatingCategory,
    cancelCategoryEditing,
    saveCategory,
    deleteCategory,
    moveCategoryUp,
    moveCategoryDown,
  };

  return (
    <EditModeContext.Provider value={value}>
      {children}
    </EditModeContext.Provider>
  );
}

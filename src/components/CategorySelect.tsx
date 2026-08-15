import { useState, useRef, useEffect } from "react";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { useFirebaseMutation as useMutation } from "../lib/firebase/mutations";
import { api, type Id } from "../lib/firebase/operations";
import { Plus, Check, X, Trash2 } from "lucide-react";
import { getErrorMessage } from "../lib/utils";
import { toast } from "sonner";

interface CategorySelectProps {
  businessId: Id<"businesses">;
  value: string;
  onChange: (value: string) => void;
}

export function CategorySelect({ businessId, value, onChange }: CategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const categories = useQuery(api.categories.getBusinessCategories, { businessId });
  const createCategory = useMutation(api.categories.createCategory);
  const deleteCategory = useMutation(api.categories.deleteCategory);

  // Find selected category name
  const selectedCategory = categories?.find((c) => c._id === value);

  // Sync inputValue with selected category
  useEffect(() => {
    if (selectedCategory && !inputValue) {
      setInputValue(selectedCategory.name);
    }
  }, [selectedCategory, inputValue]);

  const displayName = selectedCategory?.name || inputValue || value;

  // Filter categories based on input
  const filteredCategories = categories?.filter((cat) =>
    cat.name.toLowerCase().includes(inputValue.toLowerCase())
  ) || [];

  // Check if input matches an existing category
  const exactMatch = categories?.find((cat) =>
    cat.name.toLowerCase() === inputValue.toLowerCase()
  );

  // Can add new category if input is not empty and no exact match
  const canAdd = inputValue.trim() && !exactMatch;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (categoryId: string, name: string) => {
    onChange(categoryId);
    setInputValue(name);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setInputValue("");
    inputRef.current?.focus();
  };

  const handleAddNew = async () => {
    if (!canAdd || isAdding) return;

    setIsAdding(true);
    try {
      const categoryId = await createCategory({
        businessId,
        name: inputValue.trim(),
      });
      handleSelect(categoryId, inputValue.trim());
      toast.success("Category added!");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteCategory = async (categoryId: Id<"categories">, categoryName: string) => {
    if (!confirm(`Delete "${categoryName}"? Products will become uncategorised.`)) return;
    try {
      await deleteCategory({ categoryId });
      if (value === categoryId) onChange("");
      toast.success("Category deleted");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);

    // If we have an exact match, auto-select it
    const match = categories?.find(
      (cat) => cat.name.toLowerCase() === newValue.toLowerCase()
    );
    if (match) {
      onChange(match._id);
    } else {
      onChange("");
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Category
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder="Select or type a category..."
          className="w-full px-4 py-3 pr-20 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
        />

        {/* Clear button */}
        {displayName && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Dropdown indicator */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
        >
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {/* Add new category option */}
          {canAdd && (
            <button
              type="button"
              onClick={handleAddNew}
              disabled={isAdding}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2 text-primary disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium">
                Add "{inputValue.trim()}"
              </span>
              {isAdding && (
                <div className="ml-auto">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                </div>
              )}
            </button>
          )}

          {/* Existing categories */}
          {filteredCategories.length === 0 && !canAdd ? (
            <div className="px-4 py-3 text-gray-500 text-sm">
              {categories?.length === 0
                ? "No categories yet. Type to create one!"
                : "No matching categories"}
            </div>
          ) : (
            filteredCategories.map((category) => (
              <div
                key={category._id}
                className={`flex items-center gap-1 px-2 ${
                  value === category._id ? "bg-primary/5" : ""
                } hover:bg-gray-50`}
              >
                <button
                  type="button"
                  onClick={() => handleSelect(category._id, category.name)}
                  className="flex-1 px-2 py-3 text-left flex items-center gap-2"
                >
                  <span className="flex-1">{category.name}</span>
                  {value === category._id && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCategory(category._id as Id<"categories">, category.name);
                  }}
                  className="p-1.5 rounded-lg hover:bg-red-50 transition opacity-40 hover:opacity-100"
                  aria-label={`Delete ${category.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Selected indicator */}
      {value && selectedCategory && (
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
          <Check className="w-3 h-3" />
          {selectedCategory.name}
        </p>
      )}
    </div>
  );
}

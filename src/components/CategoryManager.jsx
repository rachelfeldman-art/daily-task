import React, { useState } from 'react';
import { useDataContext } from '../contexts/DataContext.jsx';
import { API_BASE, DEFAULT_CATEGORIES } from '../utils/constants.js';
import { getCategoryStyle } from '../utils/styles.js';
import { Check, X, Pencil } from './Icons.jsx';

export const CategoryManager = React.memo(function CategoryManager() {
  const { customCategories, setCustomCategories, items, setItems } = useDataContext();
  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories.map(c => c.name)];

  const [newCategory, setNewCategory] = useState('');
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('📌');
  const [editingCategory, setEditingCategory] = useState(null);
  const [error, setError] = useState('');

  const addCustomCategory = async () => {
    if (!newCategory.trim()) return;
    const categoryName = newCategory.toLowerCase().trim();
    const emojiVal = (newCategoryEmoji && String(newCategoryEmoji).trim()) ? String(newCategoryEmoji).trim().slice(0, 10) : '📌';
    if (allCategories.includes(categoryName)) {
      setError('Category already exists');
      return;
    }
    try {
      await fetch(`${API_BASE}/api/custom-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: categoryName, emoji: emojiVal })
      });
      setCustomCategories([...customCategories, { name: categoryName, emoji: emojiVal }]);
      setNewCategory('');
      setNewCategoryEmoji('📌');
      setError('');
    } catch (err) {
      setError('Failed to add category');
    }
  };

  const updateCustomCategory = async (oldName, { name, emoji }) => {
    try {
      await fetch(`${API_BASE}/api/custom-categories/${encodeURIComponent(oldName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name || oldName, emoji })
      });
      const next = customCategories.map(c =>
        c.name === oldName ? { name: name && name.trim() ? name.trim() : oldName, emoji: emoji || '📌' } : c
      );
      if (name && name.trim() && name.trim() !== oldName) {
        setItems(prev => prev.map(it => it.category === oldName ? { ...it, category: name.trim() } : it));
      }
      setCustomCategories(next);
      setEditingCategory(null);
      setError('');
    } catch (err) {
      setError('Failed to update category');
    }
  };

  const deleteCustomCategory = async (category) => {
    try {
      await fetch(`${API_BASE}/api/custom-categories/${encodeURIComponent(category)}`, { method: 'DELETE', credentials: 'include' });
      setCustomCategories(customCategories.filter(c => c.name !== category));
      setError('');
    } catch (err) {
      console.log('Failed to delete category:', err);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h3 className="font-bold text-gray-800 mb-4">Manage Categories</h3>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Default Categories</label>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_CATEGORIES.map(cat => {
            const s = getCategoryStyle(cat, customCategories);
            return (
              <span key={cat} className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: s.badgeBg, color: s.badgeText }}>
                {s.emoji} {cat}
              </span>
            );
          })}
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Custom Categories</label>
        <div className="flex flex-wrap gap-2 mb-2">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomCategory()}
            placeholder="New category name..."
            className="flex-1 min-w-[140px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            value={newCategoryEmoji}
            onChange={(e) => setNewCategoryEmoji(e.target.value)}
            placeholder="📌"
            className="w-12 px-2 py-2 border border-gray-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
            title="Category emoji"
          />
          <button
            onClick={addCustomCategory}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 font-medium"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {customCategories.map(cat => {
            const isEditing = editingCategory && editingCategory.oldName === cat.name;
            const s = getCategoryStyle(cat.name, customCategories);
            if (isEditing) {
              const draft = editingCategory;
              return (
                <span key={cat.name} className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2" style={{ backgroundColor: s.badgeBg, color: s.badgeText }}>
                  <input
                    type="text"
                    value={draft.emoji}
                    onChange={(e) => setEditingCategory({ ...draft, emoji: e.target.value })}
                    className="w-8 px-1 py-0.5 rounded bg-white/80 border border-gray-300 text-center"
                  />
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => setEditingCategory({ ...draft, name: e.target.value })}
                    className="w-24 px-2 py-0.5 rounded bg-white/80 border border-gray-300"
                  />
                  <button onClick={() => updateCustomCategory(draft.oldName, { name: draft.name.trim() || draft.oldName, emoji: draft.emoji || '📌' })} className="hover:opacity-80" title="Save"><Check size={14} /></button>
                  <button onClick={() => setEditingCategory(null)} className="hover:opacity-80" title="Cancel"><X size={14} /></button>
                </span>
              );
            }
            return (
              <span key={cat.name} className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2" style={{ backgroundColor: s.badgeBg, color: s.badgeText }}>
                {s.emoji} {cat.name}
                <button onClick={() => setEditingCategory({ oldName: cat.name, name: cat.name, emoji: cat.emoji || '📌' })} className="hover:opacity-80" title="Edit"><Pencil size={14} /></button>
                <button onClick={() => deleteCustomCategory(cat.name)} className="hover:opacity-80" title="Remove"><X size={14} /></button>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
});

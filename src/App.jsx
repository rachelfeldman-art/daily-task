import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { SignIn, useAuth } from '@clerk/clerk-react';
import { API_BASE, DEFAULT_CATEGORIES } from './utils/constants.js';
import { toLocalDateString, groupFilteredItemsByDueDate } from './utils/dates.js';
import { fireConfetti } from './utils/confetti.js';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { DataContext } from './contexts/DataContext.jsx';
import { DragContext } from './contexts/DragContext.jsx';
import { Header } from './components/Header.jsx';
import { FilterBar } from './components/FilterBar.jsx';
import { CompletedToggle } from './components/CompletedToggle.jsx';
import { CategoryManager } from './components/CategoryManager.jsx';
import { VoiceTextInput } from './components/VoiceTextInput.jsx';
import { TaskGroup } from './components/TaskGroup.jsx';
import { TaskItemCard } from './components/TaskItemCard.jsx';
import { CustomDateDropZone } from './components/CustomDateDropZone.jsx';

function VoiceTaskManager() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [error, setError] = useState('');
  const [learningData, setLearningData] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [customCategories, setCustomCategories] = useState([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [justCompletedId, setJustCompletedId] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [dragOverGroupKey, setDragOverGroupKey] = useState(null);
  const [customDropDate, setCustomDropDate] = useState('');
  const [isCustomDateDragOver, setIsCustomDateDragOver] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState('all');
  const [loadError, setLoadError] = useState(null);
  const suppressGroupToggleRef = useRef(false);

  useEffect(() => {
    loadItems();
    loadLearningData();
    loadCustomCategories();
  }, []);

  const loadItems = async () => {
    setLoadError(null);
    try {
      const res = await fetch(`${API_BASE}/api/items`, { credentials: 'include' });
      if (res.ok) {
        setItems(await res.json());
      } else {
        setLoadError(res.status === 401 ? 'Please sign in again.' : `Could not load tasks (${res.status}).`);
      }
    } catch (err) {
      console.log('Failed to load items:', err);
      setLoadError('Could not load tasks. Is the server running? (npm run dev:server)');
    }
  };

  const loadLearningData = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/learning-data`, { credentials: 'include' });
      if (res.ok) setLearningData(await res.json());
    } catch (err) {
      console.log('Failed to load learning data:', err);
    }
  };

  const loadCustomCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/custom-categories`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data)
          ? data.map(row => (typeof row === 'string' ? { name: row, emoji: '📌' } : { name: row.name, emoji: row.emoji || '📌' }))
          : [];
        setCustomCategories(list);
      }
    } catch (err) {
      console.log('Failed to load custom categories:', err);
    }
  };

  const allCategories = useMemo(() =>
    [...DEFAULT_CATEGORIES, ...customCategories.map(c => c.name)],
    [customCategories]
  );

  const toggleComplete = async (id, e) => {
    e.stopPropagation();
    const item = items.find(i => i.id === id);
    if (!item) return;
    const updated = { ...item, completed: !item.completed };
    if (updated.completed) {
      fireConfetti(e.currentTarget);
      setJustCompletedId(id);
      setTimeout(() => setJustCompletedId(null), 400);
    }
    try {
      await fetch(`${API_BASE}/api/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updated)
      });
      setItems(items.map(i => i.id === id ? updated : i));
    } catch (err) {
      setError('Failed to update item');
    }
  };

  const deleteItem = async (id, e) => {
    e.stopPropagation();
    try {
      await fetch(`${API_BASE}/api/items/${id}`, { method: 'DELETE', credentials: 'include' });
      setItems(items.filter(item => item.id !== id));
    } catch (err) {
      setError('Failed to delete item');
    }
  };

  const saveItemEdit = async (updatedItem, editValues) => {
    try {
      await fetch(`${API_BASE}/api/items/${updatedItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updatedItem)
      });
      setItems(items.map(i => i.id === updatedItem.id ? updatedItem : i));
    } catch (err) {
      setError('Failed to save edit');
    }
    try {
      await fetch(`${API_BASE}/api/learning-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text: editValues.text,
          type: editValues.type,
          category: editValues.category,
          priority: editValues.priority
        })
      });
      setLearningData(prev => [...prev, { text: editValues.text, type: editValues.type, category: editValues.category, priority: editValues.priority, timestamp: new Date().toISOString() }]);
    } catch (err) {
      console.log('Failed to save learning data:', err);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (!draggedItem) return;
    const groupItems = items.filter(i => (i.dueDate || null) === (draggedItem.dueDate || null));
    if (groupItems.length > 0) {
      fetch(`${API_BASE}/api/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(groupItems)
      }).catch(err => console.log('Failed to save reorder:', err));
    }
  };

  const matchesPeriod = useCallback((item) => {
    if (statsPeriod === 'all' || statsPeriod === 'hide') return true;
    if (!item.dueDate) return false;
    const now = new Date();
    const todayStr = toLocalDateString(now);
    if (statsPeriod === 'today') return item.dueDate === todayStr;
    if (statsPeriod === 'week') {
      const dayOfWeek = now.getDay();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return item.dueDate >= toLocalDateString(weekStart) && item.dueDate <= toLocalDateString(weekEnd);
    }
    if (statsPeriod === 'month') return item.dueDate.startsWith(todayStr.substring(0, 7));
    return true;
  }, [statsPeriod]);

  const sortedItems = useMemo(() => [...items].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return new Date(b.createdAt) - new Date(a.createdAt);
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  }), [items]);

  const filteredItems = useMemo(() => sortedItems.filter(item => {
    if (filter !== 'all' && item.type !== filter) return false;
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (!showCompleted && item.completed) return false;
    if (!matchesPeriod(item)) return false;
    return true;
  }), [sortedItems, filter, categoryFilter, showCompleted, matchesPeriod]);

  const groupedItems = useMemo(() => groupFilteredItemsByDueDate(filteredItems), [filteredItems]);

  const stats = useMemo(() => {
    if (statsPeriod === 'hide') return { total: 0, tasks: 0, ideas: 0, completed: 0 };
    const filtered = items.filter(matchesPeriod);
    return {
      total: filtered.length,
      tasks: filtered.filter(i => i.type === 'task').length,
      ideas: filtered.filter(i => i.type === 'idea').length,
      completed: filtered.filter(i => i.completed).length
    };
  }, [items, statsPeriod, matchesPeriod]);

  const completedCount = useMemo(() => items.filter(i => i.completed).length, [items]);

  const toggleGroup = (key) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleGroupDragOver = (e, groupKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverGroupKey !== groupKey) setDragOverGroupKey(groupKey);
  };

  const handleGroupDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverGroupKey(null);
  };

  const handleGroupDrop = async (e, groupKey) => {
    e.preventDefault();
    e.stopPropagation();
    suppressGroupToggleRef.current = true;
    setTimeout(() => { suppressGroupToggleRef.current = false; }, 0);
    setDragOverGroupKey(null);
    if (!draggedItem) return;
    let newDueDate;
    if (groupKey === 'no-date') newDueDate = null;
    else if (groupKey === 'overdue') {
      const yesterday = new Date(`${toLocalDateString()}T12:00:00`);
      yesterday.setDate(yesterday.getDate() - 1);
      newDueDate = toLocalDateString(yesterday);
    } else newDueDate = groupKey;
    if ((draggedItem.dueDate || null) === newDueDate) {
      setDraggedItem(null);
      return;
    }
    const targetGroupItems = items
      .filter(i => i.id !== draggedItem.id && (i.dueDate || null) === newDueDate)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const updated = { ...draggedItem, dueDate: newDueDate, order: targetGroupItems.length };
    try {
      await fetch(`${API_BASE}/api/items/${draggedItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updated)
      });
      setItems(items.map(i => i.id === draggedItem.id ? updated : i));
    } catch (err) {
      setError('Failed to update due date');
    }
    setDraggedItem(null);
  };

  const dataContextValue = useMemo(() => ({
    items, setItems, customCategories, setCustomCategories,
    learningData, setLearningData, allCategories
  }), [items, customCategories, learningData, allCategories]);

  const dragContextValue = useMemo(() => ({
    draggedItem, setDraggedItem, dragOverGroupKey, setDragOverGroupKey,
    customDropDate, setCustomDropDate, isCustomDateDragOver, setIsCustomDateDragOver,
    suppressGroupToggleRef
  }), [draggedItem, dragOverGroupKey, customDropDate, isCustomDateDragOver]);

  return (
    <ErrorBoundary>
      <DataContext.Provider value={dataContextValue}>
        <DragContext.Provider value={dragContextValue}>
          <div className="min-h-screen p-4">
            <div className="max-w-4xl mx-auto">
              <Header
                statsPeriod={statsPeriod}
                setStatsPeriod={setStatsPeriod}
                stats={stats}
                showCategoryManager={showCategoryManager}
                setShowCategoryManager={setShowCategoryManager}
              />

              {showCategoryManager && <CategoryManager />}

              <VoiceTextInput />

              <FilterBar filter={filter} setFilter={setFilter} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} />

              <div className="space-y-6">
                <CustomDateDropZone />
                {loadError ? (
                  <div className="bg-[#FFFBF7] rounded-2xl border border-[#E6D8C3]/80 p-8 text-center">
                    <p className="text-red-600 mb-3">{loadError}</p>
                    <button
                      type="button"
                      onClick={() => { loadItems(); loadLearningData(); loadCustomCategories(); }}
                      className="px-4 py-2 bg-[#4F7C59] text-white rounded-xl font-medium hover:opacity-95"
                    >
                      Retry
                    </button>
                  </div>
                ) : groupedItems.length === 0 ? (
                  <div className="bg-[#FFFBF7] rounded-2xl border border-[#E6D8C3]/80 p-8 text-center text-[#6B6560]">
                    No items found. Add your first task or idea!
                  </div>
                ) : (
                  groupedItems.map(group => (
                    <TaskGroup
                      key={group.key}
                      group={group}
                      collapsed={collapsedGroups.has(group.key)}
                      onToggle={() => toggleGroup(group.key)}
                      onDragOver={handleGroupDragOver}
                      onDragLeave={handleGroupDragLeave}
                      onDrop={handleGroupDrop}
                    >
                      {group.items.map(item => (
                        <TaskItemCard
                          key={item.id}
                          item={item}
                          onToggleComplete={toggleComplete}
                          onDelete={deleteItem}
                          onSave={saveItemEdit}
                          onDrop={handleDrop}
                          justCompleted={justCompletedId === item.id}
                        />
                      ))}
                    </TaskGroup>
                  ))
                )}
              </div>

              {completedCount > 0 && (
                <CompletedToggle showCompleted={showCompleted} setShowCompleted={setShowCompleted} completedCount={completedCount} />
              )}
            </div>
          </div>
        </DragContext.Provider>
      </DataContext.Provider>
    </ErrorBoundary>
  );
}

function App() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)]">
        <p className="text-[#6B6560]">Loading...</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)]">
        <SignIn />
      </div>
    );
  }

  return <VoiceTaskManager />;
}

export default App;

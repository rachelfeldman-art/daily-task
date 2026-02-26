import React from 'react';
import { useDataContext } from '../contexts/DataContext.jsx';
import { useDragContext } from '../contexts/DragContext.jsx';
import { API_BASE } from '../utils/constants.js';

export const CustomDateDropZone = React.memo(function CustomDateDropZone() {
  const { items, setItems } = useDataContext();
  const {
    draggedItem,
    setDraggedItem,
    customDropDate,
    setCustomDropDate,
    isCustomDateDragOver,
    setIsCustomDateDragOver
  } = useDragContext();

  const handleCustomDateDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isCustomDateDragOver) setIsCustomDateDragOver(true);
  };

  const handleCustomDateDragLeave = (e) => {
    const related = e.relatedTarget;
    if (!e.currentTarget.contains(related)) setIsCustomDateDragOver(false);
  };

  const handleCustomDateDrop = async (e) => {
    e.preventDefault();
    setIsCustomDateDragOver(false);
    if (!draggedItem || !customDropDate) return;
    if ((draggedItem.dueDate || null) === customDropDate) {
      setDraggedItem(null);
      return;
    }

    const targetGroupItems = items
      .filter(i => i.id !== draggedItem.id && (i.dueDate || null) === customDropDate)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const updated = { ...draggedItem, dueDate: customDropDate, order: targetGroupItems.length };

    // Optimistic update
    setItems(items.map(i => i.id === draggedItem.id ? updated : i));

    try {
      const res = await fetch(`${API_BASE}/api/items/${draggedItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updated)
      });
      if (!res.ok) throw new Error('Failed to update');
    } catch (err) {
      // Rollback on failure
      setItems(items.map(i => i.id === draggedItem.id ? draggedItem : i));
      console.error('Failed to update due date:', err);
    }
    setDraggedItem(null);
  };

  if (!draggedItem) return null;

  return (
    <div
      onDragOver={handleCustomDateDragOver}
      onDragLeave={handleCustomDateDragLeave}
      onDrop={handleCustomDateDrop}
      className={`rounded-xl border-2 border-dashed p-4 transition-all ${isCustomDateDragOver ? 'border-[#3F6C7A] bg-[#E6D8C3]/45 ring-2 ring-[#3F6C7A]' : 'border-[#C8B99F] bg-[#FFFBF7]'}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-[#2D2A26] font-medium">
          Drop to set custom date:
        </span>
        <input
          type="date"
          value={customDropDate}
          onChange={(e) => setCustomDropDate(e.target.value)}
          className="px-3 py-2 bg-[#FFFBF7] border border-[#E6D8C3] rounded-xl text-sm text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#3F6C7A]/50"
        />
        <span className="text-xs text-[#6B6560]">Choose any date, then drop the card here.</span>
      </div>
    </div>
  );
});

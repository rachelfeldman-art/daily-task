import React, { useState, useCallback } from 'react';
import { useDataContext } from '../contexts/DataContext.jsx';
import { useDragContext } from '../contexts/DragContext.jsx';
import { getCategoryStyle, getCardBackground } from '../utils/styles.js';
import { toLocalDateString } from '../utils/dates.js';
import { Check, GripVertical, FileText, Trash2 } from './Icons.jsx';
import { TaskItemCardEditForm } from './TaskItemCardEditForm.jsx';

function TaskItemCardComponent({
  item,
  onToggleComplete,
  onDelete,
  onSave,
  onDrop,
  justCompleted
}) {
  const { items, setItems, allCategories, customCategories } = useDataContext();
  const { draggedItem, setDraggedItem, setDragOverGroupKey, setIsCustomDateDragOver, setCustomDropDate } = useDragContext();

  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({});
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  const catStyle = getCategoryStyle(item.category, customCategories);
  const isDragging = draggedItem?.id === item.id;

  const startEditing = useCallback(() => {
    setIsEditing(true);
    setEditValues({
      text: item.text,
      type: item.type,
      category: item.category,
      priority: item.priority,
      dueDate: item.dueDate || '',
      notes: item.notes || ''
    });
  }, [item]);

  const saveEdit = useCallback(() => {
    const updated = { ...item, ...editValues };
    if (updated.category === 'work' && !updated.dueDate) updated.dueDate = toLocalDateString();
    onSave(updated, editValues);
    setIsEditing(false);
  }, [item, editValues, onSave]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleDragStart = useCallback((e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id.toString());
    setTimeout(() => {
      setDraggedItem(item);
      setCustomDropDate(item.dueDate || toLocalDateString());
    }, 0);
  }, [item, setDraggedItem, setCustomDropDate]);

  const handleDragOver = useCallback((e, targetItem) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === targetItem.id) return;
    if ((draggedItem.dueDate || null) !== (targetItem.dueDate || null)) return;
    const sameDueDateItems = items
      .filter(i => (i.dueDate || null) === (targetItem.dueDate || null))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const draggedIdx = sameDueDateItems.findIndex(i => i.id === draggedItem.id);
    const targetIdx = sameDueDateItems.findIndex(i => i.id === targetItem.id);
    if (draggedIdx === -1 || targetIdx === -1 || draggedIdx === targetIdx) return;
    const reorderedGroup = [...sameDueDateItems];
    const [moved] = reorderedGroup.splice(draggedIdx, 1);
    reorderedGroup.splice(targetIdx, 0, moved);
    const orderById = new Map(reorderedGroup.map((it, idx) => [it.id, idx]));
    setItems(items.map(it => (orderById.has(it.id) ? { ...it, order: orderById.get(it.id) } : it)));
  }, [draggedItem, items, setItems]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    if (!draggedItem) return;
    onDrop();
  }, [draggedItem, onDrop]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverGroupKey(null);
    setIsCustomDateDragOver(false);
  }, [setDraggedItem, setDragOverGroupKey, setIsCustomDateDragOver]);

  const toggleNotes = useCallback((e) => {
    e.stopPropagation();
    setIsNotesExpanded(prev => !prev);
  }, []);

  const handleCardClick = useCallback(() => {
    if (!isEditing) startEditing();
  }, [isEditing, startEditing]);

  return (
    <div
      draggable={!isEditing}
      onDragStart={handleDragStart}
      onDragOver={(e) => handleDragOver(e, item)}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      className={`rounded-2xl border-l-8 transition-all duration-200 ${item.completed ? 'opacity-60' : ''} ${isDragging ? 'opacity-50 scale-95 rotate-1' : 'hover:scale-[1.02]'}`}
      style={{
        backgroundColor: getCardBackground(item),
        borderLeftColor: catStyle.border,
        boxShadow: isDragging ? 'none' : undefined
      }}
      onMouseEnter={(e) => {
        if (!item.completed && !isDragging) e.currentTarget.style.boxShadow = `0 4px 20px ${catStyle.border}30`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '';
      }}
    >
      <div className="p-4 cursor-pointer" onClick={handleCardClick}>
        <div className="flex items-start gap-3">
          <div className="mt-1 cursor-grab active:cursor-grabbing text-[#6B6560] hover:text-[#2D2A26]">
            <GripVertical size={20} />
          </div>
          <button
            onClick={(e) => onToggleComplete(item.id, e)}
            className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${justCompleted ? 'checkbox-pop-anim' : ''} ${item.completed ? 'bg-[#4F7C59] border-[#4F7C59]' : 'border-[#E6D8C3] hover:border-[#4F7C59]'}`}
          >
            {item.completed && <Check size={14} className="text-white" />}
          </button>
          <div className="flex-1 min-w-0" onClick={(e) => isEditing && e.stopPropagation()}>
            {isEditing ? (
              <TaskItemCardEditForm
                editValues={editValues}
                setEditValues={setEditValues}
                allCategories={allCategories}
                onSave={saveEdit}
                onCancel={cancelEdit}
              />
            ) : (
              <>
                <p className={`text-lg font-semibold text-[#2D2A26] mb-2 ${item.completed ? 'line-through opacity-80' : ''}`}>
                  {catStyle.emoji} {item.text}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${item.priority === 'high' ? 'priority-dot-pulse' : ''}`}
                      style={{
                        backgroundColor: item.priority === 'high' ? '#C65D3B' : item.priority === 'medium' ? '#3F6C7A' : '#5E6B73'
                      }}
                    />
                    <span className="text-xs font-bold uppercase text-[#6B6560]">{item.priority}</span>
                  </span>
                  <span className="text-[#E6D8C3]">|</span>
                  <span
                    className="px-2 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: catStyle.badgeBg, color: catStyle.badgeText }}
                  >
                    {catStyle.emoji} {item.category}
                  </span>
                  {item.notes && (
                    <button
                      onClick={toggleNotes}
                      className="px-2 py-1 rounded-full text-xs font-medium bg-[#E6D8C3]/50 text-[#6B6560] hover:bg-[#E6D8C3]/70 flex items-center gap-1"
                    >
                      <FileText size={12} /> note
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          <button
            onClick={(e) => onDelete(item.id, e)}
            className="flex-shrink-0 p-2 text-[#6B6560] hover:text-[#C65D3B] transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      {isNotesExpanded && item.notes && (
        <div className="px-4 pb-4 pt-0">
          <div className="pl-9 text-sm text-[#6B6560] bg-[#FFFBF7] border border-[#E6D8C3] p-3 rounded-xl">
            {item.notes}
          </div>
        </div>
      )}
    </div>
  );
}

export const TaskItemCard = React.memo(TaskItemCardComponent, (prev, next) =>
  prev.item.id === next.item.id &&
  prev.item.completed === next.item.completed &&
  prev.item.text === next.item.text &&
  prev.item.notes === next.item.notes &&
  prev.item.dueDate === next.item.dueDate &&
  prev.item.order === next.item.order &&
  prev.item.type === next.item.type &&
  prev.item.category === next.item.category &&
  prev.item.priority === next.item.priority &&
  prev.justCompleted === next.justCompleted
);

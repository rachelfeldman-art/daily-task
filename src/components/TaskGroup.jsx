import React from 'react';
import { useDragContext } from '../contexts/DragContext.jsx';

export const TaskGroup = React.memo(function TaskGroup({ group, collapsed, onToggle, onDragOver, onDragLeave, onDrop, children }) {
  const { draggedItem, dragOverGroupKey, suppressGroupToggleRef } = useDragContext();

  const isDragOver = dragOverGroupKey === group.key;
  const headerBg = group.isToday ? 'rgba(194,168,62,0.22)' : group.isOverdue ? 'rgba(198,93,59,0.12)' : (group.dueDate === null ? 'rgba(94,107,115,0.12)' : '#E6D8C3');
  const dateSuffix = group.isToday ? (` · ${new Date(group.dueDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`) : '';

  const handleHeaderClick = () => {
    if (draggedItem || suppressGroupToggleRef.current) return;
    onToggle();
  };

  return (
    <div>
      <div
        onClick={handleHeaderClick}
        onDragOver={(e) => onDragOver(e, group.key)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, group.key)}
        className={`flex items-center justify-between rounded-xl border-2 px-4 py-2.5 cursor-pointer transition-all select-none ${isDragOver ? 'ring-2 ring-[#3F6C7A] border-[#3F6C7A]' : 'border-transparent'}`}
        style={{ backgroundColor: headerBg }}
      >
        <span className="font-medium text-[#2D2A26] flex items-center gap-2">
          <span className={`text-[#6B6560] transition-transform ${collapsed ? 'rotate-0' : 'rotate-90'}`}>▾</span>
          {group.label}{dateSuffix}
        </span>
        <span className="text-sm text-[#6B6560]">{isDragOver ? 'Drop to reschedule' : `${group.items.length} items`}</span>
      </div>
      {!collapsed && (
        <div className="space-y-3 mt-3">
          {children}
        </div>
      )}
    </div>
  );
});

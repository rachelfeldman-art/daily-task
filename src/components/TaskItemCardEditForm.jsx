import React from 'react';

const inputClass = 'px-3 py-2 bg-[#FFFBF7] border border-[#E6D8C3] rounded-xl text-sm text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#3F6C7A]/50';
const stopProp = (e) => e.stopPropagation();

export function TaskItemCardEditForm({ editValues, setEditValues, allCategories, onSave, onCancel }) {
  return (
    <div className="space-y-3">
      <input
        type="text"
        value={editValues.text}
        onChange={(e) => setEditValues(prev => ({ ...prev, text: e.target.value }))}
        className={`w-full ${inputClass} placeholder:text-[#6B6560]`}
        placeholder="Task title..."
        onClick={stopProp}
      />
      <div className="flex flex-wrap gap-2">
        <select value={editValues.type} onChange={(e) => setEditValues(prev => ({ ...prev, type: e.target.value }))} className={inputClass} onClick={stopProp}>
          <option value="task">Task</option>
          <option value="idea">Idea</option>
        </select>
        <select value={editValues.category} onChange={(e) => setEditValues(prev => ({ ...prev, category: e.target.value }))} className={inputClass} onClick={stopProp}>
          {allCategories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
        </select>
        <select value={editValues.priority} onChange={(e) => setEditValues(prev => ({ ...prev, priority: e.target.value }))} className={inputClass} onClick={stopProp}>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <input type="date" value={editValues.dueDate} onChange={(e) => setEditValues(prev => ({ ...prev, dueDate: e.target.value }))} className={inputClass} onClick={stopProp} />
      </div>
      <textarea value={editValues.notes} onChange={(e) => setEditValues(prev => ({ ...prev, notes: e.target.value }))} className={`w-full ${inputClass} placeholder:text-[#6B6560]`} placeholder="Add notes..." rows="3" onClick={stopProp} />
      <div className="flex gap-2">
        <button onClick={(e) => { e.stopPropagation(); onSave(); }} className="px-4 py-2 bg-[#4F7C59] text-white rounded-xl text-sm hover:opacity-95 font-medium">Save</button>
        <button onClick={(e) => { e.stopPropagation(); onCancel(); }} className="px-4 py-2 bg-[#E6D8C3]/60 text-[#2D2A26] rounded-xl text-sm hover:bg-[#E6D8C3] font-medium">Cancel</button>
      </div>
    </div>
  );
}

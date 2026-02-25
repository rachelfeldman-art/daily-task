import React from 'react';
import { useDataContext } from '../contexts/DataContext.jsx';
import { getCategoryStyle } from '../utils/styles.js';

export const FilterBar = React.memo(function FilterBar({ filter, setFilter, categoryFilter, setCategoryFilter }) {
  const { allCategories, customCategories } = useDataContext();
  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      <button
        onClick={() => setCategoryFilter('all')}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
          categoryFilter === 'all' ? 'bg-[#4A4642] text-white shadow-sm' : 'bg-[#E6D8C3]/50 text-[#6B6560] hover:bg-[#E6D8C3] hover:text-[#2D2A26] border border-[#E6D8C3]'
        }`}
      >
        All Categories
      </button>
      {allCategories.map(cat => {
        const s = getCategoryStyle(cat, customCategories);
        const active = categoryFilter === cat;
        return (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all border border-transparent hover:opacity-90"
            style={active ? { backgroundColor: s.border, color: 'white' } : { backgroundColor: s.badgeBg, color: s.badgeText, borderColor: 'transparent' }}
          >
            {s.emoji} {cat}
          </button>
        );
      })}

      <span className="w-full basis-full h-0 block" aria-hidden />

      <button
        onClick={() => setFilter('all')}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
          filter === 'all' ? 'bg-[#5E6B73] text-white shadow-sm' : 'bg-[#E6D8C3]/50 text-[#6B6560] hover:bg-[#E6D8C3] hover:text-[#2D2A26] border border-[#E6D8C3]'
        }`}
      >
        All
      </button>
      <button
        onClick={() => setFilter('task')}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
          filter === 'task' ? 'bg-[#3F6C7A] text-white shadow-sm' : 'bg-[#E6D8C3]/50 text-[#6B6560] hover:bg-[#E6D8C3] hover:text-[#2D2A26] border border-[#E6D8C3]'
        }`}
      >
        📋 Tasks
      </button>
      <button
        onClick={() => setFilter('idea')}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
          filter === 'idea' ? 'bg-[#C2A83E] text-white shadow-sm' : 'bg-[#E6D8C3]/50 text-[#6B6560] hover:bg-[#E6D8C3] hover:text-[#2D2A26] border border-[#E6D8C3]'
        }`}
      >
        💡 Ideas
      </button>
    </div>
  );
});

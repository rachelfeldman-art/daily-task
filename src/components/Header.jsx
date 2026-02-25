import React from 'react';
import { UserButton } from '@clerk/clerk-react';
import { Settings } from './Icons.jsx';

export const Header = React.memo(function Header({ statsPeriod, setStatsPeriod, stats, showCategoryManager, setShowCategoryManager }) {
  return (
    <header className="sticky top-0 z-20 -mx-4 px-4 pt-4 pb-3 mb-4 rounded-2xl backdrop-blur-md bg-[#FFFBF7]/85 border border-[#E6D8C3]/60 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="header-title text-2xl font-normal text-[#2D2A26] flex items-center gap-2">
          <span>🌿</span> My Tasks
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCategoryManager(!showCategoryManager)}
            className="p-2 text-[#6B6560] hover:text-[#2D2A26] hover:bg-[#E6D8C3]/40 rounded-xl transition-colors"
          >
            <Settings size={22} />
          </button>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center gap-1 mb-2">
          {[
            { key: 'today', label: 'Today' },
            { key: 'week', label: 'This Week' },
            { key: 'month', label: 'This Month' },
            { key: 'all', label: 'All Time' },
            { key: 'hide', label: 'Hide' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setStatsPeriod(opt.key)}
              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                statsPeriod === opt.key
                  ? 'text-white'
                  : 'text-[#6B6560] hover:bg-[#E6D8C3]/40'
              }`}
              style={statsPeriod === opt.key ? { backgroundColor: '#8B7E6A' } : {}}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {statsPeriod !== 'hide' && (
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(63,108,122,0.22)', color: '#3F6C7A' }}>
              📋 {stats.tasks} tasks
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(194,168,62,0.22)', color: '#C2A83E' }}>
              💡 {stats.ideas} ideas
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(79,124,89,0.22)', color: '#4F7C59' }}>
              ✅ {stats.completed} done
            </span>
          </div>
        )}
      </div>
    </header>
  );
});

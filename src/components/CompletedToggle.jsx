import React from 'react';

export const CompletedToggle = React.memo(function CompletedToggle({ showCompleted, setShowCompleted, completedCount }) {
  return (
    <div className="mt-6 pt-4 border-t border-[#E6D8C3] flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => setShowCompleted(!showCompleted)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#E6D8C3]/40 text-[#2D2A26] hover:bg-[#E6D8C3]/70 transition-colors"
      >
        {showCompleted ? 'Hide completed' : 'Show completed'}
        <span className="text-[#6B6560]">({completedCount})</span>
      </button>
    </div>
  );
});

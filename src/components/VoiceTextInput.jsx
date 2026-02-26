import React, { useState, useEffect, useRef } from 'react';
import { useDataContext } from '../contexts/DataContext.jsx';
import { API_BASE } from '../utils/constants.js';
import { toLocalDateString, getWeekdaysFromInput, applyWeekdayDueDateFromInput, applyDefaultDueDate } from '../utils/dates.js';
import { Mic, MicOff, Plus } from './Icons.jsx';

export const VoiceTextInput = React.memo(function VoiceTextInput() {
  const { learningData, allCategories, setItems } = useDataContext();
  const [textInput, setTextInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setTextInput(transcript);
        setIsListening(false);
        setError('');
      };
      recognitionRef.current.onerror = (event) => {
        setIsListening(false);
        if (event.error === 'not-allowed') setError('Microphone access denied. Allow mic in browser or device settings and try again.');
        else if (event.error === 'no-speech') setError('No speech detected. Try again.');
        else if (event.error === 'network') setError('Voice needs internet on this device. Check connection and try again.');
        else setError(event.message || 'Voice unavailable on this device. Use text input.');
      };
      recognitionRef.current.onend = () => setIsListening(false);
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const toggleListening = async () => {
    if (!recognitionRef.current) {
      setError('Voice input is not supported in this browser. Use text input instead.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Microphone access requires a secure page (HTTPS). Use text input.');
        return;
      }
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setError('');
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        const msg = err?.name === 'NotAllowedError' || err?.message?.includes('Permission')
          ? 'Microphone permission denied. Allow mic in browser settings and try again.'
          : err?.message || 'Voice unavailable. Use text input instead.';
        setError(msg);
      }
    }
  };

  const categorizeWithClaude = async (text) => {
    // Abort any in-flight request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setLoading(true);
    try {
      const learningContext = learningData.length > 0
        ? `\n\nLearn from these past corrections:\n${learningData.slice(-10).map(l =>
            `"${l.text}" → type: ${l.type}, category: ${l.category}, priority: ${l.priority}`
          ).join('\n')}`
        : '';
      const categoriesList = allCategories.join(', ');
      const body = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `You are a task parser. The user may provide one or multiple tasks/ideas in a single input. Parse and return ONLY a JSON array with no markdown, backticks, or preamble.

Input: "${text}"
${learningContext}

Available categories: ${categoriesList}

For EACH separate task or idea, create an object with:
{
  "text": "the individual task/idea text (clean, corrected title)",
  "type": "task" or "idea",
  "category": one of [${categoriesList}],
  "priority": "high" or "medium" or "low",
  "dueDate": "YYYY-MM-DD" or null,
  "notes": "additional context or details, or empty string"
}

Rules:
- Separate multiple items if the input contains "and", commas, semicolons, or line breaks suggesting multiple tasks
- Today is ${toLocalDateString()}
- Extract due dates from phrases like "by Friday", "tomorrow", "on Wednesday", "next week", "end of month"
- For weekday names (e.g. "Wednesday", "on Wednesday", "by Friday"): use that weekday's date. If that weekday is today or still to come this week, use it; otherwise use that weekday next week.
- type: "task" if actionable, "idea" if conceptual
- category: choose the most appropriate from available categories
- priority: high if urgent/time-sensitive, medium if standard, low if someday/maybe
- Apply learning patterns from past corrections
- If a duedate is not specified: if the type is work, set the duedate to the current date; for any other task, set the duedate to end of week; if it is an idea, set the duedate to end of month
- Adjust spelling and grammar as needed for task titles. If info is given in parenthesis and not a date or priority, include it in the task notes.

Return format: [{"text": "...", "type": "...", "category": "...", "priority": "...", "dueDate": "..."}]`
        }]
      };
      const response = await fetch(`${API_BASE}/api/categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal
      });
      if (!response.ok) {
        if (response.status === 503) return [{ text, type: 'task', category: 'personal', priority: 'medium', dueDate: null }];
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Categorization failed');
      }
      const data = await response.json();
      if (!data.content || !data.content[0]) return [{ text, type: 'task', category: 'personal', priority: 'medium', dueDate: null }];
      const content = data.content[0].text.trim();
      const cleaned = content.replace(/```json|```/g, '').trim();
      const weekdaysInInput = getWeekdaysFromInput(text);
      return JSON.parse(cleaned)
        .map((item, idx) => applyWeekdayDueDateFromInput(item, text, idx, weekdaysInInput))
        .map(applyDefaultDueDate);
    } catch (err) {
      if (err.name === 'AbortError') {
        return [{ text, type: 'task', category: 'personal', priority: 'medium', dueDate: null }];
      }
      console.error('Categorization error:', err);
      return [{ text, type: 'task', category: 'personal', priority: 'medium', dueDate: null }]
        .map((item, idx) => applyWeekdayDueDateFromInput(item, text, idx, getWeekdaysFromInput(text)))
        .map(applyDefaultDueDate);
    } finally {
      setLoading(false);
    }
  };

  const addItem = async () => {
    if (!textInput.trim()) return;
    const parsedItems = await categorizeWithClaude(textInput);
    const newItems = parsedItems.map((item, idx) => ({
      id: Date.now() * 1000 + Math.floor(Math.random() * 1000) + idx,
      text: item.text,
      completed: false,
      createdAt: new Date().toISOString(),
      type: item.type,
      category: item.category,
      priority: item.priority,
      dueDate: item.dueDate,
      notes: item.notes || ''
    }));
    try {
      await fetch(`${API_BASE}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newItems)
      });
      setItems(prev => [...prev, ...newItems]);
      setTextInput('');
    } catch (err) {
      setError('Failed to save items');
    }
  };

  return (
    <div className="bg-[#FFFBF7] rounded-2xl border border-[#E6D8C3]/80 p-5 mb-6 shadow-sm">
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={toggleListening}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all flex-shrink-0 ${
            isListening ? 'bg-[#9E5B8C] text-white hover:bg-[#8a4d7a] mic-pulse-anim' : 'bg-[#3F6C7A] text-white hover:bg-[#355d6a]'
          }`}
        >
          {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          {isListening ? 'Stop' : 'Voice'}
        </button>
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder="Add task(s) - separate multiple with 'and' or commas..."
          className="input-focus-glow flex-1 px-4 py-3 bg-white border border-[#E6D8C3] rounded-xl text-[#2D2A26] placeholder:text-[#6B6560] transition-shadow"
        />
        <button
          onClick={addItem}
          disabled={loading || !textInput.trim()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#4F7C59] to-[#3d6b47] text-white rounded-xl font-medium transition-all hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex-shrink-0"
        >
          <Plus size={20} />
          Add
        </button>
      </div>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      {loading && <p className="text-[#3F6C7A] text-sm mt-2">Parsing and categorizing...</p>}
    </div>
  );
});

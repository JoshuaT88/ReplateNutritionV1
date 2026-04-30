import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  className?: string;
}

export function TagInput({ value, onChange, placeholder, suggestions, className }: TagInputProps) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput('');
    setShowSuggestions(false);
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && value.length) {
      removeTag(value.length - 1);
    }
  };

  const filtered = suggestions?.filter(
    (s) => s.toLowerCase().includes(input.toLowerCase()) && !value.includes(s)
  );

  return (
    <div className={cn('relative', className)}>
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-card-border dark:border-[#374151] bg-white dark:bg-[#1F2937] px-3 py-2 min-h-[42px] focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-colors">
        {value.map((tag, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-primary/10 text-primary text-xs font-medium px-2 py-1">
            {tag}
            <button type="button" onClick={() => removeTag(i)} className="hover:text-primary-deep">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] text-sm outline-none bg-transparent placeholder:text-muted-foreground"
        />
      </div>
      {showSuggestions && filtered && filtered.length > 0 && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-[#1F2937] border border-card-border dark:border-[#374151] rounded-xl shadow-card max-h-48 overflow-y-auto">
          {filtered.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addTag(suggestion)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-[#283447] transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

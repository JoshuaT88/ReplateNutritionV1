/**
 * Inline unit measurement converter for recipe dialogs.
 * Supports volume (tsp, tbsp, cup, fl oz, ml, L) and weight (oz, g, lb, kg).
 */

import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Unit = {
  label: string;
  group: 'volume' | 'weight';
  toBase: number; // conversion to mL (volume) or grams (weight)
};

const UNITS: Unit[] = [
  // Volume (base: mL)
  { label: 'tsp',    group: 'volume', toBase: 4.92892 },
  { label: 'tbsp',   group: 'volume', toBase: 14.7868 },
  { label: 'fl oz',  group: 'volume', toBase: 29.5735 },
  { label: 'cup',    group: 'volume', toBase: 236.588 },
  { label: 'pint',   group: 'volume', toBase: 473.176 },
  { label: 'quart',  group: 'volume', toBase: 946.353 },
  { label: 'mL',     group: 'volume', toBase: 1 },
  { label: 'L',      group: 'volume', toBase: 1000 },
  // Weight (base: grams)
  { label: 'oz',     group: 'weight', toBase: 28.3495 },
  { label: 'lb',     group: 'weight', toBase: 453.592 },
  { label: 'g',      group: 'weight', toBase: 1 },
  { label: 'kg',     group: 'weight', toBase: 1000 },
];

function convert(value: number, from: Unit, to: Unit): number {
  if (from.group !== to.group) return NaN;
  return (value * from.toBase) / to.toBase;
}

function fmt(n: number): string {
  if (isNaN(n) || !isFinite(n)) return '—';
  if (n >= 100) return n.toFixed(1);
  if (n >= 10) return n.toFixed(2);
  return n.toFixed(3).replace(/\.?0+$/, '') || '0';
}

export function MeasurementConverter() {
  const [amount, setAmount] = useState('1');
  const [fromUnit, setFromUnit] = useState('cup');
  const [toUnit, setToUnit] = useState('mL');
  const [tab, setTab] = useState<'volume' | 'weight'>('volume');

  const fromU = UNITS.find((u) => u.label === fromUnit) ?? UNITS[3];
  const toU = UNITS.find((u) => u.label === toUnit) ?? UNITS[6];

  const numAmount = parseFloat(amount) || 0;
  const result = convert(numAmount, fromU, toU);

  const volumeUnits = UNITS.filter((u) => u.group === 'volume');
  const weightUnits = UNITS.filter((u) => u.group === 'weight');
  const displayUnits = tab === 'volume' ? volumeUnits : weightUnits;

  function switchTab(newTab: 'volume' | 'weight') {
    setTab(newTab);
    const defaults: Record<string, [string, string]> = {
      volume: ['cup', 'mL'],
      weight: ['oz', 'g'],
    };
    setFromUnit(defaults[newTab][0]);
    setToUnit(defaults[newTab][1]);
  }

  function swap() {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
  }

  return (
    <div className="rounded-xl border border-card-border bg-surface-hover p-3 text-sm">
      <div className="flex items-center gap-1.5 mb-3">
        <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-text-secondary">Measurement Converter</span>
        <div className="ml-auto flex gap-1">
          {(['volume', 'weight'] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                tab === t ? 'bg-primary text-white' : 'bg-white dark:bg-[#1F2937] border border-card-border text-text-secondary'
              )}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-20 h-8 text-sm"
          min={0}
          step="any"
        />
        <select
          value={fromUnit}
          onChange={(e) => setFromUnit(e.target.value)}
          className="flex-1 border border-card-border rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-[#1F2937] focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {displayUnits.map((u) => (
            <option key={u.label} value={u.label}>{u.label}</option>
          ))}
        </select>

        <button onClick={swap} className="p-1.5 rounded border border-card-border hover:bg-white dark:hover:bg-[#1F2937] transition-colors" title="Swap">
          <ArrowLeftRight className="h-3.5 w-3.5 text-text-muted" />
        </button>

        <select
          value={toUnit}
          onChange={(e) => setToUnit(e.target.value)}
          className="flex-1 border border-card-border rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-[#1F2937] focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {displayUnits.map((u) => (
            <option key={u.label} value={u.label}>{u.label}</option>
          ))}
        </select>
      </div>

      <div className="mt-2.5 text-center">
        <span className="text-text-muted text-xs">{numAmount} {fromUnit} = </span>
        <span className="text-base font-bold text-primary">{fmt(result)}</span>
        <span className="text-text-muted text-xs"> {toUnit}</span>
      </div>
    </div>
  );
}

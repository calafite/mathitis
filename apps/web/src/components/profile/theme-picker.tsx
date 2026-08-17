import type { CardStyle, ThemePalette } from '@mathitis/schemas';

export interface ThemePickerProps {
  value: ThemePalette;
  onChange: (value: ThemePalette) => void;
}

const CARD_STYLES: Array<{ value: CardStyle; label: string }> = [
  { value: 'glassmorphic', label: 'Glassmorphic' },
  { value: 'solid', label: 'Solid' },
  { value: 'bordered', label: 'Bordered' },
];

const PRESETS: ThemePalette[] = [
  { primaryColor: '#6366f1', accentColor: '#ec4899', badgeColor: '#3b82f6', cardStyle: 'glassmorphic' },
  { primaryColor: '#0ea5e9', accentColor: '#22c55e', badgeColor: '#f59e0b', cardStyle: 'solid' },
  { primaryColor: '#a855f7', accentColor: '#06b6d4', badgeColor: '#ec4899', cardStyle: 'bordered' },
];

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {PRESETS.map((preset, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Apply theme preset ${index + 1}`}
            onClick={() => onChange(preset)}
            className="h-8 w-8 rounded-full border border-slate-300 transition hover:scale-110"
            style={{ background: `linear-gradient(135deg, ${preset.primaryColor}, ${preset.accentColor})` }}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Primary</span>
          <input
            type="color"
            value={value.primaryColor}
            onChange={(e) => onChange({ ...value, primaryColor: e.target.value })}
            className="h-9 w-full cursor-pointer rounded-md border border-input bg-white"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Accent</span>
          <input
            type="color"
            value={value.accentColor}
            onChange={(e) => onChange({ ...value, accentColor: e.target.value })}
            className="h-9 w-full cursor-pointer rounded-md border border-input bg-white"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Badge</span>
          <input
            type="color"
            value={value.badgeColor}
            onChange={(e) => onChange({ ...value, badgeColor: e.target.value })}
            className="h-9 w-full cursor-pointer rounded-md border border-input bg-white"
          />
        </label>
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-slate-600">Card style</span>
        <div className="flex gap-2">
          {CARD_STYLES.map((style) => (
            <button
              key={style.value}
              type="button"
              onClick={() => onChange({ ...value, cardStyle: style.value })}
              className={`rounded-md border px-3 py-1.5 text-sm transition ${
                value.cardStyle === style.value
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
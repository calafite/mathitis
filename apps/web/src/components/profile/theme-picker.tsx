import type { ThemePalette } from '@mathitis/schemas';

export interface ThemePickerProps {
  value: ThemePalette;
  onChange: (value: ThemePalette) => void;
}

const PRESETS: ThemePalette[] = [
  { primaryColor: '#6366f1', accentColor: '#ec4899', badgeColor: '#3b82f6' },
  { primaryColor: '#0ea5e9', accentColor: '#22c55e', badgeColor: '#f59e0b' },
  { primaryColor: '#a855f7', accentColor: '#06b6d4', badgeColor: '#ec4899' },
];

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {PRESETS.map((preset, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Aplicar predefinição de tema ${index + 1}`}
            onClick={() => onChange(preset)}
            className="h-8 w-8 rounded-full border border-border transition hover:scale-110"
            style={{
              background: `linear-gradient(135deg, ${preset.primaryColor}, ${preset.accentColor})`,
            }}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Primária</span>
          <input
            type="color"
            value={value.primaryColor}
            onChange={(e) => onChange({ ...value, primaryColor: e.target.value })}
            className="h-9 w-full cursor-pointer rounded-md border border-input bg-background"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Destaque</span>
          <input
            type="color"
            value={value.accentColor}
            onChange={(e) => onChange({ ...value, accentColor: e.target.value })}
            className="h-9 w-full cursor-pointer rounded-md border border-input bg-background"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Emblema</span>
          <input
            type="color"
            value={value.badgeColor}
            onChange={(e) => onChange({ ...value, badgeColor: e.target.value })}
            className="h-9 w-full cursor-pointer rounded-md border border-input bg-background"
          />
        </label>
      </div>
    </div>
  );
}

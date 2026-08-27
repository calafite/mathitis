import type { OnboardingBlockProps } from '@/lib/onboarding-engine';
import { ThemePicker } from '@/components/profile/theme-picker';

export function ThemePickerBlock({ step, draft, setDraft, next }: OnboardingBlockProps) {
  return (
    <div className="w-full space-y-5">
      <div className="rounded-md border border-border bg-card p-5">
        <ThemePicker
          value={draft.themePalette}
          onChange={(themePalette) => setDraft({ themePalette })}
        />
      </div>
      <button
        type="button"
        onClick={next}
        className="inline-block border-2 border-foreground bg-[#c9f24c] px-6 py-3 font-mono text-sm font-bold uppercase tracking-widest text-black shadow-[6px_6px_0_0_#000] transition-transform hover:-translate-y-0.5"
      >
        {step.ctaText ?? 'LISTO, CONTINUAR'}
      </button>
    </div>
  );
}

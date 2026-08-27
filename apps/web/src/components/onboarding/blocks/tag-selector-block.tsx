import type { OnboardingBlockProps } from '@/lib/onboarding-engine';
import { DynamicTagInput } from '@/components/profile/dynamic-tag-input';

export function TagSelectorBlock({ step, draft, setDraft, next }: OnboardingBlockProps) {
  const minTags = Number(step.config?.minTags ?? 0);

  return (
    <div className="w-full space-y-5">
      <DynamicTagInput value={draft.tags} onChange={(tags) => setDraft({ tags })} maxTags={15} />
      <button
        type="button"
        onClick={next}
        className="inline-block border-2 border-foreground bg-[#c9f24c] px-6 py-3 font-mono text-sm font-bold uppercase tracking-widest text-black shadow-[6px_6px_0_0_#000] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={draft.tags.length < minTags}
      >
        {draft.tags.length < minTags
          ? `ESCOLHA PELO MENOS ${minTags}`
          : (step.ctaText ?? 'PRONTO')}
      </button>
    </div>
  );
}

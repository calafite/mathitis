import type { OnboardingBlockProps } from '@/lib/onboarding-engine';
import { MarkdownPreview } from '@/components/markdown/markdown-preview';

export function InfoSlideBlock({ step, next }: OnboardingBlockProps) {
  return (
    <div className="flex flex-col items-center text-center">
      {step.description && (
        <div className="text-lg [&_p]:leading-relaxed">
          <MarkdownPreview markdown={step.description} />
        </div>
      )}
      <button
        type="button"
        onClick={next}
        className="mt-8 inline-block border-2 border-foreground bg-[#c9f24c] px-6 py-3 font-mono text-sm font-bold uppercase tracking-widest text-black shadow-[6px_6px_0_0_#000] transition-transform hover:-translate-y-0.5"
      >
        {step.ctaText ?? 'CONTINUAR'}
      </button>
    </div>
  );
}

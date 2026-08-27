import type { OnboardingBlockProps } from '@/lib/onboarding-engine';
import { Input } from '@/components/ui/input';
import { BioEditor } from '@/components/profile/bio-editor';

type ProfileField = 'socialName' | 'tagline' | 'biographyMarkdown';

export function ProfileInputBlock({ step, draft, setDraft, next }: OnboardingBlockProps) {
  const field = String(step.config?.field ?? 'tagline') as ProfileField;
  const multiline = Boolean(step.config?.multiline);
  const required = Boolean(step.config?.required);

  const value = draft[field] ?? '';
  const canContinue = !required || String(value).trim().length > 0;

  if (multiline) {
    return (
      <div className="w-full">
        <BioEditor
          value={draft.biographyMarkdown}
          onChange={(biographyMarkdown) => setDraft({ biographyMarkdown })}
        />
        <ContinueButton canContinue={canContinue} onClick={next} ctaText={step.ctaText} />
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {step.description}
        </span>
        <Input
          value={value}
          onChange={(e) =>
            setDraft({ [field]: e.target.value } as Partial<OnboardingBlockProps['draft']>)
          }
          placeholder={String(step.config?.placeholder ?? '')}
          className="font-mono"
          autoFocus
        />
      </label>
      <ContinueButton canContinue={canContinue} onClick={next} ctaText={step.ctaText} />
    </div>
  );
}

function ContinueButton({
  canContinue,
  onClick,
  ctaText,
}: {
  canContinue: boolean;
  onClick: () => void;
  ctaText?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canContinue}
      className="mt-8 inline-block border-2 border-foreground bg-[#c9f24c] px-6 py-3 font-mono text-sm font-bold uppercase tracking-widest text-black shadow-[6px_6px_0_0_#000] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {ctaText ?? 'CONTINUAR'}
    </button>
  );
}

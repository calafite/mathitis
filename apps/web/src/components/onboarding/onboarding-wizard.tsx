import { useState } from 'react';
import type {
  OnboardingBlockComponent,
  OnboardingBlockProps,
  OnboardingDraft,
  OnboardingFlow,
  OnboardingStep,
} from '@/lib/onboarding-engine';
import { InfoSlideBlock } from '@/components/onboarding/blocks/info-slide-block';
import { ProfileInputBlock } from '@/components/onboarding/blocks/profile-input-block';
import { ThemePickerBlock } from '@/components/onboarding/blocks/theme-picker-block';
import { TagSelectorBlock } from '@/components/onboarding/blocks/tag-selector-block';
import { AvatarUploadBlock } from '@/components/onboarding/blocks/avatar-upload-block';

const BLOCK_REGISTRY: Record<string, OnboardingBlockComponent> = {
  info_slide: InfoSlideBlock,
  profile_input: ProfileInputBlock,
  theme_picker: ThemePickerBlock,
  tag_selector: TagSelectorBlock,
  avatar_upload: AvatarUploadBlock,
};

function UnsupportedBlock(_props: OnboardingBlockProps) {
  return (
    <button
      type="button"
      onClick={_props.next}
      className="inline-block border-2 border-foreground bg-[#c9f24c] px-6 py-3 font-mono text-sm font-bold uppercase tracking-widest text-black shadow-[6px_6px_0_0_#000]"
    >
      CONTINUAR
    </button>
  );
}

export interface OnboardingWizardProps {
  flow: OnboardingFlow;
  draft: OnboardingDraft;
  setDraft: (patch: Partial<OnboardingDraft>) => void;
  onComplete: () => void;
  accentColor?: string;
  disabled?: boolean;
}

export function OnboardingWizard({ flow, draft, setDraft, onComplete, accentColor = '#c9f24c', disabled = false }: OnboardingWizardProps) {
  const [index, setIndex] = useState(0);

  if (flow.length === 0) {
    return null;
  }

  const step = flow[index] as OnboardingStep;
  const isLast = index === flow.length - 1;

  const Block = BLOCK_REGISTRY[step.type] ?? UnsupportedBlock;

  const next = () => {
    if (disabled) return;
    if (isLast) {
      onComplete();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const progress = Math.round(((index + 1) / flow.length) * 100);

  return (
    <div className="w-full">
      <div className="mb-8 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full transition-all"
            style={{ width: `${progress}%`, backgroundColor: accentColor }}
          />
        </div>
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Etapa {index + 1} / {flow.length}
        </span>
      </div>

      <h1 className="font-display text-2xl font-bold sm:text-3xl">{step.title}</h1>

      <div className="mt-6">
        <Block step={step} draft={draft} setDraft={setDraft} next={next} />
      </div>
    </div>
  );
}

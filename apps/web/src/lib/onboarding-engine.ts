import type { ThemePalette } from '@mathitis/schemas';
import type { TagLike } from '@/components/profile/dynamic-tag-input';

export type BlockType =
  | 'info_slide'
  | 'profile_input'
  | 'theme_picker'
  | 'tag_selector'
  | 'avatar_upload';

export interface OnboardingStep {
  id: string;
  type: BlockType;
  title: string;
  description?: string;
  config?: Record<string, unknown>;
  ctaText?: string;
}

export type OnboardingFlow = OnboardingStep[];

export interface OnboardingDraft {
  socialName: string;
  tagline: string;
  biographyMarkdown: string;
  themePalette: ThemePalette;
  tags: TagLike[];
  avatarUrl: string | null;
}

export function emptyOnboardingDraft(): OnboardingDraft {
  return {
    socialName: '',
    tagline: '',
    biographyMarkdown: '',
    themePalette: {
      primaryColor: '#c9f24c',
      accentColor: '#ff4d14',
      badgeColor: '#c9f24c',
    },
    tags: [],
    avatarUrl: null,
  };
}

export interface OnboardingBlockProps {
  step: OnboardingStep;
  draft: OnboardingDraft;
  setDraft: (patch: Partial<OnboardingDraft>) => void;
  next: () => void;
}

export type OnboardingBlockComponent = (props: OnboardingBlockProps) => React.ReactNode;

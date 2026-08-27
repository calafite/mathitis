import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ThemePalette, UpdateProfileBody } from '@mathitis/schemas';
import { useAuth } from '@/contexts/auth-context';
import { profileApi } from '@/lib/profile-api';
import { settingsApi } from '@/lib/settings-api';
import { ApiError } from '@/lib/api';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';
import { FRESHMAN_FLOW, SENIOR_FLOW } from '@/lib/onboarding-flows';
import {
  type OnboardingDraft,
} from '@/lib/onboarding-engine';
import type { TagLike } from '@/components/profile/dynamic-tag-input';
import { usePageMeta } from '@/lib/use-page-meta';

const DEFAULT_THEME: ThemePalette = {
  primaryColor: '#c9f24c',
  accentColor: '#ff4d14',
  badgeColor: '#c9f24c',
};

function toDraft(profile: {
  socialName?: string | null;
  tagline?: string | null;
  biographyMarkdown?: string | null;
  themePalette?: ThemePalette | null;
  tags?: TagLike[];
}): OnboardingDraft {
  return {
    socialName: profile.socialName ?? '',
    tagline: profile.tagline ?? '',
    biographyMarkdown: profile.biographyMarkdown ?? '',
    themePalette: profile.themePalette ?? DEFAULT_THEME,
    tags: (profile.tags ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      color: t.color,
      icon: t.icon ?? null,
    })),
  };
}

function toUpdateBody(draft: OnboardingDraft): UpdateProfileBody {
  return {
    socialName: draft.socialName || undefined,
    tagline: draft.tagline || null,
    biographyMarkdown: draft.biographyMarkdown || null,
    themePalette: draft.themePalette,
    tagIds: draft.tags.filter((t) => !t.id.startsWith('__new__:')).map((t) => t.id),
    tagNames: draft.tags.filter((t) => t.id.startsWith('__new__:')).map((t) => t.name),
  };
}

export function OnboardingPage() {
  usePageMeta('Bem-vindo(a)', 'Complete seu perfil para começar.');
  const navigate = useNavigate();
  const { user } = useAuth();

  const profileQuery = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => profileApi.getMe().then((r) => r.profile),
  });

  const [draft, setDraft] = useState<OnboardingDraft | null>(null);

  useEffect(() => {
    if (profileQuery.data && !draft) {
      setDraft(toDraft(profileQuery.data));
    }
  }, [profileQuery.data, draft]);

  const set = (patch: Partial<OnboardingDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const flow = useMemo(() => {
    if (user?.role === 'freshman') return FRESHMAN_FLOW;
    return SENIOR_FLOW;
  }, [user?.role]);

  const finishMutation = useMutation({
    mutationFn: async (body: UpdateProfileBody) => {
      await profileApi.updateMe(body);
      await settingsApi.updateAccount({
        preferences: { onboarded: true },
      });
    },
    onSuccess: () => navigate('/', { replace: true }),
    onError: (err: unknown) => {
      console.error('onboarding save failed', err);
    },
  });

  const [saving, setSaving] = useState(false);

  const handleComplete = () => {
    if (!draft) return;
    setSaving(true);
    finishMutation.mutate(toUpdateBody(draft));
  };

  const savingError = finishMutation.isError
    ? (finishMutation.error as Error) instanceof ApiError
      ? (finishMutation.error as ApiError).message
      : 'Não foi possível salvar. Tente novamente.'
    : null;

  if (!draft) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#000] px-4 py-16 text-white">
      <div className="w-full max-w-2xl">
        <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.3em] text-[#c9f24c]">
          mathitis · onboarding
        </p>

        {savingError && (
          <p
            role="alert"
            className="mb-4 rounded border-2 border-[#ff4d14] bg-[#ff4d14]/10 px-3 py-2 font-mono text-xs text-[#ff4d14]"
          >
            {savingError}
          </p>
        )}

        <OnboardingWizard
          flow={flow}
          draft={draft}
          setDraft={set}
          onComplete={handleComplete}
          disabled={saving}
        />

        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="mt-10 font-mono text-[11px] uppercase tracking-widest text-white/40 hover:text-white/70"
          disabled={saving}
        >
          Sair e completar depois
        </button>
      </div>
    </div>
  );
}

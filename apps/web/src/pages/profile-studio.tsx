import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Profile, ThemePalette, UpdateProfileBody } from '@mathitis/schemas';
import { useAuth } from '@/contexts/auth-context';
import { profileApi } from '@/lib/profile-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemePicker } from '@/components/profile/theme-picker';
import { BioEditor } from '@/components/profile/bio-editor';
import { MediaUpload } from '@/components/profile/media-upload';
import { RichCardManager } from '@/components/profile/rich-card-manager';
import { ProfilePreview, type ProfileDraft } from '@/components/profile/profile-preview';
import { usePageMeta } from '@/lib/use-page-meta';

const DEFAULT_THEME: ThemePalette = {
  primaryColor: '#6366f1',
  accentColor: '#ec4899',
  badgeColor: '#3b82f6',
  cardStyle: 'glassmorphic',
};

function toDraft(profile: Profile): ProfileDraft {
  return {
    socialName: profile.socialName ?? '',
    pronouns: profile.pronouns ?? '',
    tagline: profile.tagline ?? '',
    biographyMarkdown: profile.biographyMarkdown ?? '',
    themePalette: profile.themePalette ?? DEFAULT_THEME,
    contactEmail: profile.contactEmail ?? '',
    socialLinks: {
      github: profile.socialLinks?.github ?? '',
      discord: profile.socialLinks?.discord ?? '',
      linkedin: profile.socialLinks?.linkedin ?? '',
      website: profile.socialLinks?.website ?? '',
    },
    maxMentees: profile.maxMentees,
    isAcceptingRequests: profile.isAcceptingRequests,
    isDiscoverable: profile.isDiscoverable,
  };
}

function toUpdateBody(draft: ProfileDraft): UpdateProfileBody {
  return {
    socialName: draft.socialName || undefined,
    pronouns: draft.pronouns || null,
    tagline: draft.tagline || null,
    biographyMarkdown: draft.biographyMarkdown || null,
    themePalette: draft.themePalette,
    contactEmail: draft.contactEmail || null,
    socialLinks: {
      github: draft.socialLinks.github || undefined,
      discord: draft.socialLinks.discord || undefined,
      linkedin: draft.socialLinks.linkedin || undefined,
      website: draft.socialLinks.website || undefined,
    },
    maxMentees: draft.maxMentees,
    isAcceptingRequests: draft.isAcceptingRequests,
    isDiscoverable: draft.isDiscoverable,
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="border-b border-border pb-2 text-sm font-semibold text-foreground">{children}</h3>;
}

export function ProfileStudioPage() {
  usePageMeta('Estúdio de Perfil', 'Personalize seu perfil: biografia, tema, banners e cartões de vitrine.');
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => profileApi.getMe().then((r) => r.profile),
  });

  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (profileQuery.data && !draft) {
      setDraft(toDraft(profileQuery.data));
    }
  }, [profileQuery.data, draft]);

  const saveMutation = useMutation({
    mutationFn: (body: UpdateProfileBody) => profileApi.updateMe(body),
    onSuccess: () => {
      setDirty(false);
      void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    },
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => profileApi.uploadAvatar(file),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] }),
  });

  const bannerMutation = useMutation({
    mutationFn: (file: File) => profileApi.uploadBanner(file),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] }),
  });

  const profile = profileQuery.data;
  const set = (patch: Partial<ProfileDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };

  if (!profile || !draft) {
    return <p className="px-4 py-10 text-center text-muted-foreground">Carregando seu perfil…</p>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">Estúdio de Perfil</h1>
          <Button size="sm" disabled={!dirty || saveMutation.isPending} onClick={() => saveMutation.mutate(toUpdateBody(draft))}>
            {saveMutation.isPending ? 'Salvando…' : dirty ? 'Salvar alterações' : 'Salvo'}
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="space-y-4 rounded-xl border border-border bg-card p-5">
            <SectionTitle>Cabeçalho &amp; mídia</SectionTitle>
            <div className="space-y-3">
              <Field label="Avatar">
                <MediaUpload
                  kind="avatar"
                  url={profile.avatarUrl}
                  uploading={avatarMutation.isPending}
                  onUpload={(file) => avatarMutation.mutate(file)}
                />
              </Field>
              <Field label="Banner">
                <MediaUpload
                  kind="banner"
                  url={profile.bannerUrl}
                  uploading={bannerMutation.isPending}
                  onUpload={(file) => bannerMutation.mutate(file)}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-border bg-card p-5">
            <SectionTitle>Identidade</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome social">
                <Input value={draft.socialName} onChange={(e) => set({ socialName: e.target.value })} placeholder="Como você quer ser conhecido" />
              </Field>
              <Field label="Pronomes">
                <Input value={draft.pronouns} onChange={(e) => set({ pronouns: e.target.value })} placeholder="she/her" />
              </Field>
            </div>
              <Field label="Frase de destaque">
                <Input value={draft.tagline} onChange={(e) => set({ tagline: e.target.value })} placeholder="Uma frase curta" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Máx. de pupilos">
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={draft.maxMentees}
                  onChange={(e) => set({ maxMentees: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })}
                />
              </Field>
              <Field label="Disponibilidade">
                <button
                  type="button"
                  onClick={() => set({ isAcceptingRequests: !draft.isAcceptingRequests })}
                  className={`flex h-10 w-full items-center justify-between rounded-md border px-3 text-sm ${
                    draft.isAcceptingRequests ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-input bg-muted text-muted-foreground'
                  }`}
                >
                  {draft.isAcceptingRequests ? 'Aceitando pupilos' : 'Capacidade cheia'}
                </button>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground/80">
              <input
                type="checkbox"
                checked={draft.isDiscoverable}
                onChange={(e) => set({ isDiscoverable: e.target.checked })}
                className="h-4 w-4 rounded"
              />
              Mostrar meu perfil na descoberta ({user?.role === 'freshman' ? 'calouros ficam ocultos por padrão' : 'veteranos são visíveis'})
            </label>
          </section>

          <section className="space-y-4 rounded-xl border border-border bg-card p-5">
            <SectionTitle>Tema &amp; paleta</SectionTitle>
            <ThemePicker value={draft.themePalette} onChange={(themePalette) => set({ themePalette })} />
          </section>

          <section className="space-y-4 rounded-xl border border-border bg-card p-5">
            <SectionTitle>Contato (opcional — exibido publicamente se adicionado)</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="E-mail de contato">
                <Input value={draft.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} placeholder="me@example.com" />
              </Field>
              <Field label="Discord">
                <Input value={draft.socialLinks.discord} onChange={(e) => set({ socialLinks: { ...draft.socialLinks, discord: e.target.value } })} placeholder="username" />
              </Field>
              <Field label="GitHub">
                <Input value={draft.socialLinks.github} onChange={(e) => set({ socialLinks: { ...draft.socialLinks, github: e.target.value } })} placeholder="https://github.com/you" />
              </Field>
              <Field label="LinkedIn">
                <Input value={draft.socialLinks.linkedin} onChange={(e) => set({ socialLinks: { ...draft.socialLinks, linkedin: e.target.value } })} placeholder="https://linkedin.com/in/you" />
              </Field>
              <Field label="Site">
                <Input value={draft.socialLinks.website} onChange={(e) => set({ socialLinks: { ...draft.socialLinks, website: e.target.value } })} placeholder="https://you.dev" />
              </Field>
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-border bg-card p-5">
            <SectionTitle>Biografia (markdown)</SectionTitle>
            <BioEditor value={draft.biographyMarkdown} onChange={(biographyMarkdown) => set({ biographyMarkdown })} />
          </section>

          <section className="space-y-4 rounded-xl border border-border bg-card p-5">
            <SectionTitle>Cards avançados</SectionTitle>
            <RichCardManager />
          </section>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Pré-visualização ao vivo</h2>
            {dirty ? <span className="text-xs text-amber-600 dark:text-amber-400">Alterações não salvas</span> : null}
          </div>
          <ProfilePreview
            draft={draft}
            avatarUrl={profile.avatarUrl}
            bannerUrl={profile.bannerUrl}
            bannerPreset={profile.bannerPreset}
            cards={profile.richCards}
            effortScore={profile.effortScore}
          />
        </div>
      </main>
    </div>
  );
}

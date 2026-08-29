import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { OnboardingBlockProps } from '@/lib/onboarding-engine';
import { profileApi } from '@/lib/profile-api';
import { MediaUpload } from '@/components/profile/media-upload';

export function AvatarUploadBlock({ step, draft, setDraft, next }: OnboardingBlockProps) {
  const queryClient = useQueryClient();
  const required = Boolean(step.config?.required);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => profileApi.uploadAvatar(file),
    onSuccess: (data) => {
      setDraft({ avatarUrl: data.url });
      void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    },
  });

  const canContinue = !required || Boolean(draft.avatarUrl);

  return (
    <div className="w-full space-y-5">
      <p className="font-mono text-xs leading-relaxed text-muted-foreground">
        Envie uma foto sua, nítida e bem iluminada. Use uma imagem que permita identificar você no
        campus e na plataforma. Formatos: JPG, PNG ou WebP até 2MB.
      </p>

      <div className="rounded-md border border-border bg-card p-5">
        <MediaUpload
          kind="avatar"
          url={draft.avatarUrl}
          uploading={uploadMutation.isPending}
          onUpload={(file) => uploadMutation.mutate(file)}
        />
      </div>

      {uploadMutation.isError && (
        <p role="alert" className="font-mono text-xs text-[#ff4d14]">
          Falha ao enviar a foto. Tente novamente com um arquivo menor ou outro formato.
        </p>
      )}

      <button
        type="button"
        onClick={next}
        disabled={!canContinue || uploadMutation.isPending}
        className="inline-block border-2 border-foreground bg-[#c9f24c] px-6 py-3 font-mono text-sm font-bold uppercase tracking-widest text-black shadow-[6px_6px_0_0_#000] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {!canContinue ? 'ENVIE SUA FOTO PARA CONTINUAR' : (step.ctaText ?? 'CONTINUAR')}
      </button>
    </div>
  );
}

import { useRef, useState } from 'react';
import { ImageCropModal } from '@/components/profile/image-crop-modal';

export interface MediaUploadProps {
  kind: 'avatar' | 'banner';
  url?: string | null;
  uploading: boolean;
  onUpload: (file: File) => void;
}

const AVATAR_LIMIT_MB = 2;
const BANNER_LIMIT_MB = 5;

/** Must mirror IMAGE_LIMITS in apps/api/src/services/image-service.ts. */
const RESOLUTION_HINT = {
  avatar: 'Recomendado: 512 × 512 px (quadrado)',
  banner: 'Recomendado: 1600 × 400 px (4:1)',
} as const;

/**
 * File picker that always routes through the crop dialog: avatars are
 * cropped square (rendered circular), banners to a wide 3:1 framing.
 */
export function MediaUpload({ kind, url, uploading, onUpload }: MediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const isAvatar = kind === 'avatar';
  const maxMb = isAvatar ? AVATAR_LIMIT_MB : BANNER_LIMIT_MB;

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) {
      alert(`O ${isAvatar ? 'avatar' : 'banner'} deve ter menos de ${maxMb}MB`);
      return;
    }
    setPendingFile(file);
    event.target.value = '';
  }

  return (
    <div className="flex items-center gap-4">
      {isAvatar ? (
        url ? (
          <img
            src={url}
            alt="Pré-visualização do avatar"
            className="h-16 w-16 rounded-full object-cover ring-2 ring-border"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted ring-2 ring-border">
            <span className="font-display text-lg text-muted-foreground">?</span>
          </div>
        )
      ) : url ? (
        <img
          src={url}
          alt="Pré-visualização do banner"
          className="h-16 w-32 rounded-none object-cover ring-2 ring-border"
        />
      ) : (
        <div className="flex h-16 w-32 items-center justify-center rounded-none bg-muted ring-2 ring-border">
          <span className="text-sm font-medium text-muted-foreground">Sem banner</span>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFile}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="w-fit border-2 border-[#c9ced8]/40 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-foreground transition-colors hover:border-[#c9f24c] hover:text-[#c9f24c] disabled:opacity-50"
        >
          {uploading ? 'Enviando…' : `Enviar ${isAvatar ? 'avatar' : 'banner'}`}
        </button>
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {RESOLUTION_HINT[kind]}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
          JPEG, PNG ou WebP · máx. {maxMb}MB
        </p>
      </div>

      <ImageCropModal
        open={pendingFile !== null}
        file={pendingFile}
        aspect={isAvatar ? 1 : 4}
        circular={isAvatar}
        title={isAvatar ? 'Recortar avatar · 512 × 512' : 'Recortar banner · 1600 × 400'}
        onCancel={() => setPendingFile(null)}
        onConfirm={(cropped) => {
          setPendingFile(null);
          onUpload(cropped);
        }}
      />
    </div>
  );
}

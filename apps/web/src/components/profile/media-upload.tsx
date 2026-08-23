import { useRef } from 'react';
import { Button } from '@/components/ui/button';

export interface MediaUploadProps {
  kind: 'avatar' | 'banner';
  url?: string | null;
  uploading: boolean;
  onUpload: (file: File) => void;
}

const AVATAR_LIMIT_MB = 2;
const BANNER_LIMIT_MB = 5;

export function MediaUpload({ kind, url, uploading, onUpload }: MediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isAvatar = kind === 'avatar';
  const maxMb = isAvatar ? AVATAR_LIMIT_MB : BANNER_LIMIT_MB;

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) {
      alert(`O ${isAvatar ? 'avatar' : 'banner'} deve ter menos de ${maxMb}MB`);
      return;
    }
    onUpload(file);
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
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center ring-2 ring-border">
            <span className="text-muted-foreground text-lg font-display">?</span>
          </div>
        )
      ) : (
        url ? (
          <img
            src={url}
            alt="Pré-visualização do banner"
            className="h-16 w-32 rounded-md object-cover ring-2 ring-border"
          />
        ) : (
          <div className="h-16 w-32 rounded-md bg-muted flex items-center justify-center ring-2 ring-border">
            <span className="text-muted-foreground text-sm font-medium">Sem banner</span>
          </div>
        )
      )}
      <div className="flex flex-col gap-1">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFile}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? 'Enviando…' : `Enviar ${isAvatar ? 'avatar' : 'banner'}`}
        </Button>
        <p className="text-xs text-muted-foreground">
          JPEG, PNG ou WebP · máx. {maxMb}MB
        </p>
      </div>
    </div>
  );
}
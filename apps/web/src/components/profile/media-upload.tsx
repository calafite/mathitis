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
      alert(`${isAvatar ? 'Avatar' : 'Banner'} must be under ${maxMb}MB`);
      return;
    }
    onUpload(file);
    event.target.value = '';
  }

  return (
    <div className="flex items-center gap-4">
      {isAvatar ? (
        <img
          src={url ?? undefined}
          alt="Avatar preview"
          className="h-16 w-16 rounded-full object-cover ring-2 ring-slate-200"
        />
      ) : (
        <img
          src={url ?? undefined}
          alt="Banner preview"
          className="h-16 w-32 rounded-md object-cover ring-2 ring-slate-200"
        />
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
          {uploading ? 'Uploading…' : `Upload ${isAvatar ? 'avatar' : 'banner'}`}
        </Button>
        <p className="text-xs text-slate-500">
          JPEG, PNG or WebP · max {maxMb}MB
        </p>
      </div>
    </div>
  );
}
import { useEffect, useRef, useState } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

export interface ImageCropModalProps {
  open: boolean;
  file: File | null;
  /** Aspect ratio (width / height). 1 = square avatar; ~3 = banner. */
  aspect: number;
  title: string;
  circular?: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

function centerInitialCrop(width: number, height: number, aspect: number): Crop {
  const crop = makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height);
  return centerCrop(crop, width, height);
}

/**
 * Brutalist crop dialog: pick the framing, get a clean WebP-ready file.
 * Output is re-encoded to PNG at natural cropped resolution (server-side
 * Sharp still re-encodes to WebP and strips metadata).
 */
export function ImageCropModal({
  open,
  file,
  aspect,
  title,
  circular = false,
  onCancel,
  onConfirm,
}: ImageCropModalProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!file) {
      setSrc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!open || !src) return null;

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img || !crop || !file) {
      onCancel();
      return;
    }
    // Crop values are percentages of the DISPLAYED image; convert to natural
    // pixels so the exported file matches exactly what the user framed,
    // regardless of how the preview was scaled to fit the dialog.
    const canvas = document.createElement('canvas');
    const sx = crop.x / 100;
    const sy = crop.y / 100;
    const sw = crop.width / 100;
    const sh = crop.height / 100;
    canvas.width = Math.max(1, Math.floor(sw * img.naturalWidth));
    canvas.height = Math.max(1, Math.floor(sh * img.naturalHeight));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      onCancel();
      return;
    }
    ctx.drawImage(
      img,
      sx * img.naturalWidth,
      sy * img.naturalHeight,
      sw * img.naturalWidth,
      sh * img.naturalHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          onCancel();
          return;
        }
        const ext = file.name.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
        const cropped = new File([blob], file.name.replace(/\.\w+$/, '') + `-crop.${ext}`, {
          type: `image/${ext}`,
        });
        onConfirm(cropped);
      },
      file.type === 'image/png' ? 'image/png' : 'image/jpeg',
      0.92,
    );
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-lg border-2 border-[#c9ced8]/50 bg-[#0a0a0b] text-foreground"
        style={{ boxShadow: '10px 10px 0 0 rgba(201, 206, 216, 0.12)' }}
      >
        <div className="flex items-center justify-between border-b border-white/15 px-4 py-2.5">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.25em]">{title}</span>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar recorte"
            className="border border-white/30 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest hover:border-[#c9f24c] hover:text-[#c9f24c]"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[60vh] overflow-auto bg-[#0d0d0f] p-4">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            aspect={aspect}
            circularCrop={circular}
          >
            <img
              ref={imgRef}
              src={src}
              alt="Pré-visualização do recorte"
              onLoad={(e) => {
                const img = e.currentTarget;
                setCrop(centerInitialCrop(img.width, img.height, aspect));
              }}
              className="max-h-[50vh] w-auto max-w-full"
            />
          </ReactCrop>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/15 bg-[#101012] px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="border-2 border-white/40 px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-foreground hover:border-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="border-2 border-[#c9f24c] bg-[#c9f24c] px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-black hover:bg-transparent hover:text-[#c9f24c]"
          >
            Recortar e usar
          </button>
        </div>
      </div>
    </div>
  );
}

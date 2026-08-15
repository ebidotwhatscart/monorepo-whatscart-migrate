import { useState, useCallback } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { X, Check } from "lucide-react";
import { compressImage } from "../lib/imageCompression";

interface ImageCropperProps {
  imageSrc: string;
  aspect?: number;
  onCropComplete: (croppedFile: File) => void;
  onCancel: () => void;
}

export function ImageCropper({
  imageSrc,
  aspect = 2 / 1,
  onCropComplete,
  onCancel,
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropChange = useCallback((location: { x: number; y: number }) => {
    setCrop(location);
  }, []);

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom);
  }, []);

  const onCropAreaChange = useCallback(
    (_: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    [],
  );

  const handleConfirm = useCallback(async () => {
    if (!croppedAreaPixels) return;

    const canvas = document.createElement("canvas");
    const image = new Image();
    image.crossOrigin = "anonymous";

    const imageLoaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Failed to load image"));
      image.src = imageSrc;
    });

    try {
      await imageLoaded;
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) return;

      const rawFile = new File([blob], "logo.png", { type: "image/png" });
      const compressed = await compressImage(rawFile);
      onCropComplete(compressed);
    } catch {
      // Failed to crop
    }
  }, [croppedAreaPixels, imageSrc, onCropComplete]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/80">
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropAreaChange}
          objectFit="contain"
        />
      </div>
      <div className="flex items-center justify-between gap-4 bg-black px-6 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 rounded-lg bg-white/10 px-5 py-3 text-sm font-semibold text-white"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1 w-24 cursor-pointer appearance-none rounded bg-white/30 accent-green-400"
            aria-label="Zoom"
          />
          <button
            type="button"
            onClick={() => void handleConfirm()}
            className="flex items-center gap-2 rounded-lg bg-green-500 px-6 py-3 text-sm font-bold text-white"
          >
            <Check className="h-4 w-4" />
            Crop & Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

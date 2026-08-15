import imageCompression from "browser-image-compression";

export interface CompressOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  fileType?: string;
}

export async function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  const maxSizeMB = opts.maxSizeMB ?? 5;
  const compressed = await imageCompression(file, {
    maxSizeMB,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: "image/webp",
    ...opts,
  });
  if (compressed.size > maxSizeMB * 1024 * 1024) {
    throw new Error("The compressed image is still larger than 5 MB. Please compress it a little and try again.");
  }
  return compressed;
}

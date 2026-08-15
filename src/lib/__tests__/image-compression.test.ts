import imageCompression from "browser-image-compression";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { compressImage } from "../imageCompression";

vi.mock("browser-image-compression", () => ({ default: vi.fn() }));

describe("compressImage", () => {
  beforeEach(() => vi.mocked(imageCompression).mockReset());

  it("targets 5 MB and returns a verified compressed image", async () => {
    const source = new File([new Uint8Array(8 * 1024 * 1024)], "phone.jpg", {
      type: "image/jpeg",
    });
    const compressed = new File([new Uint8Array(4 * 1024 * 1024)], "phone.webp", {
      type: "image/webp",
    });
    vi.mocked(imageCompression).mockResolvedValue(compressed);

    await expect(compressImage(source)).resolves.toBe(compressed);
    expect(imageCompression).toHaveBeenCalledWith(
      source,
      expect.objectContaining({
        maxSizeMB: 5,
        maxWidthOrHeight: 1920,
        fileType: "image/webp",
      }),
    );
    expect(compressed.size).toBeLessThanOrEqual(5 * 1024 * 1024);
  });

  it("rejects output that remains above the compressed-size target", async () => {
    const source = new File([new Uint8Array(5 * 1024 * 1024)], "phone.jpg", {
      type: "image/jpeg",
    });
    vi.mocked(imageCompression).mockResolvedValue(
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "phone.webp", {
        type: "image/webp",
      }),
    );

    await expect(compressImage(source)).rejects.toThrow(
      "compressed image is still larger than 5 MB",
    );
  });
});

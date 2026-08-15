// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";

const emulatorAvailable = Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST);
const describeWithEmulator = emulatorAvailable ? describe : describe.skip;

if (emulatorAvailable) {
  process.env.FIREBASE_PROJECT_ID = "demo-whatscart";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-whatscart";
  process.env.FIREBASE_STORAGE_BUCKET = "demo-whatscart.appspot.com";
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET =
    "demo-whatscart.appspot.com";
  process.env.FIREBASE_UPLOAD_SECRET =
    "local-emulator-upload-secret-at-least-32-characters";
}

type RoutePost = (request: NextRequest) => Promise<Response>;

let authorizeUpload: RoutePost;
let uploadImage: RoutePost;
let resolveUpload: RoutePost;

describeWithEmulator("Firebase customer uploads", () => {
  beforeAll(async () => {
    ({ POST: authorizeUpload } = await import(
      "../../../app/api/public/uploads/authorize/route"
    ));
    ({ POST: uploadImage } = await import(
      "../../../app/api/public/uploads/route"
    ));
    ({ POST: resolveUpload } = await import(
      "../../../app/api/public/uploads/resolve/route"
    ));
  });

  async function authorizedUploadUrl() {
    const response = await authorizeUpload(
      new NextRequest(
        "http://demo-store.whatscart.in/api/public/uploads/authorize",
        { method: "POST" },
      ),
    );
    expect(response.status).toBe(200);
    return ((await response.json()) as { uploadUrl: string }).uploadUrl;
  }

  it("authorizes, stores, and resolves a public customer image", async () => {
    const uploadUrl = await authorizedUploadUrl();
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const uploadResponse = await uploadImage(
      new NextRequest(uploadUrl, {
        method: "POST",
        headers: { "content-type": "image/png" },
        body: bytes,
      }),
    );
    expect(uploadResponse.status).toBe(200);
    const { storageId } = (await uploadResponse.json()) as {
      storageId: string;
    };
    expect(storageId).toMatch(/^customer-uploads\/[0-9a-f-]{36}$/);

    const resolveResponse = await resolveUpload(
      new NextRequest(
        "http://demo-store.whatscart.in/api/public/uploads/resolve",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ storageId }),
        },
      ),
    );
    expect(resolveResponse.status).toBe(200);
    const { url } = (await resolveResponse.json()) as { url: string };
    expect(url).toContain("127.0.0.1:9199/v0/b/demo-whatscart.appspot.com/o/");

    const downloadResponse = await fetch(url);
    expect(downloadResponse.status).toBe(200);
    expect(new Uint8Array(await downloadResponse.arrayBuffer())).toEqual(bytes);
  });

  it("rejects non-images and tampered authorization tokens", async () => {
    const uploadUrl = await authorizedUploadUrl();
    const wrongType = await uploadImage(
      new NextRequest(uploadUrl, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "not an image",
      }),
    );
    expect(wrongType.status).toBe(400);

    const tampered = new URL(uploadUrl);
    tampered.searchParams.set(
      "token",
      `${tampered.searchParams.get("token")}tampered`,
    );
    const tamperedResponse = await uploadImage(
      new NextRequest(tampered, {
        method: "POST",
        headers: { "content-type": "image/png" },
        body: new Uint8Array([1]),
      }),
    );
    expect(tamperedResponse.status).toBe(400);
  });
});

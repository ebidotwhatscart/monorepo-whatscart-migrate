import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { useFirebaseMutation as useMutation } from "../lib/firebase/mutations";
import {
  ArrowLeft,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Star,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api, type Id } from "../lib/firebase/operations";
import { compressImage } from "../lib/imageCompression";
import { getErrorMessage } from "../lib/utils";
import { storefrontPath } from "../lib/urls";

const MAX_PHOTOS = 4;
const MAX_COMMENT_LENGTH = 500;

type PendingPhoto = {
  file: File;
  previewUrl: string;
  storageId?: Id<"_storage">;
};

type ReviewDraft = {
  rating: number;
  comment: string;
  photos: PendingPhoto[];
};

function createDraft(): ReviewDraft {
  return { rating: 0, comment: "", photos: [] };
}

export function ReviewFormPage() {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const reviewForm = useQuery(api.reviews.getReviewForm, { token });
  const generateUploadUrl = useMutation(api.reviews.generateReviewUploadUrl);
  const registerUpload = useMutation(api.reviews.registerReviewUpload);
  const submitReviews = useMutation(api.reviews.submitReviews);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingProductId, setProcessingProductId] = useState<string | null>(
    null,
  );
  const [submitted, setSubmitted] = useState(false);
  const previewUrls = useRef(new Set<string>());

  useEffect(() => {
    if (!reviewForm) return;
    setDrafts((current) => {
      const next = { ...current };
      for (const product of reviewForm.products) {
        next[product.productId] ??= createDraft();
      }
      return next;
    });
  }, [reviewForm]);

  useEffect(() => {
    return () => {
      for (const previewUrl of previewUrls.current)
        URL.revokeObjectURL(previewUrl);
      previewUrls.current.clear();
    };
  }, []);

  const brandColor = useMemo(
    () => reviewForm?.business.themeColor || "#056664",
    [reviewForm?.business.themeColor],
  );

  const updateDraft = (
    productId: string,
    update: (draft: ReviewDraft) => ReviewDraft,
  ) => {
    setDrafts((current) => ({
      ...current,
      [productId]: update(current[productId] ?? createDraft()),
    }));
  };

  const handlePhotos = async (
    productId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const availableSlots = MAX_PHOTOS - (drafts[productId]?.photos.length ?? 0);
    if (availableSlots <= 0) {
      toast.error(`You can add up to ${MAX_PHOTOS} photos per product.`);
      return;
    }

    setProcessingProductId(productId);
    try {
      const nextPhotos: PendingPhoto[] = [];
      for (const file of files.slice(0, availableSlots)) {
        if (!file.type.startsWith("image/")) {
          throw new Error("Only image files can be added.");
        }
        const compressed = await compressImage(file, {
          maxSizeMB: 5,
          maxWidthOrHeight: 1600,
        });
        const previewUrl = URL.createObjectURL(compressed);
        previewUrls.current.add(previewUrl);
        nextPhotos.push({
          file: compressed,
          previewUrl,
        });
      }
      updateDraft(productId, (draft) => ({
        ...draft,
        photos: [...draft.photos, ...nextPhotos],
      }));
      if (files.length > availableSlots) {
        toast.info(`Only the first ${availableSlots} photo(s) were added.`);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setProcessingProductId(null);
    }
  };

  const removePhoto = (productId: string, index: number) => {
    updateDraft(productId, (draft) => {
      const photo = draft.photos[index];
      if (photo) {
        URL.revokeObjectURL(photo.previewUrl);
        previewUrls.current.delete(photo.previewUrl);
      }
      return {
        ...draft,
        photos: draft.photos.filter((_, photoIndex) => photoIndex !== index),
      };
    });
  };

  const uploadPhoto = async (
    productId: string,
    photoIndex: number,
    photo: PendingPhoto,
  ) => {
    if (photo.storageId) return photo.storageId;
    const uploadUrl = await generateUploadUrl({ token });
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": photo.file.type },
      body: photo.file,
    });
    if (!response.ok) throw new Error("A photo could not be uploaded.");
    const payload = (await response.json()) as { storageId?: Id<"_storage"> };
    if (!payload.storageId)
      throw new Error("A photo upload returned no file ID.");
    await registerUpload({ token, storageId: payload.storageId });
    updateDraft(productId, (draft) => ({
      ...draft,
      photos: draft.photos.map((current, index) =>
        index === photoIndex
          ? { ...current, storageId: payload.storageId }
          : current,
      ),
    }));
    return payload.storageId;
  };

  const handleSubmit = async () => {
    if (!reviewForm || reviewForm.status !== "open") return;

    for (const product of reviewForm.products) {
      const draft = drafts[product.productId] ?? createDraft();
      if (draft.rating < 1) {
        toast.error(`Choose a star rating for ${product.name}.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const reviews = [];
      for (const product of reviewForm.products) {
        const draft = drafts[product.productId];
        const imageIds = await Promise.all(
          draft.photos.map((photo, photoIndex) =>
            uploadPhoto(product.productId, photoIndex, photo),
          ),
        );
        reviews.push({
          productId: product.productId,
          rating: draft.rating,
          comment: draft.comment.trim(),
          imageIds,
        });
      }
      await submitReviews({ token, reviews });
      setSubmitted(true);
      toast.success("Thank you! Your feedback was submitted.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (reviewForm === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F9F9F9]">
        <Loader2
          className="h-8 w-8 animate-spin text-[#056664]"
          aria-label="Loading feedback form"
        />
      </main>
    );
  }

  if (!reviewForm) {
    return (
      <ReviewMessage
        title="Review link unavailable"
        message="This feedback link is invalid or is no longer available."
      />
    );
  }

  if (submitted || reviewForm.status === "submitted") {
    return (
      <ReviewMessage
        title="Thank you for your feedback"
        message="Your reviews were submitted and are waiting for the store to publish them."
        actionLabel="Back to store"
        onAction={() => navigate(storefrontPath(reviewForm.business.slug))}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] pb-28 text-[#2D3435]">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[428px] items-center px-4">
          <button
            type="button"
            onClick={() => navigate(storefrontPath(reviewForm.business.slug))}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F2F4F4]"
            aria-label="Back to store"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 pr-10 text-center text-base font-bold">
            Feedback
          </h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[428px] space-y-5 px-4 py-5">
        <div className="px-1">
          <p className="text-sm text-[#5A6061]">
            Order #{reviewForm.orderNumber}
          </p>
          <p className="mt-1 text-sm font-medium">
            Hi {reviewForm.customerName}, rate every product from your order.
          </p>
        </div>

        {reviewForm.products.map((product, productIndex) => {
          const draft = drafts[product.productId] ?? createDraft();
          return (
            <section
              key={product.productId}
              className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_12px_32px_rgba(14,23,38,0.07)]"
            >
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7B8384]">
                Product {productIndex + 1} of {reviewForm.products.length}
              </p>
              <h2 className="mt-2 text-2xl font-bold leading-8">
                Rate your Experience
              </h2>
              <div className="mt-4 flex items-center gap-3">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt=""
                    className="h-14 w-14 rounded-xl object-cover"
                  />
                ) : null}
                <h3 className="text-xl font-bold leading-6">{product.name}</h3>
              </div>

              <fieldset className="mt-6">
                <legend className="text-sm font-medium text-[#5A6061]">
                  Are you satisfied with the product?
                </legend>
                <div
                  className="mt-3 flex gap-2"
                  aria-label={`Rating for ${product.name}`}
                >
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() =>
                        updateDraft(product.productId, (current) => ({
                          ...current,
                          rating,
                        }))
                      }
                      aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
                      aria-pressed={draft.rating === rating}
                      className="rounded-md p-0.5 transition-transform active:scale-90"
                    >
                      <Star
                        className="h-10 w-10"
                        fill={
                          rating <= draft.rating ? "#F7B928" : "transparent"
                        }
                        stroke={rating <= draft.rating ? "#F7B928" : "#C8CECF"}
                      />
                    </button>
                  ))}
                </div>
              </fieldset>

              <label
                className="mt-6 block text-sm font-semibold"
                htmlFor={`review-${product.productId}`}
              >
                Review <span className="font-normal text-[#7B8384]">(Optional)</span>
              </label>
              <textarea
                id={`review-${product.productId}`}
                value={draft.comment}
                maxLength={MAX_COMMENT_LENGTH}
                rows={5}
                onChange={(event) =>
                  updateDraft(product.productId, (current) => ({
                    ...current,
                    comment: event.target.value,
                  }))
                }
                placeholder="What did you like about this product?"
                className="mt-2 w-full resize-none rounded-xl border border-[#DDE2E3] bg-[#F9FAFA] px-4 py-3 text-base outline-none transition focus:border-[#056664] focus:ring-2 focus:ring-[#056664]/10"
              />
              <p className="mt-1 text-right text-xs text-[#7B8384]">
                {draft.comment.length}/{MAX_COMMENT_LENGTH}
              </p>

              <div className="mt-5">
                <p className="text-sm font-semibold">
                  Add pictures of the product (Optional)
                </p>
                {draft.photos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {draft.photos.map((photo, index) => (
                      <div key={photo.previewUrl} className="relative">
                        <img
                          src={photo.previewUrl}
                          alt={`Selected product photo ${index + 1}`}
                          className="h-[77px] w-[77px] rounded-xl object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(product.productId, index)}
                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white"
                          aria-label={`Remove photo ${index + 1}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {draft.photos.length < MAX_PHOTOS && (
                  <label
                    className="mt-3 inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white"
                    style={{ backgroundColor: brandColor }}
                  >
                    {processingProductId === product.productId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    Add Photos
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={processingProductId !== null || isSubmitting}
                      onChange={(event) =>
                        void handlePhotos(product.productId, event)
                      }
                      className="sr-only"
                    />
                  </label>
                )}
              </div>
            </section>
          );
        })}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/95 p-4 backdrop-blur">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isSubmitting || processingProductId !== null}
          className="mx-auto flex w-full max-w-[396px] items-center justify-center gap-2 rounded-xl px-5 py-4 text-base font-bold text-white disabled:opacity-60"
          style={{ backgroundColor: brandColor }}
        >
          {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
          {isSubmitting ? "Submitting feedback..." : "Submit feedback"}
        </button>
      </footer>
    </div>
  );
}

function ReviewMessage({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F9F9F9] p-5 text-[#2D3435]">
      <section className="w-full max-w-[390px] rounded-2xl border border-black/5 bg-white p-7 text-center shadow-[0_12px_32px_rgba(14,23,38,0.07)]">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[#3DAC35]" />
        <h1 className="mt-4 text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[#5A6061]">{message}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-6 w-full rounded-xl bg-[#056664] px-5 py-3 text-sm font-bold text-white"
          >
            {actionLabel}
          </button>
        )}
      </section>
    </main>
  );
}

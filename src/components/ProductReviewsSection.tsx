import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { Star } from "lucide-react";
import { api, type Id } from "../lib/firebase/operations";

export function ProductReviewsSection({
  productId,
}: {
  productId: Id<"products">;
}) {
  const data = useQuery(api.reviews.getApprovedProductReviews, {
    productId,
    limit: 20,
  });

  if (!data || !data.stats || data.stats.approvedCount === 0) return null;

  const rows = [5, 4, 3, 2, 1] as const;
  const counts = {
    1: data.stats.ratings1,
    2: data.stats.ratings2,
    3: data.stats.ratings3,
    4: data.stats.ratings4,
    5: data.stats.ratings5,
  };

  return (
    <section
      aria-labelledby="product-reviews-heading"
      className="px-6 pt-12 lg:px-12"
    >
      <div className="mx-auto max-w-5xl border-t border-[#EBEEEF] pt-10">
        <h2
          id="product-reviews-heading"
          className="text-2xl font-bold text-[#2D3435]"
        >
          Reviews
        </h2>

        <div className="mt-6 grid gap-7 rounded-2xl bg-[#F7F8F8] p-5 sm:grid-cols-[150px_1fr] sm:p-6">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-2">
              <span className="text-4xl font-bold text-[#2D3435]">
                {data.stats.averageRating.toFixed(1)}
              </span>
              <Star
                className="h-7 w-7 fill-[#F7B928] text-[#F7B928]"
                aria-hidden="true"
              />
            </div>
            <p className="mt-2 text-sm text-[#5A6061]">
              {data.stats.approvedCount}{" "}
              {data.stats.approvedCount === 1 ? "Review" : "Reviews"}
            </p>
          </div>

          <div className="space-y-2.5" aria-label="Rating distribution">
            {rows.map((rating) => {
              const count = counts[rating];
              const percentage = (count / data.stats.approvedCount) * 100;
              return (
                <div
                  key={rating}
                  className="grid grid-cols-[22px_1fr_28px] items-center gap-2"
                >
                  <span className="text-xs font-semibold text-[#5A6061]">
                    {rating}
                  </span>
                  <div className="h-2 overflow-hidden rounded-full bg-[#DDE2E3]">
                    <div
                      className="h-full rounded-full bg-[#F7B928]"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-right text-xs text-[#7B8384]">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-7 divide-y divide-[#EBEEEF]">
          {data.reviews.map((review) => (
            <article key={review._id} className="py-6 first:pt-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-bold text-[#2D3435]">
                    {review.displayName}
                  </p>
                  <div
                    className="mt-1 flex gap-0.5"
                    aria-label={`${review.rating} out of 5 stars`}
                  >
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <Star
                        key={rating}
                        className="h-4 w-4"
                        fill={
                          rating <= review.rating ? "#F7B928" : "transparent"
                        }
                        stroke={rating <= review.rating ? "#F7B928" : "#CBD2D3"}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                </div>
                <time className="shrink-0 text-xs text-[#7B8384]">
                  {new Intl.DateTimeFormat("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }).format(new Date(review.submittedAt))}
                </time>
              </div>
              {review.comment && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#5A6061]">
                  {review.comment}
                </p>
              )}
              {review.imageUrls.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {review.imageUrls.map((url: string, index: number) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      <img
                        src={url}
                        alt={`Review photo ${index + 1}`}
                        className="h-[77px] w-[77px] rounded-xl object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

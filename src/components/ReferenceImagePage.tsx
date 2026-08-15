import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { Download } from "lucide-react";
import { api } from "../lib/firebase/operations";
import { resolveReferenceImageUrl } from "../lib/orderFiles";
import { getTenantSlug, storefrontPath } from "../lib/urls";
import { useRuntimeHostname } from "../context/RuntimeLocationContext";
import { StorefrontNotFound } from "./StorefrontNotFound";

export function ReferenceImagePage() {
  const { slug: routeSlug, fileId } = useParams<{ slug: string; fileId: string }>();
  const runtimeHostname = useRuntimeHostname();
  const slug = routeSlug ?? getTenantSlug(runtimeHostname);
  const business = useQuery(
    api.businesses.getBusinessBySlug,
    slug ? { slug } : "skip",
  );
  const [hasError, setHasError] = useState(false);

  const fileUrl = useMemo(
    () => (fileId ? resolveReferenceImageUrl(fileId) : ""),
    [fileId],
  );
  const isLikelyStorageId = Boolean(
    fileId && /^[a-z0-9_-]{20,}$/i.test(fileId),
  );

  if (business === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!business || !fileUrl || !isLikelyStorageId || hasError) {
    return <StorefrontNotFound />;
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] px-4 py-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="rounded-[32px] bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
            Reference Image
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            {business.name}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Review the uploaded customer reference image and download it if needed.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={fileUrl}
              download
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              <Download className="h-4 w-4" />
              Download image
            </a>
            <Link
              to={storefrontPath(business.slug)}
              className="inline-flex items-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
            >
              Back to store
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <img
            src={fileUrl}
            alt="Customer reference upload"
            className="max-h-[80vh] w-full bg-[#f7f7f5] object-contain"
            onError={() => setHasError(true)}
          />
        </div>
      </div>
    </div>
  );
}

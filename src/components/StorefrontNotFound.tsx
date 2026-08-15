import { useState } from "react";
import { Grid3X3, Home, MessageCircle, PackageSearch } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { api } from "../lib/firebase/operations";
import { useCart } from "../context/CartContext";
import { createStorefrontTheme } from "../lib/storefrontTheme";
import { getTenantSlug, storefrontPath } from "../lib/urls";
import { useRuntimeHostname } from "../context/RuntimeLocationContext";
import { StorefrontFooter } from "./StorefrontFooter";
import { StorefrontHeader } from "./StorefrontHeader";

export function StorefrontNotFound() {
  const { slug: routeSlug } = useParams<{ slug: string }>();
  const runtimeHostname = useRuntimeHostname();
  const slug = routeSlug ?? getTenantSlug(runtimeHostname);
  const navigate = useNavigate();
  const business = useQuery(
    api.businesses.getBusinessBySlug,
    slug ? { slug } : "skip",
  );
  const categories = useQuery(
    api.categories.getPublicCategories,
    business?._id ? { businessId: business._id } : "skip",
  );
  const { getTotalItems } = useCart();
  const [searchQuery, setSearchQuery] = useState("");
  const storefrontTheme = createStorefrontTheme({
    themeColor: business?.themeColor,
    brandPalette: business?.brandPalette,
  });

  if (business === undefined || (business && categories === undefined)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8f6]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#3AAA34]" />
      </div>
    );
  }

  if (!business || !slug) {
    return <GenericNotFound />;
  }

  const availableCategories = categories ?? [];

  const whatsappUrl = business.whatsappPhone
    ? `https://wa.me/${business.whatsappPhone.replace(/\D/g, "")}`
    : null;

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        backgroundColor: storefrontTheme.background,
        color: storefrontTheme.textPrimary,
      }}
    >
      <StorefrontHeader
        business={business}
        storefrontTheme={storefrontTheme}
        categories={availableCategories}
        getTotalItems={getTotalItems}
        selectedCategory="all"
        onSelectCategory={(categoryId) => {
          window.location.href = `${storefrontPath(slug)}#${availableCategories.find((category) => category._id === categoryId)?.name ?? ""}`;
        }}
        slug={slug}
        onCartClick={() => navigate(storefrontPath(slug, "cart"))}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="flex flex-1 items-center justify-center px-6 py-16 md:py-24">
        <div className="w-full max-w-2xl text-center">
          <NotFoundVisual />
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Oops! We can&apos;t find that page.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-slate-500">
            This page may have moved, been removed, or never existed in this store.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to={storefrontPath(slug)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-8 py-4 font-semibold text-white shadow-lg transition hover:-translate-y-0.5 sm:w-auto"
              style={{
                backgroundColor: storefrontTheme.ctaBackground,
                color: storefrontTheme.ctaText,
              }}
            >
              <Home className="h-5 w-5" aria-hidden="true" />
              Back to Home
            </Link>
            <Link
              to={storefrontPath(slug, "#products")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-8 py-4 font-semibold text-slate-900 transition hover:bg-slate-50 sm:w-auto"
            >
              <Grid3X3 className="h-5 w-5" aria-hidden="true" />
              Browse Catalog
            </Link>
          </div>
          {whatsappUrl && (
            <div className="mt-16 border-t border-slate-200/70 pt-8">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Need help?
              </p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
                style={{ color: storefrontTheme.support }}
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Chat with the store owner
              </a>
            </div>
          )}
        </div>
      </main>

      <StorefrontFooter
        business={business}
        categories={availableCategories}
        selectedCategory="all"
        onSelectCategory={(categoryId) => {
          window.location.href = `${storefrontPath(slug)}#${availableCategories.find((category) => category._id === categoryId)?.name ?? ""}`;
        }}
        storefrontTheme={storefrontTheme}
      />
    </div>
  );
}

function NotFoundVisual() {
  return (
    <div className="relative mb-10" aria-hidden="true">
      <div className="select-none text-[120px] font-black leading-none tracking-tight text-slate-900/[0.04] md:text-[180px]">
        404
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#f6f8f6] bg-white shadow-lg md:h-32 md:w-32">
          <PackageSearch className="h-12 w-12 text-[#3AAA34] md:h-16 md:w-16" />
        </div>
      </div>
    </div>
  );
}

function GenericNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8f6] px-6 text-center">
      <div className="max-w-lg">
        <NotFoundVisual />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Page not found</h1>
        <p className="mt-4 text-lg text-slate-500">
          The page you requested is not available.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-[#3AAA34] px-8 py-4 font-semibold text-white transition hover:bg-[#218a27]"
        >
          <Home className="h-5 w-5" aria-hidden="true" />
          Go Home
        </Link>
      </div>
    </main>
  );
}

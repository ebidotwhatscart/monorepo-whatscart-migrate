import type { Metadata } from "next";
import { notFound } from "next/navigation";

import TenantClientEntry from "../../../tenant-client-entry";
import {
  getApprovedProductReviews,
  getFeaturedProducts,
  getProductVariants,
  getPublicCatalog,
  getPublicBusinessBySlug,
  getPublicCategories,
  getPublicProduct,
  getPublicProducts,
  getRelatedProducts,
} from "@/lib/firebase/storefront";
import { firebaseQueryKey } from "@/lib/firebase/query-key";
import { tenantOrigin } from "@/lib/tenancy/host";
import { serializeJsonLd } from "@/lib/storefront-seo";

type TenantPageProps = {
  params: Promise<{ tenant: string; path?: string[] }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  const { tenant, path = [] } = await params;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "whatscart.in";
  const business = await getPublicBusinessBySlug(tenant);
  if (!business) return { title: "Store not found" };

  const canonical = `${tenantOrigin(tenant, rootDomain)}/${path.join("/")}`;
  const product =
    path[0] === "products" && path[1]
      ? await getPublicProduct(business.id, path[1])
      : null;
  const title = product?.name ?? business.name;
  const description =
    product?.description ||
    business.description ||
    `Shop products from ${business.name}.`;
  const image = product?.imageUrls[0] ?? business.logoUrl;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: product ? "website" : "website",
      locale: "en_IN",
      siteName: business.name,
      title,
      description,
      url: canonical,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function TenantPage({ params }: TenantPageProps) {
  const { tenant, path = [] } = await params;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "whatscart.in";
  const business = await getPublicBusinessBySlug(tenant);
  if (!business) notFound();

  const product =
    path[0] === "products" && path[1]
      ? await getPublicProduct(business.id, path[1])
      : null;
  const products = product ? [] : await getPublicProducts(business.id);
  const initialQueries: Record<string, unknown> = {
    [firebaseQueryKey("businesses:getBusinessBySlug", { slug: tenant })]: business,
  };
  const pathname = `/${path.join("/")}`;
  const isStorefrontRoot = path.length === 0;
  const isStoreCart = path[0] === "cart" && path.length === 1;
  const isCatalog = path[0] === "catalog" && Boolean(path[1]);
  const isNotFoundCollection =
    (path[0] === "products" || path[0] === "catalog") && path.length === 1;

  if (isStorefrontRoot || isStoreCart) {
    const [categories, featuredProducts] = await Promise.all([
      getPublicCategories(business.id),
      getFeaturedProducts(business.id),
    ]);
    initialQueries[
      firebaseQueryKey("products:getPublicProducts", {
        businessId: business._id,
      })
    ] = products;
    initialQueries[
      firebaseQueryKey("categories:getPublicCategories", {
        businessId: business._id,
      })
    ] = categories;
    if (Array.isArray(business.featuredProductIds) && business.featuredProductIds.length) {
      initialQueries[
        firebaseQueryKey("businesses:getFeaturedProducts", {
          businessId: business._id,
        })
      ] = featuredProducts;
    }
  } else if (isNotFoundCollection) {
    initialQueries[
      firebaseQueryKey("categories:getPublicCategories", {
        businessId: business._id,
      })
    ] = await getPublicCategories(business.id);
  }

  if (isCatalog) {
    initialQueries[
      firebaseQueryKey("catalogs:getPublicCatalog", {
        slug: tenant,
        catalogId: path[1],
      })
    ] = await getPublicCatalog(tenant, path[1]);
  }

  if (product && path[1]) {
    const categoryId =
      typeof product.categoryId === "string" ? product.categoryId : undefined;
    const [related, variants, categories, reviews] = await Promise.all([
      getRelatedProducts(business.id, product._id, categoryId, 8),
      getProductVariants(business.id, product._id),
      getPublicCategories(business.id),
      getApprovedProductReviews(product._id, 20),
    ]);
    initialQueries[
      firebaseQueryKey("products:getPublicProductBySlug", {
        slug: tenant,
        productSlug: path[1],
      })
    ] = product;
    initialQueries[
      firebaseQueryKey("products:getRelatedProducts", {
        businessId: business._id,
        categoryId,
        excludeProductId: product._id,
        limit: 8,
      })
    ] = related;
    initialQueries[
      firebaseQueryKey("products:getProductVariants", {
        productId: product._id,
        businessId: business._id,
      })
    ] = variants;
    initialQueries[
      firebaseQueryKey("categories:getPublicCategories", {
        businessId: business._id,
      })
    ] = categories;
    initialQueries[
      firebaseQueryKey("reviews:getApprovedProductReviews", {
        productId: product._id,
        limit: 20,
      })
    ] = reviews;
  }

  const origin = tenantOrigin(tenant, rootDomain);
  const structuredData = product
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description,
        image: product.imageUrls,
        url: `${origin}/products/${product.slug}`,
        offers: {
          "@type": "Offer",
          priceCurrency: "INR",
          price: product.price,
          availability: product.inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        },
      }
    : {
        "@context": "https://schema.org",
        "@type": "Store",
        name: business.name,
        description: business.description,
        image: business.logoUrl,
        url: origin,
        makesOffer: products.slice(0, 50).map((item) => ({
          "@type": "Offer",
          itemOffered: {
            "@type": "Product",
            name: item.name,
            url: `${origin}/products/${item.slug}`,
          },
        })),
      };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(structuredData),
        }}
      />
      <TenantClientEntry
        firebaseOnly
        hostname={`${tenant}.${rootDomain}`}
        initialQueries={initialQueries}
        pathname={pathname}
      />
    </>
  );
}

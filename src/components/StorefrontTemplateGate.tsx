"use client";

import type { ReactNode } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { api } from "../lib/firebase/operations";
import { getTenantSlug } from "../lib/urls";
import { useRuntimeHostname } from "../context/RuntimeLocationContext";
import { getTemplateMeta } from "../lib/storefrontTemplates";
import { STOREFRONT_TEMPLATE_COMPONENTS } from "./storefrontTemplateHost";

export function StorefrontTemplateGate({ fallback }: { fallback: ReactNode }) {
  const params = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const runtimeHostname = useRuntimeHostname();
  const slug =
    params.slug ?? searchParams.get("slug") ?? getTenantSlug(runtimeHostname);
  const business = useQuery(
    api.businesses.getBusinessBySlug,
    slug ? { slug } : "skip",
  );
  const meta = getTemplateMeta(business?.customTemplateId);
  const Component = meta ? STOREFRONT_TEMPLATE_COMPONENTS[meta.id] : undefined;
  if (!Component) return <>{fallback}</>;
  return <Component fallback={fallback} />;
}

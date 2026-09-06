"use client";

import dynamic from "next/dynamic";
import {
  Authenticated,
  Unauthenticated,
  UserButton,
} from "./lib/firebase/auth-ui";
import { useFirebaseAuth } from "./lib/firebase/auth-context";
import { useFirebaseQuery as useQuery } from "./lib/firebase/hooks";
import { useFirebaseMutation as useMutation } from "./lib/firebase/mutations";
import { api, type Id } from "./lib/firebase/operations";
import { Toaster, toast } from "sonner";
import { BusinessSetup } from "./components/BusinessSetup";
import { DashboardHome } from "./components/DashboardHome";
import { ProductsPage } from "./components/ProductsPage";
import { DashboardOrders } from "./components/DashboardOrders";
import { PromotionsPage } from "./components/PromotionsPage";
import { CreatePromotionPage } from "./components/CreatePromotionPage";
import { ProfilePage } from "./components/ProfilePage";
import { SiteSettings } from "./components/SiteSettings";
import { AdminProfilePage } from "./components/AdminProfilePage";
import { AnalyticsPage } from "./components/AnalyticsPage";
import { BusinessLayout } from "./components/BusinessLayout";
import { Storefront } from "./components/Storefront";
import { StorefrontNotFound } from "./components/StorefrontNotFound";
import { StoreCartPage } from "./components/StoreCartPage";
import { PublicCatalogPage } from "./components/PublicCatalogPage";
import { Cart } from "./components/Cart";
import { ProductDetail } from "./components/ProductDetail";
import LandingPage from "./components/LandingPage";
import { OrderSuccessPage } from "./components/OrderSuccessPage";
import { OrderHistoryPage } from "./components/OrderHistoryPage";
import { OrderDetailPage } from "./components/OrderDetailPage";
import { OrderProductModal } from "./components/OrderProductModal";
import { ReferenceImagePage } from "./components/ReferenceImagePage";
import { ReviewFormPage } from "./components/ReviewFormPage";
import { PWAReloadPrompt } from "./components/PWAReloadPrompt";
import ScrollToTop from "./components/ScrollToTop";
import {
  BrowserRouter,
  MemoryRouter,
  Routes,
  Route,
  Navigate,
  useSearchParams,
} from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import { useEffect, useState } from "react";
import { getErrorMessage } from "./lib/utils";
import logo from "./assets/whatscart-full-logo.png";
import { staticAssetUrl } from "./lib/staticAsset";
import { SuperAdminPortal } from "./components/SuperAdminPortal";
import { adminHostname, appHostname, getTenantSlug, publicRootDomain } from "./lib/urls";

const CheckoutPage = dynamic(
  () => import("./components/CheckoutPage").then((module) => module.CheckoutPage),
  { ssr: false },
);

export default function App({
  initialHostname = "",
  initialPathname = "/",
}: {
  initialHostname?: string;
  initialPathname?: string;
}) {
  const isBrowser = typeof window !== "undefined";
  const hostname = isBrowser ? window.location.hostname : initialHostname;
  const pathname = isBrowser ? window.location.pathname : initialPathname;
  const isSuperAdminHost = hostname === adminHostname;
  const isAppHost = hostname === appHostname;
  const isMainHost = [publicRootDomain, `www.${publicRootDomain}`].includes(hostname);
  const tenantSlug = getTenantSlug(hostname);
  const isAdminDashboardPath = pathname.startsWith("/dashboard");
  const isTenantRoot = Boolean(tenantSlug && pathname === "/");

  const content = (
    <>
      <ScrollToTop />
      <div className="min-h-screen flex flex-col bg-slate-200">
        <div className="flex-1 ">
          {isTenantRoot ? <Storefront /> : <Routes>
            {isSuperAdminHost && !isAdminDashboardPath && <Route path="*" element={<SuperAdminPortal />} />}
            {isMainHost && isAdminDashboardPath && (
              <Route path="/dashboard/*" element={<RedirectToAppDashboard />} />
            )}
            <Route path="/store/:slug" element={<Storefront />} />
            <Route path="/store/:slug/cart" element={<StoreCartPage />} />
            <Route
              path="/store/:slug/catalog/:catalogId"
              element={<PublicCatalogPage />}
            />
            <Route path="/store/:slug/cart/:cartId" element={<Cart />} />
            <Route path="/store/:slug/review/:token" element={<ReviewFormPage />} />
            <Route path="/store/:slug/products" element={<StorefrontNotFound />} />
            <Route path="/store/:slug/catalog" element={<StorefrontNotFound />} />
            <Route
              path="/store/:slug/:fileId"
              element={<ReferenceImagePage />}
            />
            <Route
              path="/store/:slug/products/:productId"
              element={<ProductDetail />}
            />
            {tenantSlug && (
              <>
                <Route path="/" element={<Storefront />} />
                <Route path="/cart" element={<StoreCartPage />} />
                <Route path="/catalog/:catalogId" element={<PublicCatalogPage />} />
                <Route path="/cart/:cartId" element={<Cart />} />
                <Route path="/review/:token" element={<ReviewFormPage />} />
                <Route path="/products" element={<StorefrontNotFound />} />
                <Route path="/catalog" element={<StorefrontNotFound />} />
                <Route path="/:fileId" element={<ReferenceImagePage />} />
                <Route path="/products/:productId" element={<ProductDetail />} />
                <Route path="*" element={<StorefrontNotFound />} />
              </>
            )}
            <Route path="/store/:slug/*" element={<StorefrontNotFound />} />
            <Route path="/review/:token" element={<ReviewFormPage />} />
            {isAppHost && <Route path="/" element={<Navigate to="/dashboard" replace />} />}
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-success" element={<OrderSuccessPage />} />
            <Route path="/my-orders" element={<OrderHistoryPage />} />
            <Route path="/*" element={<MainApp />} />
          </Routes>}
          <Toaster
            position="top-center"
            mobileOffset={{ top: "calc(3.5rem + 1rem)" }}
          />
          <PWAReloadPrompt />
        </div>
      </div>
    </>
  );

  return (
    <CartProvider>
      {isBrowser ? (
        <BrowserRouter>{content}</BrowserRouter>
      ) : (
        <MemoryRouter initialEntries={[initialPathname]}>{content}</MemoryRouter>
      )}
    </CartProvider>
  );
}

function MainApp() {
  return (
    <div className="w-full max-w-[428px] mx-auto">
      <main className="flex-1">
        <div className="w-full">
          <Content />
        </div>
      </main>
    </div>
  );
}

function MainHeader() {
  const userBusiness = useQuery(api.businesses.getUserBusiness);

  if (userBusiness) {
    return null;
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white/80 px-4 shadow-sm backdrop-blur-sm">
      <img src={staticAssetUrl(logo)} alt="StoreBuilder" className="h-8" />
      <Authenticated>
        <UserButton />
      </Authenticated>
    </header>
  );
}

function Content() {
  const { isLoaded, isSignedIn: isAuthenticated } = useFirebaseAuth();
  const isLoading = !isLoaded;
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userBusiness = useQuery(api.businesses.getUserBusiness);
  const [searchParams] = useSearchParams();
  const isDashboardHost =
    window.location.hostname === appHostname ||
    window.location.hostname === "admin.whatscart.in" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "lvh.me" ||
    window.location.hostname === "127.0.0.1";
  const [storedAdminBusinessId, setStoredAdminBusinessId] = useState(() =>
    typeof window !== "undefined" ? window.sessionStorage.getItem("whatscart-admin-business") : null,
  );
  const adminBusinessId = searchParams.get("businessId") || storedAdminBusinessId;
  useEffect(() => {
    const fromUrl = searchParams.get("businessId");
    if (fromUrl) {
      window.sessionStorage.setItem("whatscart-admin-business", fromUrl);
      setStoredAdminBusinessId(fromUrl);
    }
  }, [searchParams]);
  const adminBusiness = useQuery(
    api.superAdmin.getBusinessForAdmin,
    loggedInUser?.role === "super_admin" && adminBusinessId
      ? { businessId: adminBusinessId as Id<"businesses"> }
      : "skip",
  );
  const ensureUser = useMutation(api.auth.ensureUserExists);
  const [showCompletionStage, setShowCompletionStage] = useState(false);

  // Auto-create user in database when authenticated but not in DB yet
  useEffect(() => {
    if (isAuthenticated && loggedInUser === null) {
      ensureUser().catch((error) => {
        toast.error(getErrorMessage(error));
      });
    }
  }, [isAuthenticated, loggedInUser, ensureUser]);

  if (
    isLoading ||
    (isAuthenticated &&
      (loggedInUser === undefined ||
        (!adminBusinessId && userBusiness === undefined) ||
        (adminBusinessId && loggedInUser?.role === "super_admin" && adminBusiness === undefined)))
  ) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const activeBusiness = adminBusinessId ? adminBusiness : userBusiness;

  return (
    <div className="flex flex-col gap-6">
      <Unauthenticated>
        <MainHeader />
        <LandingPage />
      </Unauthenticated>

      <Authenticated>
        {!isDashboardHost ? (
          <LandingPage />
        ) : !activeBusiness || showCompletionStage ? (
          <BusinessSetup
            onCreated={() => setShowCompletionStage(true)}
            onFinish={() => setShowCompletionStage(false)}
          />
        ) : (
          <Routes>
            <Route
              path="/dashboard"
              element={
                  <BusinessLayout business={activeBusiness}>
                  <DashboardHome business={activeBusiness} />
                </BusinessLayout>
              }
            />
            <Route
              path="/dashboard/products/*"
              element={
                  <BusinessLayout business={activeBusiness}>
                  <ProductsPage business={activeBusiness} />
                </BusinessLayout>
              }
            />
            <Route
              path="/dashboard/orders"
              element={
                  <BusinessLayout business={activeBusiness}>
                  <DashboardOrders business={activeBusiness} />
                </BusinessLayout>
              }
            />
            <Route
              path="/dashboard/promotions"
              element={
                <BusinessLayout business={activeBusiness}>
                  <PromotionsPage business={activeBusiness} />
                </BusinessLayout>
              }
            />
            <Route
              path="/dashboard/promotions/create"
              element={
                <BusinessLayout business={activeBusiness}>
                  <CreatePromotionPage business={activeBusiness} />
                </BusinessLayout>
              }
            />
            <Route
              path="/dashboard/catalogs"
              element={
                <Navigate to="/dashboard/products/collections" replace />
              }
            />
            <Route
              path="/dashboard/orders/:orderId/*"
              element={
                  <BusinessLayout business={activeBusiness}>
                  <OrderDetailPage business={activeBusiness} />
                </BusinessLayout>
              }
            >
              <Route
                path="products/:productId"
                element={<OrderProductModal />}
              />
            </Route>
            <Route
              path="/dashboard/profile"
              element={
                  <BusinessLayout business={activeBusiness}>
                  <ProfilePage business={activeBusiness} />
                </BusinessLayout>
              }
            />
            <Route
              path="/dashboard/profile/settings"
              element={
                  <BusinessLayout business={activeBusiness}>
                  <SiteSettings business={activeBusiness} />
                </BusinessLayout>
              }
            />
            <Route
              path="/dashboard/profile/admin"
              element={
                  <BusinessLayout business={activeBusiness}>
                  <AdminProfilePage business={activeBusiness} />
                </BusinessLayout>
              }
            />
            <Route
              path="/dashboard/profile/analytics"
              element={
                  <BusinessLayout business={activeBusiness}>
                  <AnalyticsPage business={activeBusiness} />
                </BusinessLayout>
              }
            />
            <Route
              path="/*"
              element={
                <BusinessLayout business={activeBusiness}>
                  <DashboardHome business={activeBusiness} />
                </BusinessLayout>
              }
            />
          </Routes>
        )}
      </Authenticated>
    </div>
  );
}

function RedirectToAppDashboard() {
  useEffect(() => {
    const destination = `${window.location.protocol}//${appHostname}${window.location.port ? `:${window.location.port}` : ""}${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(destination);
  }, []);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

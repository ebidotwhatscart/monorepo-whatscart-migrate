import { OrderManagement } from "./OrderManagement";
import type { Id } from "../lib/firebase/operations";

interface Business {
  _id: Id<"businesses">;
  name: string;
  slug: string;
  themeColor: string;
  logoId?: Id<"_storage">;
  logoUrl?: string | null;
  whatsappPhone: string;
}

interface DashboardOrdersProps {
  business: Business;
}

export function DashboardOrders({ business }: DashboardOrdersProps) {
  return <OrderManagement businessId={business._id} business={business} />;
}

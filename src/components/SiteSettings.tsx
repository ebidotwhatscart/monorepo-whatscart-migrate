import { StoreSettings } from "./StoreSettings";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import type { Id } from "../lib/firebase/operations";

interface Business {
  _id: Id<"businesses">;
  name: string;
  slug: string;
  themeColor: string;
  logoId?: Id<"_storage">;
  logoUrl?: string | null;
  whatsappPhone: string;
  description?: string;
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    threads?: string;
    x?: string;
  };
}

interface SiteSettingsProps {
  business: Business;
}

export function SiteSettings({ business }: SiteSettingsProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4 px-4 pt-4">
        <Link
          to="/dashboard/profile"
          className="p-2 rounded-full hover:bg-gray-100 transition"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Site Settings</h1>
      </div>
      <StoreSettings business={business} showHeader={false} />
    </div>
  );
}

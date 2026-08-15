import { useState } from "react";
import { useFirebaseMutation as useMutation } from "../lib/firebase/mutations";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useFirebaseAuth } from "../lib/firebase/auth-context";
import { api, type Id } from "../lib/firebase/operations";
import { toast } from "sonner";

interface Business {
  _id: Id<"businesses">;
  name: string;
  slug: string;
  themeColor: string;
  ownerName?: string;
  logoId?: Id<"_storage">;
  logoUrl?: string | null;
  whatsappPhone: string;
}

interface AdminProfilePageProps {
  business: Business;
}

export function AdminProfilePage({ business }: AdminProfilePageProps) {
  const { user } = useFirebaseAuth();
  const [ownerName, setOwnerName] = useState(business.ownerName || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const updateBusiness = useMutation(api.businesses.updateBusiness);

  const email = user?.email || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateBusiness({
        businessId: business._id,
        name: business.name,
        themeColor: business.themeColor,
        whatsappPhone: business.whatsappPhone,
        ownerName: ownerName.trim() || undefined,
      });
      toast.success("Profile updated!");
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8F6]">
      <header className="sticky top-0 z-30 border-b border-[#3DAC35]/10 bg-white/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard/profile"
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#0F172A]"
              aria-label="Back to profile"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-bold tracking-[-0.025em] text-[#0F172A]">
              Admin Profile
            </h1>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit}>
        <main className="space-y-8 px-4 py-6">
          <section className="space-y-4">
            <div className="space-y-4 rounded-xl border border-[#3DAC35]/5 bg-white p-5 shadow-sm">
              <div className="space-y-2">
                <label className="block text-sm font-medium leading-5 text-[#475569]">
                  Owner Name
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="h-12 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-base text-[#0F172A] outline-none focus:border-[#85cf82]"
                  placeholder="Enter owner name"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium leading-5 text-[#475569]">
                  Email
                </label>
                <div className="flex h-12 w-full items-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-base text-[#64748B]">
                  {email || "No email available"}
                </div>
              </div>
            </div>
          </section>
        </main>

        <div className="fixed bottom-0 z-20 border-t border-[#F1F5F9] bg-white/95 px-4 pb-8 pt-4 w-[428px] max-w-full left-1/2 -translate-x-1/2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-14 w-full rounded-xl bg-[#0F172A] text-base font-bold text-white shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1)] disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

import { SignInButton } from "../lib/firebase/auth-ui";
import appIcon from "../assets/app_icon.png";
import { staticAssetUrl } from "../lib/staticAsset";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center bg-white px-6 py-10">
      {/* Green Hero Card */}
      <div
        className="w-full max-w-sm rounded-3xl flex items-center justify-center"
        style={{ backgroundColor: "#3AAA34", height: "340px" }}
      >
        <img
          src={staticAssetUrl(appIcon)}
          alt="WhatsCart Logo"
          className="w-36 h-36 object-contain"
        />
      </div>

      {/* Text */}
      <div className="mt-8 text-center px-4">
        <h1 className="text-3xl font-bold text-black leading-tight">
          Grow your business
          <br />
          across India
        </h1>
        <p className="mt-3 text-gray-400 text-base">
          Join thousands of local sellers
          <br />
          reaching millions of customers daily.
        </p>
      </div>

      {/* Buttons */}
      <div className="mt-10 w-full max-w-sm flex flex-col gap-3">
        <SignInButton>
          <button className="w-full bg-black text-white py-4 rounded-2xl font-semibold text-base">
            Get Started
          </button>
        </SignInButton>

        <SignInButton>
          <button className="w-full bg-gray-100 text-black py-4 rounded-2xl font-semibold text-base">
            Already have account? Login
          </button>
        </SignInButton>
      </div>
    </div>
  );
}

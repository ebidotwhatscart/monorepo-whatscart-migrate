import { useEffect, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Crosshair, MapPin } from "lucide-react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CustomerLocation } from "../lib/orderDetails";

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

const selectedLocationIcon = L.divIcon({
  className: "checkout-location-marker",
  html: '<div style="height:20px;width:20px;border-radius:9999px;border:4px solid #ffffff;background:#056664;box-shadow:0 8px 20px rgba(0,0,0,0.25);"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

type CheckoutLocationPickerProps = {
  location: CustomerLocation | null;
  setLocation: Dispatch<SetStateAction<CustomerLocation | null>>;
  locationLabel: string;
  setLocationLabel: Dispatch<SetStateAction<string>>;
  onUseCurrentLocation: () => void;
  isLocating: boolean;
};

export function CheckoutLocationPicker({
  location,
  setLocation,
  locationLabel,
  setLocationLabel,
  onUseCurrentLocation,
  isLocating,
}: CheckoutLocationPickerProps) {
  const center = useMemo<[number, number]>(
    () =>
      location
        ? [location.latitude, location.longitude]
        : INDIA_CENTER,
    [location],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Location on Map *
          </label>
          <p className="mt-1 text-xs text-gray-500">
            Select the delivery point so the store can find you accurately.
          </p>
        </div>
        <button
          type="button"
          onClick={onUseCurrentLocation}
          disabled={isLocating}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Crosshair className={`h-4 w-4 ${isLocating ? "animate-spin" : ""}`} />
          {isLocating ? "Locating..." : "Use current location"}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200">
        <MapContainer
          center={center}
          zoom={location ? 15 : 5}
          scrollWheelZoom
          className="h-72 w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationPickerMarker location={location} setLocation={setLocation} />
          <MapViewport location={location} />
        </MapContainer>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 text-[#056664]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900">
              {location
                ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
                : "Select a delivery point on the map"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              A map location is required for delivery.
            </p>
          </div>
        </div>
      </div>

      {location && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Landmark or location note (Optional)
          </label>
          <input
            type="text"
            value={locationLabel}
            onChange={(event) => setLocationLabel(event.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="Apartment gate, bakery counter, blue building..."
          />
        </div>
      )}
    </div>
  );
}

function LocationPickerMarker({
  location,
  setLocation,
}: {
  location: CustomerLocation | null;
  setLocation: Dispatch<SetStateAction<CustomerLocation | null>>;
}) {
  useMapEvents({
    click(event) {
      setLocation({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });

  if (!location) {
    return null;
  }

  return (
    <Marker
      position={[location.latitude, location.longitude]}
      icon={selectedLocationIcon}
    />
  );
}

function MapViewport({ location }: { location: CustomerLocation | null }) {
  const map = useMap();

  useEffect(() => {
    if (!location) {
      return;
    }

    map.setView(
      [location.latitude, location.longitude],
      Math.max(map.getZoom(), 15),
      {
        animate: true,
      },
    );
  }, [location, map]);

  return null;
}

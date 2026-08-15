import {
  normalizeBusinessType,
  type BusinessType,
  type StoredBusinessType,
} from "../types/product";

export interface CustomerLocation {
  latitude: number;
  longitude: number;
  label?: string;
}

export function formatDeliveryAddress(order: {
  customerDoorNumber?: string | null;
  customerAddress?: string | null;
}) {
  const doorNumber = order.customerDoorNumber?.trim();
  const address = order.customerAddress?.trim();
  const addressAlreadyIncludesDoorNumber = Boolean(
    doorNumber && address && address.toLowerCase().startsWith(`${doorNumber.toLowerCase()},`),
  );

  return [addressAlreadyIncludesDoorNumber ? "" : doorNumber, address]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

export function getOrderBusinessType(
  businessType?: StoredBusinessType,
): BusinessType {
  return normalizeBusinessType(businessType ?? "garments");
}

export function getLocationLabel(location?: CustomerLocation | null) {
  if (!location) {
    return "";
  }

  if (location.label?.trim()) {
    return location.label.trim();
  }

  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
}

export function getGoogleMapsLocationUrl(location?: CustomerLocation | null) {
  if (!location) {
    return "";
  }

  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
}

export function getCustomizationSectionTitle(businessType: BusinessType) {
  if (businessType === "home_bakery") {
    return "Cake Customization";
  }

  if (businessType === "handicrafts") {
    return "Personalization";
  }

  return "Customization";
}

export function getAddressSectionTitle(businessType: BusinessType) {
  return businessType === "home_bakery" ? "Delivery Address" : "Address";
}

export function getLocationSectionTitle(businessType: BusinessType) {
  return businessType === "home_bakery" ? "Delivery Location" : "Location";
}

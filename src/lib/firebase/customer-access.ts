"use client";

const CUSTOMER_ACCESS_KEY = "whatscart-customer-access";
const ORDER_ACCESS_PREFIX = "whatscart-order-access:";

function createAccessToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getCustomerAccessToken(create = true) {
  if (typeof window === "undefined") return null;
  const existing = window.localStorage.getItem(CUSTOMER_ACCESS_KEY);
  if (existing) return existing;
  if (!create) return null;
  const token = createAccessToken();
  window.localStorage.setItem(CUSTOMER_ACCESS_KEY, token);
  return token;
}

export function storeOrderAccessToken(orderId: string, token: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(`${ORDER_ACCESS_PREFIX}${orderId}`, token);
}

export function getOrderAccessToken(orderId: string) {
  if (typeof window === "undefined") return null;
  const fromUrl = new URLSearchParams(window.location.search).get("accessToken");
  return (
    window.sessionStorage.getItem(`${ORDER_ACCESS_PREFIX}${orderId}`) || fromUrl
  );
}

export function orderAccessPath(path: string, orderId: string) {
  const token = getOrderAccessToken(orderId);
  if (!token) return path;
  const url = new URL(path, "https://whatscart.invalid");
  url.searchParams.set("accessToken", token);
  return `${url.pathname}${url.search}${url.hash}`;
}

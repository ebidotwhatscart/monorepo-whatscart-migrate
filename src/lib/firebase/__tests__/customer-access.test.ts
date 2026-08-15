import { beforeEach, describe, expect, it } from "vitest";

import {
  getCustomerAccessToken,
  getOrderAccessToken,
  orderAccessPath,
  storeOrderAccessToken,
} from "../customer-access";

describe("customer capability storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/checkout");
  });

  it("creates one persistent high-entropy customer token", () => {
    const first = getCustomerAccessToken();
    const second = getCustomerAccessToken();

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
  });

  it("stores an order-specific token and adds it to the shared order URL", () => {
    storeOrderAccessToken("COMM00001", "order-token-12345678901234567890123456789012");

    expect(getOrderAccessToken("COMM00001")).toBe(
      "order-token-12345678901234567890123456789012",
    );
    expect(
      orderAccessPath("/order-success?orderId=COMM00001", "COMM00001"),
    ).toBe(
      "/order-success?orderId=COMM00001&accessToken=order-token-12345678901234567890123456789012",
    );
  });

  it("uses a shared URL capability on a different browser session", () => {
    window.history.replaceState(
      {},
      "",
      "/order-success?orderId=COMM00001&accessToken=shared-token-123456789012345678901234567890",
    );

    expect(getOrderAccessToken("COMM00001")).toBe(
      "shared-token-123456789012345678901234567890",
    );
  });
});

import { describe, expect, it } from "vitest";
import { formatDeliveryAddress } from "../orderDetails";

describe("formatDeliveryAddress", () => {
  it("combines the door number and address for delivery displays", () => {
    expect(
      formatDeliveryAddress({
        customerDoorNumber: " 12A ",
        customerAddress: "Market Road, Coimbatore",
      }),
    ).toBe("12A, Market Road, Coimbatore");
  });

  it("supports legacy orders without a door number", () => {
    expect(
      formatDeliveryAddress({ customerAddress: "Market Road, Coimbatore" }),
    ).toBe("Market Road, Coimbatore");
  });
});

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StorefrontTemplateGate } from "../StorefrontTemplateGate";

const mockBusiness = { current: null as any };

vi.mock("../../lib/firebase/hooks", () => ({
  useFirebaseQuery: vi.fn(() => mockBusiness.current),
}));
vi.mock("../../context/RuntimeLocationContext", () => ({
  useRuntimeHostname: () => "demo.example.com",
}));
vi.mock("../storefrontTemplateHost", () => ({
  STOREFRONT_TEMPLATE_COMPONENTS: {
    nilav: () => <div>Nilav skin</div>,
  },
}));

function renderGate() {
  return render(
    <MemoryRouter initialEntries={["/store/demo"]}>
      <Routes>
        <Route
          path="/store/:slug"
          element={
            <StorefrontTemplateGate fallback={<div>Standard storefront</div>} />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("StorefrontTemplateGate", () => {
  beforeEach(() => {
    mockBusiness.current = null;
  });

  it("renders the standard storefront for a business with no template", () => {
    mockBusiness.current = { _id: "b1", customTemplateId: null };
    renderGate();
    expect(screen.getByText("Standard storefront")).toBeInTheDocument();
  });

  it("renders the standard storefront for an unknown template id", () => {
    mockBusiness.current = { _id: "b1", customTemplateId: "legacy-free-text" };
    renderGate();
    expect(screen.getByText("Standard storefront")).toBeInTheDocument();
  });

  it("renders the registered skin when a template is assigned", () => {
    mockBusiness.current = { _id: "b1", customTemplateId: "nilav" };
    renderGate();
    expect(screen.getByText("Nilav skin")).toBeInTheDocument();
  });
});

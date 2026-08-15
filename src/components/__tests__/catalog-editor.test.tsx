import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation, useQuery } from "convex/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogsPage } from "../CatalogsPage";

const mockUpdateCatalog = vi.fn();
const mockDeleteCatalog = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const business = {
  _id: "biz_1" as never,
  slug: "demo-store",
};

const catalogs = [
  {
    _id: "catalog_1",
    catalogId: "share123",
    businessId: "biz_1",
    name: "Festival Picks",
    productIds: ["product_1", "product_2"],
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
  },
  {
    _id: "catalog_2",
    catalogId: "share456",
    businessId: "biz_1",
    name: "Three Piece Set",
    productIds: ["product_1", "product_2", "product_3"],
    createdAt: 1710000001000,
    updatedAt: 1710000001000,
  },
  {
    _id: "catalog_3",
    catalogId: "share789",
    businessId: "biz_1",
    name: "Full Look",
    productIds: ["product_1", "product_2", "product_3", "product_4"],
    createdAt: 1710000002000,
    updatedAt: 1710000002000,
  },
  {
    _id: "catalog_4",
    catalogId: "share999",
    businessId: "biz_1",
    name: "Mega Drop",
    productIds: [
      "product_1",
      "product_2",
      "product_3",
      "product_4",
      "product_5",
      "product_6",
    ],
    createdAt: 1710000003000,
    updatedAt: 1710000003000,
  },
];

const products = [
  {
    _id: "product_1",
    name: "Cotton Kurta",
    price: 1299,
    inStock: true,
    imageUrls: ["https://example.com/kurta.jpg"],
    category: { name: "Clothing" },
  },
  {
    _id: "product_2",
    name: "Silk Dupatta",
    price: 899,
    inStock: true,
    imageUrls: [],
    category: { name: "Accessories" },
  },
  {
    _id: "product_3",
    name: "Leather Sandals",
    price: 1599,
    inStock: false,
    imageUrls: [],
    category: null,
  },
  {
    _id: "product_4",
    name: "Linen Shirt",
    price: 1299,
    inStock: true,
    imageUrls: ["https://example.com/linen.jpg"],
    category: { name: "Clothing" },
  },
  {
    _id: "product_5",
    name: "Silver Bangles",
    price: 799,
    inStock: true,
    imageUrls: ["https://example.com/bangles.jpg"],
    category: { name: "Accessories" },
  },
  {
    _id: "product_6",
    name: "Silk Saree",
    price: 4599,
    inStock: true,
    imageUrls: ["https://example.com/saree.jpg"],
    category: { name: "Clothing" },
  },
];

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
}

function renderCatalogsPage(initialEntry = "/dashboard/products/collections") {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/dashboard/products/collections"
          element={<CatalogsPage business={business} />}
        />
        <Route
          path="/dashboard/products/collections/edit/:collectionId"
          element={<CatalogsPage business={business} />}
        />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("CatalogsPage editor", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset();
    vi.mocked(useMutation).mockReset();
    mockUpdateCatalog.mockReset();
    mockDeleteCatalog.mockReset();

    let queryCall = 0;
    vi.mocked(useQuery).mockImplementation(() => {
      queryCall += 1;
      return (queryCall % 2 === 1 ? catalogs : products) as never;
    });

    vi.mocked(useMutation).mockImplementation(
      () =>
        ((args: { catalogId: string; name?: string; productIds?: string[] }) => {
          if ("name" in args || "productIds" in args) {
            return mockUpdateCatalog(args);
          }

          return mockDeleteCatalog(args);
        }) as never,
    );
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("renders collection thumbnails that adapt to product count", () => {
    renderCatalogsPage();

    expect(
      screen.getByLabelText(/festival picks collection thumbnail with 2 items/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/three piece set collection thumbnail with 3 items/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/full look collection thumbnail with 4 items/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/mega drop collection thumbnail with 6 items/i),
    ).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("edits a collection name and selected products without using a browser prompt", async () => {
    const user = userEvent.setup();
    const promptSpy = vi.spyOn(window, "prompt");

    renderCatalogsPage();

    await user.click(screen.getByRole("button", { name: /edit festival picks/i }));

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      "/dashboard/products/collections/edit/catalog_1",
    );
    expect(promptSpy).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: /edit collection/i }),
    ).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/collection name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Weekend Offers");

    expect(screen.getByText("Cotton Kurta")).toBeInTheDocument();
    expect(screen.getByText("Silk Dupatta")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /remove silk dupatta from collection/i,
      }),
    );

    await user.click(screen.getByRole("button", { name: /add more/i }));
    expect(
      screen.getByRole("dialog", { name: /add products to collection/i }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: /add leather sandals to collection/i,
      }),
    );

    const editor = screen.getByRole("form", { name: /edit collection/i });
    expect(within(editor).getByText("Cotton Kurta")).toBeInTheDocument();
    expect(within(editor).getByText("Leather Sandals")).toBeInTheDocument();
    expect(within(editor).queryByText("Silk Dupatta")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save collection/i }));

    expect(mockUpdateCatalog).toHaveBeenCalledWith({
      catalogId: "catalog_1",
      name: "Weekend Offers",
      productIds: ["product_1", "product_3"],
    });
  });

  it("loads the edit collection page directly from its route", () => {
    renderCatalogsPage("/dashboard/products/collections/edit/catalog_1");

    expect(
      screen.getByRole("heading", { name: /edit collection/i }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Festival Picks")).toBeInTheDocument();
    expect(screen.getByText("Cotton Kurta")).toBeInTheDocument();
    expect(screen.getByText("Silk Dupatta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add more/i })).toBeInTheDocument();
  });

  it("confirms collection list deletion in a bottom modal", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderCatalogsPage();

    await user.click(
      screen.getByRole("button", { name: /delete festival picks/i }),
    );

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: /delete collection/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/are you sure you want to delete this collection/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(
      screen.queryByRole("dialog", { name: /delete collection/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /delete festival picks/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /^delete collection$/i }),
    );

    expect(mockDeleteCatalog).toHaveBeenCalledWith({ catalogId: "catalog_1" });
  });

  it("confirms edit page deletion in a bottom modal", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderCatalogsPage("/dashboard/products/collections/edit/catalog_1");

    await user.click(
      screen.getByRole("button", { name: /^delete collection$/i }),
    );

    expect(confirmSpy).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: /delete collection/i });
    expect(dialog).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("button", { name: /^delete collection$/i }),
    );

    expect(mockDeleteCatalog).toHaveBeenCalledWith({ catalogId: "catalog_1" });
    expect(screen.getByTestId("pathname")).toHaveTextContent(
      "/dashboard/products/collections",
    );
  });

  it("shows a five second undo after removing a product from the edit page", async () => {
    vi.useFakeTimers();

    renderCatalogsPage("/dashboard/products/collections/edit/catalog_1");

    fireEvent.click(
      screen.getByRole("button", {
        name: /remove silk dupatta from collection/i,
      }),
    );

    const editor = screen.getByRole("form", { name: /edit collection/i });
    expect(within(editor).queryByText("Silk Dupatta")).not.toBeInTheDocument();
    expect(screen.getByText(/silk dupatta removed.*5s/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText(/silk dupatta removed.*4s/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^undo$/i }));

    expect(within(editor).getByText("Silk Dupatta")).toBeInTheDocument();
    expect(screen.queryByText(/silk dupatta removed/i)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /remove silk dupatta from collection/i,
      }),
    );
    expect(screen.getByText(/silk dupatta removed.*5s/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText(/silk dupatta removed/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^undo$/i })).not.toBeInTheDocument();
  });
});

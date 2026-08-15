import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useMutation, useQuery } from "convex/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deriveAccentColor,
  STOREFRONT_PALETTE_NEUTRAL,
} from "../../lib/brandPalette";
import { StoreSettings } from "../StoreSettings";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const updateBusinessMock = vi.fn();
const generateUploadUrlMock = vi.fn();
const deleteCategoryMock = vi.fn();
const createCategoryMock = vi.fn();
const fetchMock = vi.fn();

function createBusiness(overrides?: Partial<Parameters<typeof StoreSettings>[0]["business"]>) {
  return {
    _id: "business-1",
    name: "Asha Textiles",
    slug: "asha-textiles",
    themeColor: "#3dac35",
    whatsappPhone: "9876543210",
    description: "Tailored clothing for modern families.",
    socialLinks: {
      instagram: "",
      facebook: "",
      threads: "",
      x: "",
    },
    ...overrides,
  } as Parameters<typeof StoreSettings>[0]["business"];
}

function getPaletteCard(primaryColor: string) {
  return screen.getByRole("button", {
    name: new RegExp(`primary ${primaryColor}`, "i"),
  });
}

function getPaletteCards() {
  return screen.getAllByRole("button", {
    name: /primary #[0-9a-f]{6}/i,
  });
}

function getPaletteSwatches(primaryColor: string) {
  return within(getPaletteCard(primaryColor)).getAllByLabelText(
    /primary color|accent color|neutral color/i,
  );
}

function changeSeedColor(value: string) {
  fireEvent.input(screen.getByLabelText(/brand primary color/i), {
    target: { value },
  });
}

function mockHuemintResponse(paletteRows: string[][]) {
  return {
    ok: true,
    json: async () => ({
      results: paletteRows,
    }),
  };
}

async function flushPaletteUpdate() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function eventually(assertion: () => void, attempts = 8) {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await flushPaletteUpdate();
    }
  }

  throw lastError;
}

describe("StoreSettings brand palette", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    updateBusinessMock.mockReset();
    generateUploadUrlMock.mockReset();
    deleteCategoryMock.mockReset();
    createCategoryMock.mockReset();
    fetchMock.mockReset();

    const mutationMocks = [
      updateBusinessMock,
      generateUploadUrlMock,
      deleteCategoryMock,
      createCategoryMock,
    ];
    let mutationCallIndex = 0;

    vi.mocked(useMutation).mockImplementation((() => {
      const nextMutationMock =
        mutationMocks[mutationCallIndex % mutationMocks.length];
      mutationCallIndex += 1;
      return nextMutationMock as never;
    }) as typeof useMutation);

    vi.mocked(useQuery).mockImplementation(((_query, args) => {
      if (args === "skip") {
        return undefined as never;
      }

      return [] as never;
    }) as typeof useQuery);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("loads the existing brand palette with a locked neutral swatch", () => {
    render(
      <StoreSettings
        business={createBusiness({
          themeColor: "#884422",
          brandPalette: {
            seedColor: "#445566",
            mode: "dark",
            colors: ["#111827", "#aa7744", "#f8fafc"],
            primaryColor: "#884422",
          },
        })}
      />,
    );

    const selectedPalette = getPaletteCard("#884422");
    const swatches = getPaletteSwatches("#884422");

    expect(selectedPalette).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("#445566")).toBeInTheDocument();
    expect(swatches).toHaveLength(3);
    expect(swatches[0]).toHaveStyle({ backgroundColor: "#884422" });
    expect(swatches[1]).toHaveStyle({ backgroundColor: "#aa7744" });
    expect(swatches[2]).toHaveStyle({ backgroundColor: STOREFRONT_PALETTE_NEUTRAL });
  });

  it("shows a single 3-color storefront preview from the business primary", () => {
    render(<StoreSettings business={createBusiness()} />);

    const selectedPalette = getPaletteCard("#3dac35");
    const swatches = getPaletteSwatches("#3dac35");

    expect(selectedPalette).toHaveAttribute("aria-pressed", "true");
    expect(swatches).toHaveLength(3);
    expect(swatches[0]).toHaveStyle({ backgroundColor: "#3dac35" });
    expect(swatches[1]).toHaveStyle({
      backgroundColor: deriveAccentColor("#3dac35"),
    });
    expect(swatches[2]).toHaveStyle({ backgroundColor: STOREFRONT_PALETTE_NEUTRAL });
  });

  it("shows three locked Huemint options when the primary color changes", async () => {
    fetchMock.mockResolvedValueOnce(
      mockHuemintResponse([
        ["#ffffff", "#225577", "#3b74a1", "#f9f9f9"],
        ["#ffffff", "#225577", "#5f88b3", "#f9f9f9"],
        ["#ffffff", "#225577", "#7d9dc0", "#f9f9f9"],
      ]),
    );

    render(<StoreSettings business={createBusiness()} />);

    changeSeedColor("#225577");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    await flushPaletteUpdate();

    await eventually(() => {
      expect(getPaletteCards()).toHaveLength(3);
    });

    const cards = getPaletteCards();
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveAttribute("aria-pressed", "true");
    expect(cards[1]).toHaveAttribute("aria-pressed", "false");

    const firstSwatches = within(cards[0]).getAllByLabelText(
      /primary color|accent color|neutral color/i,
    );
    const secondSwatches = within(cards[1]).getAllByLabelText(
      /primary color|accent color|neutral color/i,
    );
    const thirdSwatches = within(cards[2]).getAllByLabelText(
      /primary color|accent color|neutral color/i,
    );

    expect(firstSwatches[0]).toHaveStyle({ backgroundColor: "#225577" });
    expect(firstSwatches[1]).toHaveStyle({ backgroundColor: "#3b74a1" });
    expect(firstSwatches[2]).toHaveStyle({ backgroundColor: STOREFRONT_PALETTE_NEUTRAL });
    expect(secondSwatches[1]).toHaveStyle({ backgroundColor: "#5f88b3" });
    expect(thirdSwatches[1]).toHaveStyle({ backgroundColor: "#7d9dc0" });
    expect(
      screen.queryByRole("button", { name: /primary #3dac35/i }),
    ).not.toBeInTheDocument();
  });

  it("saves the selected Huemint option as the locked 3-color brandPalette", async () => {
    fetchMock.mockResolvedValueOnce(
      mockHuemintResponse([
        ["#ffffff", "#225577", "#3b74a1", "#f9f9f9"],
        ["#ffffff", "#225577", "#5f88b3", "#f9f9f9"],
        ["#ffffff", "#225577", "#7d9dc0", "#f9f9f9"],
      ]),
    );

    render(<StoreSettings business={createBusiness()} />);

    changeSeedColor("#225577");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    await flushPaletteUpdate();

    await act(async () => {
      fireEvent.click(getPaletteCards()[1]);
    });

    expect(getPaletteCards()[1]).toHaveAttribute("aria-pressed", "true");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
      await Promise.resolve();
    });

    await eventually(() => {
      expect(updateBusinessMock).toHaveBeenCalledWith({
        businessId: "business-1",
        name: "Asha Textiles",
        themeColor: "#225577",
        brandPalette: {
          seedColor: "#225577",
          mode: "light",
          colors: ["#225577", "#5f88b3", STOREFRONT_PALETTE_NEUTRAL],
          primaryColor: "#225577",
        },
        logoId: undefined,
        whatsappPhone: "919876543210",
        description: "Tailored clothing for modern families.",
        socialLinks: {
          instagram: "",
          facebook: "",
          threads: "",
          x: "",
        },
      });
    });
  });

  it("cycles through cached results before requesting a new Huemint batch", async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockHuemintResponse([
          ["#ffffff", "#225577", "#3b74a1", "#f9f9f9"],
          ["#ffffff", "#225577", "#5f88b3", "#f9f9f9"],
          ["#ffffff", "#225577", "#7d9dc0", "#f9f9f9"],
          ["#ffffff", "#225577", "#8aa6c8", "#f9f9f9"],
          ["#ffffff", "#225577", "#9cb2cf", "#f9f9f9"],
          ["#ffffff", "#225577", "#acbed7", "#f9f9f9"],
        ]),
      )
      .mockResolvedValueOnce(
        mockHuemintResponse([
          ["#ffffff", "#225577", "#2d6998", "#f9f9f9"],
          ["#ffffff", "#225577", "#4b82ad", "#f9f9f9"],
          ["#ffffff", "#225577", "#6898bd", "#f9f9f9"],
        ]),
      );

    render(<StoreSettings business={createBusiness()} />);

    changeSeedColor("#225577");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    await flushPaletteUpdate();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getPaletteCards()).toHaveLength(3);
    expect(
      within(getPaletteCards()[0]).getAllByLabelText(/accent color/i)[0],
    ).toHaveStyle({ backgroundColor: "#3b74a1" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /refresh palette/i }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      within(getPaletteCards()[0]).getAllByLabelText(/accent color/i)[0],
    ).toHaveStyle({ backgroundColor: "#8aa6c8" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /refresh palette/i }));
      await Promise.resolve();
    });

    await eventually(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(
      within(getPaletteCards()[0]).getAllByLabelText(/accent color/i)[0],
    ).toHaveStyle({ backgroundColor: "#2d6998" });
  });
});

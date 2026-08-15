import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useMutation, useQuery } from "convex/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STOREFRONT_PALETTE_NEUTRAL,
} from "../../lib/brandPalette";
import { BusinessSetup } from "../BusinessSetup";

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

class MockFileReader {
  static instances: MockFileReader[] = [];

  onload: ((event: { target: { result: string } }) => void) | null = null;
  result = "";

  static reset() {
    MockFileReader.instances = [];
  }

  readAsDataURL(file: Blob) {
    this.result = `data:image/png;base64,${file instanceof File ? file.name : "brand-preview"}`;
    MockFileReader.instances.push(this);
  }

  complete() {
    this.onload?.({
      target: { result: this.result },
    });
  }
}

const fetchMock = vi.fn();

async function advanceToBranding() {
  render(
    <MemoryRouter>
      <BusinessSetup />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole("button", { name: /start onboarding/i }));
  fireEvent.change(screen.getByLabelText(/owner name/i), {
    target: { value: "Asha Rao" },
  });
  fireEvent.click(screen.getByRole("button", { name: /garments/i }));
  fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

  fireEvent.change(screen.getByLabelText(/business name/i), {
    target: { value: "Asha Textiles" },
  });
  fireEvent.change(screen.getByLabelText(/whatsapp number/i), {
    target: { value: "9876543210" },
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
  expect(screen.getByRole("button", { name: /^continue$/i })).toBeEnabled();

  fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
}

function uploadBrandLogo(name = "logo.png") {
  const fileInput = screen.getByLabelText(/upload business logo/i);
  const file = new File(["logo"], name, { type: "image/png" });

  fireEvent.change(fileInput, {
    target: { files: [file] },
  });
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

describe("BusinessSetup brand palette generation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("FileReader", MockFileReader);
    vi.stubGlobal("fetch", fetchMock);
    MockFileReader.reset();
    fetchMock.mockReset();
    vi.mocked(useMutation).mockReturnValue(vi.fn() as never);
    vi.mocked(useQuery).mockImplementation(((_query, args) => {
      if (args === "skip") {
        return undefined as never;
      }

      return true as never;
    }) as typeof useQuery);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows three locked 3-color storefront palettes after the primary changes", async () => {
    fetchMock.mockResolvedValueOnce(
      mockHuemintResponse([
        ["#ffffff", "#225577", "#3b74a1", "#f9f9f9"],
        ["#ffffff", "#225577", "#5f88b3", "#f9f9f9"],
        ["#ffffff", "#225577", "#7d9dc0", "#f9f9f9"],
      ]),
    );

    await advanceToBranding();

    fireEvent.input(screen.getByLabelText(/brand primary color/i), {
      target: { value: "#225577" },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    await flushPaletteUpdate();

    await eventually(() => {
      expect(getPaletteCards()).toHaveLength(3);
    });

    const cards = getPaletteCards();
    expect(cards).toHaveLength(3);

    const firstSwatches = within(cards[0]).getAllByLabelText(
      /primary color|accent color|neutral color/i,
    );
    const secondSwatches = within(cards[1]).getAllByLabelText(
      /primary color|accent color|neutral color/i,
    );
    const thirdSwatches = within(cards[2]).getAllByLabelText(
      /primary color|accent color|neutral color/i,
    );

    expect(firstSwatches).toHaveLength(3);
    expect(firstSwatches[0]).toHaveStyle({ backgroundColor: "#225577" });
    expect(firstSwatches[1]).toHaveStyle({ backgroundColor: "#3b74a1" });
    expect(firstSwatches[2]).toHaveStyle({ backgroundColor: STOREFRONT_PALETTE_NEUTRAL });
    expect(secondSwatches[1]).toHaveStyle({ backgroundColor: "#5f88b3" });
    expect(thirdSwatches[1]).toHaveStyle({ backgroundColor: "#7d9dc0" });
  });

  it("refreshes the locked palette using the latest primary seed color", async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockHuemintResponse([
          ["#ffffff", "#225577", "#527fa5", "#f9f9f9"],
          ["#ffffff", "#225577", "#5d86ad", "#f9f9f9"],
          ["#ffffff", "#225577", "#7396b8", "#f9f9f9"],
          ["#ffffff", "#225577", "#8aa7c8", "#f9f9f9"],
          ["#ffffff", "#225577", "#9ab3cf", "#f9f9f9"],
          ["#ffffff", "#225577", "#aabfd6", "#f9f9f9"],
        ]),
      )
      .mockResolvedValueOnce(
        mockHuemintResponse([
          ["#ffffff", "#225577", "#2d6998", "#f9f9f9"],
          ["#ffffff", "#225577", "#4b82ad", "#f9f9f9"],
          ["#ffffff", "#225577", "#6898bd", "#f9f9f9"],
        ]),
      );

    await advanceToBranding();

    fireEvent.input(screen.getByLabelText(/brand primary color/i), {
      target: { value: "#225577" },
    });
    fireEvent.click(screen.getByRole("button", { name: /refresh palette/i }));

    await flushPaletteUpdate();

    await eventually(() => {
      expect(getPaletteCards()).toHaveLength(3);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      within(getPaletteCards()[0]).getAllByLabelText(/accent color/i)[0],
    ).toHaveStyle({ backgroundColor: "#527fa5" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /refresh palette/i }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      within(getPaletteCards()[0]).getAllByLabelText(/accent color/i)[0],
    ).toHaveStyle({ backgroundColor: "#8aa7c8" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /refresh palette/i }));
      await Promise.resolve();
    });

    await eventually(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(
      screen.queryByRole("button", { name: /primary #046664/i }),
    ).not.toBeInTheDocument();
    expect(
      within(getPaletteCards()[0]).getAllByLabelText(/accent color/i)[0],
    ).toHaveStyle({ backgroundColor: "#2d6998" });
  });

  it("updates the review preview with the selected business primary color", async () => {
    fetchMock.mockResolvedValueOnce(
      mockHuemintResponse([
        ["#ffffff", "#225577", "#3b74a1", "#f9f9f9"],
        ["#ffffff", "#225577", "#5f88b3", "#f9f9f9"],
        ["#ffffff", "#225577", "#7d9dc0", "#f9f9f9"],
      ]),
    );

    await advanceToBranding();
    uploadBrandLogo();

    fireEvent.input(screen.getByLabelText(/brand primary color/i), {
      target: { value: "#225577" },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    await flushPaletteUpdate();

    await act(async () => {
      fireEvent.click(getPaletteCards()[2]);
    });

    expect(getPaletteCards()[2]).toHaveAttribute("aria-pressed", "true");
    expect(within(getPaletteCards()[2]).getByText(/selected/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    });

    const previewRegion = screen.getByRole("region", {
      name: /customer preview/i,
    });
    await eventually(() => {
      expect(screen.getByText("#225577")).toBeInTheDocument();
    });
    expect(
      within(previewRegion).getByRole("link", { name: /open storefront preview/i }),
    ).toHaveStyle({ color: "#225577" });
  });

  it("ignores stale file reader completions when a newer logo is selected", async () => {
    await advanceToBranding();

    uploadBrandLogo("first-logo.png");
    uploadBrandLogo("second-logo.png");

    expect(MockFileReader.instances).toHaveLength(2);

    await act(async () => {
      MockFileReader.instances[0].complete();
    });

    expect(screen.queryByAltText(/logo preview/i)).not.toBeInTheDocument();

    await act(async () => {
      MockFileReader.instances[1].complete();
    });

    expect(screen.getByAltText(/logo preview/i)).toHaveAttribute(
      "src",
      "data:image/png;base64,second-logo.png",
    );
  });
});

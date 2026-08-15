import { describe, expect, it, vi } from "vitest";
import { buildDailyRevenueBuckets, getDateRangeParams } from "../analytics";

describe("analytics date ranges", () => {
  it("builds whole-day ranges for today and yesterday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T10:30:00+05:30"));

    expect(getDateRangeParams({ type: "today" })).toEqual({
      from: new Date("2026-04-28T00:00:00+05:30").getTime(),
      to: new Date("2026-04-28T23:59:59.999+05:30").getTime(),
    });
    expect(getDateRangeParams({ type: "yesterday" })).toEqual({
      from: new Date("2026-04-27T00:00:00+05:30").getTime(),
      to: new Date("2026-04-27T23:59:59.999+05:30").getTime(),
    });

    vi.useRealTimers();
  });

  it("supports an all-time range", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T10:30:00+05:30"));

    expect(getDateRangeParams({ type: "alltime" })).toEqual({
      from: 0,
      to: Date.now(),
    });

    vi.useRealTimers();
  });
});

describe("buildDailyRevenueBuckets", () => {
  it("keeps the last seven calendar days in chronological order", () => {
    const buckets = buildDailyRevenueBuckets(
      [
        { date: "2026-04-27", revenue: 165, orders: 2 },
        { date: "2026-04-28", revenue: 110, orders: 1 },
      ],
      { type: "7days" },
      new Date("2026-04-28T10:30:00+05:30"),
    );

    expect(buckets.map((bucket) => bucket.label)).toEqual([
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
      "Mon",
      "Tue",
    ]);
    expect(buckets.map((bucket) => bucket.revenue)).toEqual([
      0, 0, 0, 0, 0, 165, 110,
    ]);
  });

  it("uses one bucket per day for today and yesterday filters", () => {
    const todayBuckets = buildDailyRevenueBuckets(
      [{ date: "2026-04-28", revenue: 110, orders: 1 }],
      { type: "today" },
      new Date("2026-04-28T10:30:00+05:30"),
    );
    const yesterdayBuckets = buildDailyRevenueBuckets(
      [{ date: "2026-04-27", revenue: 165, orders: 2 }],
      { type: "yesterday" },
      new Date("2026-04-28T10:30:00+05:30"),
    );

    expect(todayBuckets).toEqual([
      { date: "2026-04-28", label: "Tue", revenue: 110, orders: 1 },
    ]);
    expect(yesterdayBuckets).toEqual([
      { date: "2026-04-27", label: "Mon", revenue: 165, orders: 2 },
    ]);
  });
});

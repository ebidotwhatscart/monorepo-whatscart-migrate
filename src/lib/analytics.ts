export type DateRangeType =
  | "today"
  | "yesterday"
  | "7days"
  | "30days"
  | "alltime"
  | "custom";

export type DateRange =
  | { type: "today" }
  | { type: "yesterday" }
  | { type: "7days" }
  | { type: "30days" }
  | { type: "alltime" }
  | { type: "custom"; from: number; to: number };

export interface SalesTrendPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface DailyRevenueBucket extends SalesTrendPoint {
  label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  const end = startOfDay(date);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return end;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function labelForDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(
    new Date(year, month - 1, day),
  );
}

function getBucketCount(range: DateRange): number {
  switch (range.type) {
    case "today":
    case "yesterday":
      return 1;
    case "30days":
      return 30;
    case "alltime":
      return 30;
    case "custom":
      return Math.max(
        1,
        Math.min(
          30,
          Math.floor(
            (startOfDay(new Date(range.to)).getTime() -
              startOfDay(new Date(range.from)).getTime()) /
              DAY_MS,
          ) + 1,
        ),
      );
    case "7days":
    default:
      return 7;
  }
}

export function getDateRangeParams(
  range: DateRange,
  nowDate = new Date(),
): { from: number; to: number } {
  const now = nowDate.getTime();
  const todayStart = startOfDay(nowDate);
  const todayEnd = endOfDay(nowDate);

  switch (range.type) {
    case "today":
      return { from: todayStart.getTime(), to: todayEnd.getTime() };
    case "yesterday": {
      const yesterday = addDays(todayStart, -1);
      return {
        from: yesterday.getTime(),
        to: endOfDay(yesterday).getTime(),
      };
    }
    case "7days":
      return {
        from: addDays(todayStart, -6).getTime(),
        to: todayEnd.getTime(),
      };
    case "30days":
      return {
        from: addDays(todayStart, -29).getTime(),
        to: todayEnd.getTime(),
      };
    case "alltime":
      return { from: 0, to: now };
    case "custom":
      return { from: range.from, to: range.to };
    default:
      return {
        from: addDays(todayStart, -6).getTime(),
        to: todayEnd.getTime(),
      };
  }
}

export function buildDailyRevenueBuckets(
  salesTrend: SalesTrendPoint[] | undefined,
  range: DateRange,
  nowDate = new Date(),
): DailyRevenueBucket[] {
  if (range.type === "alltime" && salesTrend && salesTrend.length > 0) {
    return [...salesTrend]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30)
      .map((point) => ({
        ...point,
        label: labelForDateKey(point.date),
      }));
  }

  const bucketCount = getBucketCount(range);
  const endDate =
    range.type === "yesterday"
      ? addDays(startOfDay(nowDate), -1)
      : startOfDay(nowDate);
  const startDate =
    range.type === "custom"
      ? startOfDay(new Date(range.from))
      : addDays(endDate, -(bucketCount - 1));

  const trendByDate = new Map(
    (salesTrend ?? []).map((point) => [point.date, point]),
  );

  return Array.from({ length: bucketCount }, (_, index) => {
    const dateKey = toDateKey(addDays(startDate, index));
    const point = trendByDate.get(dateKey);

    return {
      date: dateKey,
      label: labelForDateKey(dateKey),
      revenue: point?.revenue ?? 0,
      orders: point?.orders ?? 0,
    };
  });
}

export function buildShareUrl(
  baseUrl: string,
  platform: string,
): string {
  const url = new URL(baseUrl);
  url.searchParams.set("utm_source", platform);
  url.searchParams.set("utm_medium", "share");
  return url.toString();
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
}

export function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

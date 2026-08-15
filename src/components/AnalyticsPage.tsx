import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { api, type Id } from "../lib/firebase/operations";
import { Link } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  buildDailyRevenueBuckets,
  type DateRange,
  type DateRangeType,
} from "../lib/analytics";

type PresetDateRangeType = Exclude<DateRangeType, "custom">;

interface Business {
  _id: Id<"businesses">;
  name: string;
  slug: string;
  themeColor: string;
}

interface AnalyticsPageProps {
  business: Business;
}

export function AnalyticsPage({ business }: AnalyticsPageProps) {
  const [dateRange, setDateRange] = useState<DateRange>({ type: "7days" });

  const revenue = useQuery(api.analytics.getTotalRevenue, {
    businessId: business._id,
    dateRange,
  });
  const totalViews = useQuery(api.analytics.getTotalPageViews, {
    businessId: business._id,
    dateRange,
  });
  const totalOrders = useQuery(api.analytics.getTotalOrders, {
    businessId: business._id,
    dateRange,
  });
  const topProducts = useQuery(api.analytics.getTopProducts, {
    businessId: business._id,
    dateRange,
    limit: 5,
  });
  const salesTrend = useQuery(api.analytics.getSalesTrend, {
    businessId: business._id,
    dateRange,
    groupBy: "day",
  });
  const trafficSources = useQuery(api.analytics.getTrafficSources, {
    businessId: business._id,
    dateRange,
  });
  const topCustomers = useQuery(api.analytics.getTopCustomers, {
    businessId: business._id,
    dateRange,
    limit: 5,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const chartBuckets = buildDailyRevenueBuckets(salesTrend, dateRange);

  const maxRevenue =
    chartBuckets.reduce(
      (max, day) => (day.revenue > max ? day.revenue : max),
      0,
    ) || 0;

  return (
    <div className="min-h-screen bg-[#F6F8F6]">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-green-100 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-4">
          <Link
            to="/dashboard/profile"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">
            Your website insights
          </h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Date Range Selector */}
        <div className="flex justify-end">
          <select
            value={dateRange.type}
            onChange={(e) =>
              setDateRange({ type: e.target.value as PresetDateRangeType })
            }
            className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-700"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="alltime">All time</option>
          </select>
        </div>

        {/* Stats Cards */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-green-100/50">
          <div className="flex justify-between">
            <div className="text-center">
              <p className="text-lg font-bold text-green-500">
                {formatCurrency(revenue ?? 0)}
              </p>
              <p className="text-sm text-gray-500">Revenue</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-700">
                {totalViews ?? "-"}
              </p>
              <p className="text-sm text-gray-500">Total Views</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-700">
                {totalOrders ?? "-"}
              </p>
              <p className="text-sm text-gray-500">Total Orders</p>
            </div>
          </div>
        </div>

        {/* Best Selling Products */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-green-100/50">
          <h2 className="text-base font-medium text-gray-700 mb-4">
            Best selling products
          </h2>

          {/* Table Header */}
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
            <span className="w-6 text-xs font-medium text-gray-500">#</span>
            <span className="flex-1 text-xs font-medium text-gray-500">
              Product
            </span>
            <span className="w-20 text-xs font-medium text-gray-500 text-right">
              Revenue
            </span>
            <span className="w-12 text-xs font-medium text-gray-500 text-right">
              Sales
            </span>
          </div>

          {/* Table Rows */}
          {topProducts && topProducts.length > 0 ? (
            topProducts.map((product, index) => (
              <div
                key={product.productId}
                className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0"
              >
                <span className="w-6 text-sm font-medium text-gray-700">
                  {index + 1}
                </span>
                <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                  {product.name}
                </span>
                <span className="w-20 text-sm font-medium text-gray-800 text-right">
                  {formatCurrency(product.revenue)}
                </span>
                <span className="w-12 text-sm font-medium text-gray-600 text-right">
                  {product.sold}
                </span>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-sm text-gray-400">
              No products sold yet
            </div>
          )}
        </div>

        {/* Top Customers */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-green-100/50">
          <h2 className="text-base font-medium text-gray-700 mb-4">
            Top customers
          </h2>

          {/* Table Header */}
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
            <span className="w-6 text-xs font-medium text-gray-500">#</span>
            <span className="flex-1 text-xs font-medium text-gray-500">
              Phone
            </span>
            <span className="w-20 text-xs font-medium text-gray-500 text-right">
              Spent
            </span>
            <span className="w-12 text-xs font-medium text-gray-500 text-right">
              Orders
            </span>
          </div>

          {/* Table Rows */}
          {topCustomers && topCustomers.length > 0 ? (
            topCustomers.map((customer, index) => (
              <div
                key={customer.mobile}
                className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0"
              >
                <span className="w-6 text-sm font-medium text-gray-700">
                  {index + 1}
                </span>
                <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                  {customer.name || customer.mobile}
                </span>
                <span className="w-20 text-sm font-medium text-gray-800 text-right">
                  {formatCurrency(customer.totalSpend)}
                </span>
                <span className="w-12 text-sm font-medium text-gray-600 text-right">
                  {customer.orders}
                </span>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-sm text-gray-400">
              No customers yet
            </div>
          )}
        </div>

        {/* Revenue Trends */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100/50">
          <h2 className="text-base font-medium text-gray-700 mb-4">
            Revenue trends
          </h2>

          <div className="relative h-40">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between text-xs text-gray-400">
              <span>₹{Math.round(maxRevenue)}</span>
              <span>₹{Math.round(maxRevenue / 2)}</span>
              <span>₹0</span>
            </div>

            {/* Chart area */}
            <div className="ml-10 h-full flex items-end gap-1.5 sm:gap-2">
              {chartBuckets.map((bucket, index) => {
                const height =
                  maxRevenue > 0 ? (bucket.revenue / maxRevenue) * 100 : 0;
                const showLabel =
                  chartBuckets.length <= 7 ||
                  index === 0 ||
                  index === chartBuckets.length - 1 ||
                  index % 5 === 0;

                return (
                  <div
                    key={bucket.date}
                    className="h-full min-w-0 flex-1 flex flex-col items-center gap-2"
                  >
                    <div
                      className="w-full flex-1 flex items-end"
                      title={`${bucket.label}: ${formatCurrency(bucket.revenue)}`}
                    >
                      <div
                        className="w-full bg-green-400 rounded-t-md transition-all"
                        style={{
                          height:
                            bucket.revenue > 0
                              ? `${Math.max(height, 6)}%`
                              : "2px",
                        }}
                      />
                    </div>
                    <span className="h-4 text-[10px] text-gray-500">
                      {showLabel ? bucket.label : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Traffic Source */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-green-100/50">
          <h2 className="text-base font-medium text-gray-700 mb-4">
            Traffic source
          </h2>

          {/* Donut Chart Visualization */}
          <div className="flex items-center justify-center gap-8">
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="12"
                />
                {trafficSources && trafficSources.length > 0 && (
                  <>
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      fill="none"
                      stroke="#3DAC35"
                      strokeWidth="12"
                      strokeDasharray={`${(trafficSources[0].percentage / 100) * 351} 351`}
                      strokeDashoffset="0"
                    />
                    {trafficSources[1] && (
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="12"
                        strokeDasharray={`${(trafficSources[1].percentage / 100) * 351} 351`}
                        strokeDashoffset={`-${(trafficSources[0].percentage / 100) * 351}`}
                      />
                    )}
                    {trafficSources[2] && (
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke="#8B5CF6"
                        strokeWidth="12"
                        strokeDasharray={`${(trafficSources[2].percentage / 100) * 351} 351`}
                        strokeDashoffset={`-${((trafficSources[0].percentage + trafficSources[1].percentage) / 100) * 351}`}
                      />
                    )}
                  </>
                )}
              </svg>
            </div>

            {/* Legend */}
            <div className="space-y-3">
              {trafficSources && trafficSources.length > 0 ? (
                trafficSources.map((source, index) => {
                  const colors = [
                    "bg-green-500",
                    "bg-amber-500",
                    "bg-purple-500",
                  ];
                  const labels: Record<string, string> = {
                    whatsapp: "WhatsApp",
                    instagram: "Instagram",
                    facebook: "Facebook",
                    threads: "Threads",
                    x: "X (Twitter)",
                    telegram: "Telegram",
                    share: "App Share",
                    direct: "Copied Link",
                    organic: "Organic",
                  };
                  return (
                    <div
                      key={source.source}
                      className="flex items-center gap-2"
                    >
                      <div
                        className={`w-3 h-3 rounded-full ${colors[index] || "bg-gray-400"}`}
                      />
                      <span className="text-sm text-gray-600">
                        {labels[source.source] || source.source}
                      </span>
                      <span className="text-sm font-medium text-gray-800">
                        {source.percentage}%
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-gray-400">No traffic data</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

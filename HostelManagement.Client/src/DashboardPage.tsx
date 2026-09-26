import { useEffect, useState } from "react";

export type DashboardDestination =
  | "bills"
  | "tenants"
  | "rooms"
  | "complaints"
  | "attendance"
  | "notifications"
  | "reports"
  | "reminders"
  | "overdue";

interface CollectionTrendItem {
  date: string;
  amount: number;
}

interface DashboardSummary {
  activeTenantCount: number;
  activeRoomCount: number;
  totalCapacity: number;
  occupiedBeds: number;
  vacantRooms: number;
  occupancyPercentage: number;
  collectedAmount: number;
  outstandingAmount: number;
  overdueCount: number;
  overdueAmount: number;
  collectionTrend: CollectionTrendItem[];
}

interface DashboardPageProps {
  hostelId: number;
  accessToken: string;
  onNavigate: (page: DashboardDestination) => void;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5204";

function localDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function DashboardPage({ hostelId, accessToken, onNavigate }: DashboardPageProps) {
  const today = new Date();
  const fromDate = localDateValue(new Date(today.getFullYear(), today.getMonth(), 1));
  const toDate = localDateValue(today);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadDashboard() {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({ fromDate, toDate });
        const response = await fetch(
          `${apiBaseUrl}/api/hostels/${hostelId}/reports/summary?${query}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!response.ok) {
          const text = await response.text();
          let message = text || `Request failed (${response.status}).`;
          try { message = JSON.parse(text).message ?? message; } catch { /* Keep response text. */ }
          throw new Error(message);
        }
        const data: DashboardSummary = await response.json();
        if (!cancelled) setSummary(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadDashboard();
    return () => { cancelled = true; };
  }, [hostelId, accessToken, fromDate, toDate]);

  const monthLabel = today.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const maxCollection = Math.max(1, ...(summary?.collectionTrend.map((item) => item.amount) ?? []));
  const metrics = summary ? [
    { icon: "♙", label: "Total tenants", value: String(summary.activeTenantCount), color: "blue" },
    { icon: "▣", label: "Occupied beds", value: `${summary.occupiedBeds} / ${summary.totalCapacity}`, color: "green" },
    { icon: "⌂", label: "Vacant rooms", value: String(summary.vacantRooms), color: "orange" },
    { icon: "◉", label: "Occupancy", value: `${summary.occupancyPercentage}%`, color: "violet" },
    { icon: "₹", label: "Rent collection", value: formatMoney(summary.collectedAmount), color: "green" },
    { icon: "◷", label: "Outstanding", value: formatMoney(summary.outstandingAmount), color: "orange" },
    { icon: "!", label: "Overdue bills", value: String(summary.overdueCount), color: "red" },
    { icon: "₹", label: "Overdue amount", value: formatMoney(summary.overdueAmount), color: "red" },
  ] : [];

  return (
    <section className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">HOSTEL OVERVIEW</span>
          <h2>Dashboard</h2>
          <p>{monthLabel} · {fromDate} to {toDate}</p>
        </div>
        <button className="notification-shortcut" type="button" onClick={() => onNavigate("notifications")} aria-label="Open notifications">♧</button>
      </div>

      {error && <p role="alert">{error}</p>}
      {loading && <div className="dashboard-loading"><span className="loading-dot" />Loading your overview…</div>}

      {!loading && summary && <>
        <div className="metric-grid">
          {metrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <span className={`metric-icon ${metric.color}`} aria-hidden="true">{metric.icon}</span>
              <div><h3>{metric.label}</h3><p>{metric.value}</p></div>
            </article>
          ))}
        </div>

        <section className="collection-card">
          <div className="section-title-row">
            <div><h3>Monthly collection</h3><p>Payments received this month</p></div>
            <button type="button" className="small-link-button" onClick={() => onNavigate("reports")}>Details</button>
          </div>
          {summary.collectionTrend.length === 0 ? (
            <div className="empty-chart">No collections recorded this month.</div>
          ) : (
            <div className="collection-chart" role="img" aria-label="Daily collection chart">
              {summary.collectionTrend.map((item, index) => {
                const day = new Date(`${item.date}T00:00:00`).getDate();
                return <div className="chart-column" key={`${item.date}-${index}`} title={`${item.date}: ${formatMoney(item.amount)}`}>
                  <span className="chart-amount">{item.amount > 0 ? formatMoney(item.amount) : ""}</span>
                  <div className="chart-track"><span style={{ height: `${Math.max(4, item.amount / maxCollection * 100)}%` }} /></div>
                  <small>{day % 5 === 1 || day === 1 ? String(day).padStart(2, "0") : ""}</small>
                </div>;
              })}
            </div>
          )}
          <div className="chart-legend"><span /> Collection amount</div>
        </section>

        <section className="quick-actions-section">
          <div className="section-title-row"><div><h3>Quick actions</h3><p>Common tasks</p></div></div>
          <div className="quick-action-grid">
            <button type="button" onClick={() => onNavigate("tenants")}><span>♙</span>Manage tenants<b>›</b></button>
            <button type="button" onClick={() => onNavigate("rooms")}><span>⌂</span>Manage rooms<b>›</b></button>
            <button type="button" onClick={() => onNavigate("bills")}><span>₹</span>Create or view bills<b>›</b></button>
            <button type="button" onClick={() => onNavigate("complaints")}><span>☷</span>Review complaints<b>›</b></button>
            <button type="button" onClick={() => onNavigate("overdue")}><span>◷</span>Overdue alerts<b>›</b></button>
            <button type="button" onClick={() => onNavigate("reports")}><span>▥</span>Open reports<b>›</b></button>
          </div>
        </section>
      </>}
    </section>
  );
}

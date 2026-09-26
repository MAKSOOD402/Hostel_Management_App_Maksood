import { useEffect, useState } from "react";
import type { FormEvent } from "react";

interface CollectionTrendItem {
  date: string;
  amount: number;
}

interface ReportSummary {
  period: {
    fromDate: string;
    toDate: string;
  };
  activeTenantCount: number;
  activeRoomCount: number;
  totalCapacity: number;
  occupiedBeds: number;
  vacantRooms: number;
  occupancyPercentage: number;
  billedAmount: number;
  collectedAmount: number;
  outstandingBillCount: number;
  outstandingAmount: number;
  overdueCount: number;
  overdueAmount: number;
  collectionTrend: CollectionTrendItem[];
}

interface ReportsPageProps {
  hostelId: number;
  accessToken: string;
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5204";

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
    maximumFractionDigits: 2,
  }).format(amount);
}

async function readError(response: Response) {
  const text = await response.text();

  if (!text) {
    return `Request failed (${response.status}).`;
  }

  try {
    const data = JSON.parse(text);
    return data.message ?? text;
  } catch {
    return text;
  }
}

export default function ReportsPage({
  hostelId,
  accessToken,
}: ReportsPageProps) {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [fromDate, setFromDate] = useState(localDateValue(firstDayOfMonth));
  const [toDate, setToDate] = useState(localDateValue(today));
  const [appliedDates, setAppliedDates] = useState({
    fromDate: localDateValue(firstDayOfMonth),
    toDate: localDateValue(today),
  });

  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      setLoading(true);
      setError("");

      try {
        const query = new URLSearchParams({
          fromDate: appliedDates.fromDate,
          toDate: appliedDates.toDate,
        });

        const response = await fetch(
          `${apiBaseUrl}/api/hostels/${hostelId}/reports/summary?${query}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(await readError(response));
        }

        const data: ReportSummary = await response.json();

        if (!cancelled) {
          setReport(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load report."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReport();

    return () => {
      cancelled = true;
    };
  }, [hostelId, accessToken, appliedDates]);

  function applyDateRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (toDate < fromDate) {
      setError("The end date must be on or after the start date.");
      return;
    }

    setAppliedDates({ fromDate, toDate });
  }

  return (
    <section className="hm-page reports-page">
      <header className="hm-page-heading"><div><span className="hm-eyebrow">INSIGHTS</span><h2>Reports</h2><p>Occupancy and collection summary.</p></div></header>

      <form onSubmit={applyDateRange}>
        <label>
          From
          <input
            type="date"
            required
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </label>

        <label>
          To
          <input
            type="date"
            required
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </label>

        <button type="submit">Load report</button>
      </form>

      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
      {loading && <p>Loading report...</p>}

      {!loading && report && (
        <>
          <h3>
            {report.period.fromDate} to {report.period.toDate}
          </h3>

          <div className="report-metrics"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 16,
              margin: "20px 0",
            }}
          >
            <article className="report-metric">
              <h4>Active tenants</h4>
              <p>{report.activeTenantCount}</p>
            </article>

            <article className="report-metric">
              <h4>Active rooms</h4>
              <p>{report.activeRoomCount}</p>
            </article>

            <article className="report-metric">
              <h4>Occupied beds / capacity</h4>
              <p>
                {report.occupiedBeds} / {report.totalCapacity}
              </p>
            </article>

            <article className="report-metric">
              <h4>Vacant rooms</h4>
              <p>{report.vacantRooms}</p>
            </article>

            <article className="report-metric">
              <h4>Occupancy</h4>
              <p>{report.occupancyPercentage}%</p>
            </article>

            <article className="report-metric">
              <h4>Billed in period</h4>
              <p>{formatMoney(report.billedAmount)}</p>
            </article>

            <article className="report-metric">
              <h4>Collected in period</h4>
              <p>{formatMoney(report.collectedAmount)}</p>
            </article>

            <article className="report-metric">
              <h4>Outstanding bills</h4>
              <p>
                {report.outstandingBillCount} ·{" "}
                {formatMoney(report.outstandingAmount)}
              </p>
            </article>

            <article className="report-metric">
              <h4>Overdue bills</h4>
              <p>
                {report.overdueCount} · {formatMoney(report.overdueAmount)}
              </p>
            </article>
          </div>

          <h3>Collection trend</h3>

          {report.collectionTrend.length === 0 ? (
            <p>No collections in this date range.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Collected</th>
                </tr>
              </thead>
              <tbody>
                {report.collectionTrend.map((item) => (
                  <tr key={item.date}>
                    <td>{item.date}</td>
                    <td>{formatMoney(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}

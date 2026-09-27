import { useEffect, useState } from "react";
import BillDetailsButton from "./BillDetailsButton";
import PayBillButton from "./PayBillButton";

interface Bill {
  id: number;
  billNumber: string;
  tenantId: number;
  tenantName: string;
  dueDate: string;
  totalAmount: number;
  status: string;
}

interface OverdueAlertsPageProps {
  hostelId: number;
  accessToken: string;
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "https://hostelmanagementapp-epa5awhmedaxh5au.southindia-01.azurewebsites.net";

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
  }).format(amount);
}

export default function OverdueAlertsPage({
  hostelId,
  accessToken,
}: OverdueAlertsPageProps) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadOverdueBills() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/hostels/${hostelId}/bills`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          const text = await response.text();
          let message = text || `Request failed (${response.status}).`;

          try {
            message = JSON.parse(text).message ?? message;
          } catch {
            // Keep the response text as the error.
          }

          throw new Error(message);
        }

        const allBills: Bill[] = await response.json();
        const today = localDateValue(new Date());

        const overdueBills = allBills
          .filter((bill) => {
            const status = bill.status.toLowerCase();

            return (
              status === "overdue" ||
              (status === "pending" && bill.dueDate < today)
            );
          })
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

        if (!cancelled) {
          setBills(overdueBills);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load overdue bills."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOverdueBills();

    return () => {
      cancelled = true;
    };
  }, [hostelId, accessToken]);

  const overdueTotal = bills.reduce(
    (sum, bill) => sum + bill.totalAmount,
    0
  );

  return (
    <section className="hm-page overdue-page">
      <header className="hm-page-heading"><div><span className="hm-eyebrow">COLLECTIONS</span><h2>Overdue alerts</h2><p>Follow up on pending rent payments.</p></div></header>
      <div className="overdue-summary">
      <p>
        {bills.length} overdue bill(s) · Total billed{" "}
        {formatMoney(overdueTotal)}
      </p></div>

      {error && <p role="alert">{error}</p>}
      {loading && <p>Loading overdue bills...</p>}

      {!loading && bills.length === 0 && (
        <p>No overdue bills. Everything is up to date.</p>
      )}

      {!loading && bills.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Bill</th>
              <th>Tenant</th>
              <th>Due date</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id}>
                <td>{bill.billNumber}</td>
                <td>{bill.tenantName}</td>
                <td>{bill.dueDate}</td>
                <td>{formatMoney(bill.totalAmount)}</td>
                <td>{bill.status}</td>
                <td>
                  <BillDetailsButton
                    hostelId={hostelId}
                    billId={bill.id}
                    accessToken={accessToken}
                  />{" "}
                  <PayBillButton
                    hostelId={hostelId}
                    billId={bill.id}
                    accessToken={accessToken}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

import { useState } from "react";

interface BillDetails {
  bill: {
    billNumber: string;
    tenantId: number;
    periodStart: string;
    periodEnd: string;
    issueDate: string;
    dueDate: string;
    subtotal: number;
    totalAmount: number;
    status: string;
    paidAt: string | null;
    notes: string | null;
  };
  items: {
    id: number;
    category: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
}

interface BillDetailsButtonProps {
  hostelId: number;
  billId: number;
  accessToken: string;
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5204";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function BillDetailsButton({
  hostelId,
  billId,
  accessToken,
}: BillDetailsButtonProps) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<BillDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function showDetails() {
    setOpen(true);
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/bills/${billId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const text = await response.text();
        let errorMessage = text || `Request failed (${response.status}).`;

        try {
          errorMessage = JSON.parse(text).message ?? errorMessage;
        } catch {
          // Keep the response text as the error message.
        }

        throw new Error(errorMessage);
      }

      setDetails(await response.json());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load bill details."
      );
    } finally {
      setLoading(false);
    }
  }

  function printBill() {
    if (!details) return;

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      setError("Allow pop-ups in your browser to print the bill.");
      return;
    }

    const bill = details.bill;
    const itemRows = details.items
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.category)}</td>
            <td>${escapeHtml(item.description)}</td>
            <td>${item.quantity}</td>
            <td>${formatMoney(item.unitPrice)}</td>
            <td>${formatMoney(item.amount)}</td>
          </tr>
        `
      )
      .join("");

    const notes = bill.notes
      ? `<p><strong>Notes:</strong> ${escapeHtml(bill.notes)}</p>`
      : "";

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Bill ${escapeHtml(bill.billNumber)}</title>
          <style>
            body { font: 14px Arial, sans-serif; color: #222; margin: 40px; }
            h1 { margin-bottom: 4px; }
            .muted { color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; }
            th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
            th { background: #f2f2f2; }
            .total { text-align: right; margin-top: 24px; font-size: 18px; }
          </style>
        </head>
        <body>
          <h1>Hostel Management</h1>
          <p class="muted">Bill / Invoice</p>
          <hr />
          <p><strong>Bill number:</strong> ${escapeHtml(bill.billNumber)}</p>
          <p><strong>Tenant ID:</strong> ${bill.tenantId}</p>
          <p><strong>Status:</strong> ${escapeHtml(bill.status)}</p>
          <p><strong>Billing period:</strong>
            ${escapeHtml(bill.periodStart)} – ${escapeHtml(bill.periodEnd)}
          </p>
          <p><strong>Issue date:</strong> ${escapeHtml(bill.issueDate)}</p>
          <p><strong>Due date:</strong> ${escapeHtml(bill.dueDate)}</p>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
          <p class="total"><strong>Total: ${formatMoney(bill.totalAmount)}</strong></p>
          ${notes}
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <>
      <button type="button" onClick={() => void showDetails()}>
        View details
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`bill-details-title-${billId}`}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: 16,
            background: "rgb(16 24 40 / 55%)",
          }}
        >
          <section
            style={{
              width: "min(720px, 100%)",
              maxHeight: "90vh",
              overflow: "auto",
              padding: 24,
              background: "white",
              borderRadius: 12,
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ float: "right" }}
            >
              Close
            </button>

            <h2 id={`bill-details-title-${billId}`}>Bill details</h2>

            {loading && <p>Loading bill...</p>}
            {error && <p role="alert">{error}</p>}

            {details && (
              <>
                <p><strong>Bill:</strong> {details.bill.billNumber}</p>
                <p><strong>Tenant ID:</strong> {details.bill.tenantId}</p>
                <p><strong>Status:</strong> {details.bill.status}</p>
                <p>
                  <strong>Billing period:</strong>{" "}
                  {details.bill.periodStart} – {details.bill.periodEnd}
                </p>
                <p><strong>Issue date:</strong> {details.bill.issueDate}</p>
                <p><strong>Due date:</strong> {details.bill.dueDate}</p>

                <h3>Line items</h3>

                {details.items.length === 0 ? (
                  <p>No line items.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Quantity</th>
                        <th>Unit price</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.category}</td>
                          <td>{item.description}</td>
                          <td>{item.quantity}</td>
                          <td>{formatMoney(item.unitPrice)}</td>
                          <td>{formatMoney(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <p>
                  <strong>Total:</strong>{" "}
                  {formatMoney(details.bill.totalAmount)}
                </p>

                {details.bill.notes && (
                  <p><strong>Notes:</strong> {details.bill.notes}</p>
                )}

                <button type="button" onClick={printBill}>
                  Print bill
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
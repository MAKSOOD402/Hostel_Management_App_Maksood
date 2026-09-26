import { useState } from "react";
import type { FormEvent } from "react";

interface ManualPaymentButtonProps {
  hostelId: number;
  billId: number;
  accessToken: string;
  onRecorded?: () => void;
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5204";

const paymentMethods = [
  "Cash",
  "BankTransfer",
  "UPI",
  "Card",
  "NetBanking",
  "Other",
];

export default function ManualPaymentButton({
  hostelId,
  billId,
  accessToken,
  onRecorded,
}: ManualPaymentButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setReceipt("");
    setSaving(true);

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/bills/${billId}/manual-payments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            amount: Number(amount),
            paymentMethod,
            referenceNumber: referenceNumber.trim() || null,
          }),
        }
      );

      const text = await response.text();
      let data: { message?: string; receiptNumber?: string } = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        // Keep the server response as plain text if it isn't JSON.
      }

      if (!response.ok) {
        throw new Error(data.message || text || "Could not record payment.");
      }

      setReceipt(
        `Payment recorded. Receipt: ${data.receiptNumber ?? "created"}`
      );
      setAmount("");
      setReferenceNumber("");
      onRecorded?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not record payment."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Record manual payment
      </button>

      {isOpen && (
        <div
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15, 30, 55, 0.45)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`manual-payment-title-${billId}`}
            style={{
              width: "min(100%, 420px)",
              background: "#fff",
              borderRadius: 18,
              padding: 22,
              boxShadow: "0 18px 50px rgba(15, 30, 55, 0.2)",
            }}
          >
            <h2 id={`manual-payment-title-${billId}`}>Record payment</h2>
            <p>Enter the amount received for bill #{billId}.</p>

            {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
            {receipt && <p role="status">{receipt}</p>}

            <form onSubmit={submit}>
              <label>
                Amount received
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>

              <label>
                Payment method
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Reference number (optional)
                <input
                  maxLength={100}
                  value={referenceNumber}
                  onChange={(event) =>
                    setReferenceNumber(event.target.value)
                  }
                  placeholder="Bank reference or receipt number"
                />
              </label>

              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                <button type="submit" disabled={saving}>
                  {saving ? "Recording..." : "Record payment"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={saving}
                >
                  Close
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
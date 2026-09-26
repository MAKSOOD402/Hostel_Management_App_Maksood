import { useState } from "react";

interface RazorpayOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  billNumber: string;
}

interface RazorpayCheckoutResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayCheckoutResponse) => Promise<void>;
  modal?: {
    ondismiss?: () => void;
  };
  theme?: {
    color?: string;
  };
}

declare global {
  interface Window {
    Razorpay?: new (
      options: RazorpayCheckoutOptions
    ) => {
      open: () => void;
    };
  }
}

interface PayBillButtonProps {
  hostelId: number;
  billId: number;
  accessToken: string;
}

interface Receipt {
  billNumber: string;
  amount: number;
  currency: string;
  orderId: string;
  paymentId: string;
  paidAt: string;
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5204";

function loadRazorpayScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function formatMoney(amountInSmallestUnit: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(amountInSmallestUnit / 100);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function PayBillButton({
  hostelId,
  billId,
  accessToken,
}: PayBillButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  async function handlePay() {
    setLoading(true);
    setMessage("");

    try {
      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || !window.Razorpay) {
        throw new Error("Could not load Razorpay checkout.");
      }

      const orderResponse = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/bills/${billId}/razorpay-order`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const orderText = await orderResponse.text();

      if (!orderResponse.ok) {
        throw new Error(orderText || "Could not create payment order.");
      }

      const order: RazorpayOrderResponse = JSON.parse(orderText);

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Hostel Management",
        description: `Payment for bill ${order.billNumber}`,
        order_id: order.orderId,
        theme: { color: "#175cd3" },
        modal: {
          ondismiss: () => {
            setMessage("Payment window closed.");
            setLoading(false);
          },
        },
        handler: async (payment) => {
          try {
            const confirmationResponse = await fetch(
              `${apiBaseUrl}/api/payments/razorpay/confirm`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                  razorpayOrderId: payment.razorpay_order_id,
                  razorpayPaymentId: payment.razorpay_payment_id,
                  razorpaySignature: payment.razorpay_signature,
                }),
              }
            );

            const confirmationText = await confirmationResponse.text();

            if (!confirmationResponse.ok) {
              throw new Error(
                confirmationText || "The server could not verify the payment."
              );
            }

            setReceipt({
              billNumber: order.billNumber,
              amount: order.amount,
              currency: order.currency,
              orderId: payment.razorpay_order_id,
              paymentId: payment.razorpay_payment_id,
              paidAt: new Date().toLocaleString(),
            });
            setMessage("Payment verified successfully.");
          } catch (err) {
            setMessage(
              err instanceof Error
                ? err.message
                : "Payment verification failed."
            );
          } finally {
            setLoading(false);
          }
        },
      });

      checkout.open();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not start payment."
      );
      setLoading(false);
    }
  }

  function printReceipt() {
    if (!receipt) return;

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      setMessage("Allow pop-ups in your browser to print the receipt.");
      return;
    }

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Payment receipt - ${escapeHtml(receipt.billNumber)}</title>
          <style>
            body { font: 15px Arial, sans-serif; color: #222; margin: 40px; }
            main { max-width: 600px; margin: auto; }
            h1 { margin-bottom: 4px; }
            hr { margin: 24px 0; }
            .amount { font-size: 24px; font-weight: bold; }
            .label { color: #555; }
          </style>
        </head>
        <body>
          <main>
            <h1>Hostel Management</h1>
            <p>Payment receipt</p>
            <hr />
            <p><span class="label">Bill number:</span>
              ${escapeHtml(receipt.billNumber)}
            </p>
            <p class="amount">
              ${formatMoney(receipt.amount, receipt.currency)}
            </p>
            <p><span class="label">Payment ID:</span>
              ${escapeHtml(receipt.paymentId)}
            </p>
            <p><span class="label">Order ID:</span>
              ${escapeHtml(receipt.orderId)}
            </p>
            <p><span class="label">Verified at:</span>
              ${escapeHtml(receipt.paidAt)}
            </p>
            <p>Payment verified by Hostel Management.</p>
          </main>
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
    <div>
      <button type="button" onClick={() => void handlePay()} disabled={loading}>
        {loading ? "Opening payment..." : "Pay with Razorpay"}
      </button>

      {message && <p role="status">{message}</p>}

      {receipt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`receipt-title-${billId}`}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            display: "grid",
            placeItems: "center",
            padding: 16,
            background: "rgb(16 24 40 / 55%)",
          }}
        >
          <section
            style={{
              width: "min(480px, 100%)",
              padding: 24,
              background: "white",
              borderRadius: 12,
            }}
          >
            <h2 id={`receipt-title-${billId}`}>Payment successful</h2>
            <p><strong>Bill:</strong> {receipt.billNumber}</p>
            <p>
              <strong>Amount:</strong>{" "}
              {formatMoney(receipt.amount, receipt.currency)}
            </p>
            <p><strong>Payment ID:</strong> {receipt.paymentId}</p>
            <p><strong>Verified:</strong> {receipt.paidAt}</p>

            <button type="button" onClick={printReceipt}>
              Print receipt
            </button>{" "}
            <button type="button" onClick={() => setReceipt(null)}>
              Close
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
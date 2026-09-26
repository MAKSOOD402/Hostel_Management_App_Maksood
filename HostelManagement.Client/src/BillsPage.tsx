import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import PayBillButton from "./PayBillButton";
import BillDetailsButton from "./BillDetailsButton";

interface Bill {
  id: number;
  hostelId: number;
  tenantId: number;
  tenantName: string;
  billNumber: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  status: string;
  paidAt: string | null;
}

interface Tenant {
  id: number;
  fullName: string;
  isActive: boolean;
}

interface BillItemDraft {
  category: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

interface BillsPageProps {
  hostelId: number;
  accessToken: string;
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5204";

const categories = ["Rent", "Electricity", "Water", "Maintenance", "Other"];

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

async function readError(response: Response) {
  const text = await response.text();

  if (!text) return `Request failed (${response.status}).`;

  try {
    const data = JSON.parse(text);
    return data.message ?? text;
  } catch {
    return text;
  }
}

export default function BillsPage({
  hostelId,
  accessToken,
}: BillsPageProps) {
  const today = new Date();

  const [bills, setBills] = useState<Bill[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [periodStart, setPeriodStart] = useState(
    localDateValue(new Date(today.getFullYear(), today.getMonth(), 1))
  );
  const [periodEnd, setPeriodEnd] = useState(localDateValue(today));
  const [dueDate, setDueDate] = useState(localDateValue(today));
  const [items, setItems] = useState<BillItemDraft[]>([
    {
      category: "Rent",
      description: "Monthly rent",
      quantity: "1",
      unitPrice: "",
    },
  ]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadBills() {
    const response = await fetch(
      `${apiBaseUrl}/api/hostels/${hostelId}/bills`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    const data: Bill[] = await response.json();
    setBills(data);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setLoading(true);
      setError("");

      try {
        const headers = {
          Authorization: `Bearer ${accessToken}`,
        };

        const [billsResponse, tenantsResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/hostels/${hostelId}/bills`, { headers }),
          fetch(`${apiBaseUrl}/api/hostels/${hostelId}/tenants`, { headers }),
        ]);

        if (!billsResponse.ok) {
          throw new Error(await readError(billsResponse));
        }

        if (!tenantsResponse.ok) {
          throw new Error(await readError(tenantsResponse));
        }

        const billsData: Bill[] = await billsResponse.json();
        const tenantsData: Tenant[] = await tenantsResponse.json();

        if (!cancelled) {
          setBills(billsData);

          const activeTenants = tenantsData.filter(
            (tenant) => tenant.isActive
          );

          setTenants(activeTenants);
          setTenantId((current) => {
            if (activeTenants.some((tenant) => String(tenant.id) === current)) {
              return current;
            }

            return activeTenants.length > 0
              ? String(activeTenants[0].id)
              : "";
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load bills.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, [hostelId, accessToken]);

  function updateItem(index: number, changes: Partial<BillItemDraft>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item
      )
    );
  }

  function addItem() {
    setItems((current) => [
      ...current,
      {
        category: "Other",
        description: "",
        quantity: "1",
        unitPrice: "",
      },
    ]);
  }

  function removeItem(index: number) {
    setItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  async function createBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    if (!tenantId) {
      setError("Add an active tenant before creating a bill.");
      setSaving(false);
      return;
    }

    if (!billNumber.trim()) {
      setError("Enter a bill number.");
      setSaving(false);
      return;
    }

    if (periodEnd < periodStart) {
      setError("The bill period end must be on or after the period start.");
      setSaving(false);
      return;
    }

    const parsedItems = items.map((item) => ({
      category: item.category,
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    }));

    if (
      parsedItems.some(
        (item) =>
          !item.description ||
          !Number.isFinite(item.quantity) ||
          item.quantity <= 0 ||
          !Number.isFinite(item.unitPrice) ||
          item.unitPrice < 0
      )
    ) {
      setError(
        "Each item needs a description, positive quantity, and valid unit price."
      );
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/bills`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            tenantId: Number(tenantId),
            billNumber: billNumber.trim(),
            periodStart,
            periodEnd,
            dueDate,
            items: parsedItems,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setMessage("Bill created.");
      setBillNumber("");
      setItems([
        {
          category: "Rent",
          description: "Monthly rent",
          quantity: "1",
          unitPrice: "",
        },
      ]);

      await loadBills();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create bill.");
    } finally {
      setSaving(false);
    }
  }

  const estimatedTotal = items.reduce((total, item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);

    if (
      Number.isFinite(quantity) &&
      Number.isFinite(unitPrice) &&
      quantity > 0 &&
      unitPrice >= 0
    ) {
      return total + quantity * unitPrice;
    }

    return total;
  }, 0);

  return (
    <section>
      <h2>Bills</h2>

      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
      {message && <p role="status">{message}</p>}

      <form onSubmit={createBill}>
        <h3>Create bill</h3>

        <label>
          Tenant
          <select
            required
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
            disabled={tenants.length === 0}
          >
            {tenants.length === 0 ? (
              <option value="">No active tenants found</option>
            ) : (
              tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.fullName} (ID {tenant.id})
                </option>
              ))
            )}
          </select>
        </label>

        <label>
          Bill number
          <input
            required
            maxLength={50}
            value={billNumber}
            onChange={(event) => setBillNumber(event.target.value)}
            placeholder="Example: BILL-2026-0001"
          />
        </label>

        <label>
          Period start
          <input
            type="date"
            required
            value={periodStart}
            onChange={(event) => setPeriodStart(event.target.value)}
          />
        </label>

        <label>
          Period end
          <input
            type="date"
            required
            value={periodEnd}
            onChange={(event) => setPeriodEnd(event.target.value)}
          />
        </label>

        <label>
          Due date
          <input
            type="date"
            required
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </label>

        <div style={{ gridColumn: "1 / -1" }}>
          <h4>Bill items</h4>

          {items.map((item, index) => (
            <div
              key={index}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <label>
                Category
                <select
                  value={item.category}
                  onChange={(event) =>
                    updateItem(index, { category: event.target.value })
                  }
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Description
                <input
                  required
                  value={item.description}
                  onChange={(event) =>
                    updateItem(index, { description: event.target.value })
                  }
                />
              </label>

              <label>
                Quantity
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={item.quantity}
                  onChange={(event) =>
                    updateItem(index, { quantity: event.target.value })
                  }
                />
              </label>

              <label>
                Unit price
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={item.unitPrice}
                  onChange={(event) =>
                    updateItem(index, { unitPrice: event.target.value })
                  }
                />
              </label>

              {items.length > 1 && (
                <button type="button" onClick={() => removeItem(index)}>
                  Remove item
                </button>
              )}
            </div>
          ))}

          <button type="button" onClick={addItem}>
            Add another item
          </button>

          <p>
            Estimated total: <strong>{formatMoney(estimatedTotal)}</strong>
          </p>
        </div>

        <button type="submit" disabled={saving || tenants.length === 0}>
          {saving ? "Creating..." : "Create bill"}
        </button>
      </form>

      <h3>Existing bills</h3>

      {loading ? (
        <p>Loading bills...</p>
      ) : bills.length === 0 ? (
        <p>No bills found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Bill</th>
              <th>Tenant</th>
              <th>Period</th>
              <th>Due date</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id}>
                <td>{bill.billNumber}</td>
                <td>{bill.tenantName}</td>
                <td>
                  {bill.periodStart} – {bill.periodEnd}
                </td>
                <td>{bill.dueDate}</td>
                <td>{formatMoney(bill.totalAmount)}</td>
                <td>{bill.status}</td>
                <td>
                  <BillDetailsButton
                    hostelId={hostelId}
                    billId={bill.id}
                    accessToken={accessToken}
                  />

                  {!["paid", "cancelled", "draft"].includes(
                    bill.status.toLowerCase()
                  ) && (
                    <PayBillButton
                      hostelId={hostelId}
                      billId={bill.id}
                      accessToken={accessToken}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
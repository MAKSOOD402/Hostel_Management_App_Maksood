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
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [billFilter, setBillFilter] = useState<"All" | "Pending" | "Paid" | "Overdue">("All");
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

  function startCreating() {
    setError("");
    setMessage("");
    setIsFormOpen(true);
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
      setIsFormOpen(false);
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

  const todayValue = localDateValue(new Date());
  const isPaid = (bill: Bill) => bill.status.toLowerCase() === "paid";
  const isOverdue = (bill: Bill) => !isPaid(bill) && (bill.status.toLowerCase() === "overdue" || bill.dueDate < todayValue);
  const pendingBills = bills.filter((bill) => !isPaid(bill) && !["cancelled", "draft"].includes(bill.status.toLowerCase()));
  const paidBills = bills.filter(isPaid);
  const overdueBills = bills.filter(isOverdue);
  const visibleBills = bills.filter((bill) => {
    const term = searchText.trim().toLowerCase();
    const matchesSearch = !term || `${bill.billNumber} ${bill.tenantName} ${bill.status}`.toLowerCase().includes(term);
    const matchesFilter = billFilter === "All" || (billFilter === "Pending" && pendingBills.includes(bill)) || (billFilter === "Paid" && isPaid(bill)) || (billFilter === "Overdue" && isOverdue(bill));
    return matchesSearch && matchesFilter;
  });

  return (
    <section className="bills-page">
      <div className="bill-page-heading"><div><span className="eyebrow">BILLING</span><h2>Bills</h2><p>Rent and other monthly charges</p></div><span className="bill-total-count">{bills.length}<small> total</small></span></div>
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      <label className="bill-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Search bills" placeholder="Search by tenant or bill number…" value={searchText} onChange={(event) => setSearchText(event.target.value)} /></label>
      <div className="bill-filter-tabs" role="tablist" aria-label="Filter bills">
        {([
          { name: "All", count: bills.length },
          { name: "Pending", count: pendingBills.length },
          { name: "Paid", count: paidBills.length },
          { name: "Overdue", count: overdueBills.length },
        ] as const).map((filter) => <button key={filter.name} type="button" role="tab" aria-selected={billFilter === filter.name} className={billFilter === filter.name ? "selected" : ""} onClick={() => setBillFilter(filter.name)}>{filter.name}<span>{filter.count}</span></button>)}
      </div>
      {loading ? <div className="bill-empty-state">Loading bills…</div> : bills.length === 0 ? <div className="bill-empty-state"><strong>No bills yet</strong><span>Create a bill for an active tenant.</span></div> : visibleBills.length === 0 ? <div className="bill-empty-state">No bills match this search or filter.</div> : (
        <div className="bill-card-list">{visibleBills.map((bill) => {
          const overdue = isOverdue(bill);
          const statusClass = isPaid(bill) ? "paid" : overdue ? "overdue" : "pending";
          return <article className="bill-card" key={bill.id}>
            <div className="bill-card-top"><div className="bill-icon">₹</div><span className={`bill-status ${statusClass}`}>{overdue ? "Overdue" : bill.status}</span></div>
            <div className="bill-card-title"><div><h3>{bill.tenantName}</h3><p>{bill.billNumber}</p></div><strong>{formatMoney(bill.totalAmount)}</strong></div>
            <div className="bill-card-period"><span>{new Date(`${bill.periodStart}T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span><span>Due {new Date(`${bill.dueDate}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span></div>
            <div className="bill-card-actions"><BillDetailsButton hostelId={hostelId} billId={bill.id} accessToken={accessToken} />{!['paid','cancelled','draft'].includes(bill.status.toLowerCase()) && <PayBillButton hostelId={hostelId} billId={bill.id} accessToken={accessToken} />}</div>
          </article>;
        })}</div>
      )}
      <button className="tenant-add-fab" type="button" onClick={startCreating} aria-label="Create bill" title="Create bill">+</button>
      {isFormOpen && <div className="tenant-dialog-backdrop"><section className="tenant-dialog bill-dialog" role="dialog" aria-modal="true" aria-labelledby="create-bill-title"><div className="tenant-dialog-heading"><div><span className="eyebrow">MONTHLY CHARGES</span><h2 id="create-bill-title">Create bill</h2></div><button className="tenant-dialog-close" type="button" onClick={() => setIsFormOpen(false)} aria-label="Close">×</button></div>
        <form className="tenant-form" onSubmit={createBill}>
          <label>Tenant<select required value={tenantId} onChange={(event) => setTenantId(event.target.value)} disabled={tenants.length === 0}>{tenants.length === 0 ? <option value="">No active tenants found</option> : tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.fullName} (ID {tenant.id})</option>)}</select></label>
          <label>Bill number<input required maxLength={50} value={billNumber} onChange={(event) => setBillNumber(event.target.value)} placeholder="Example: BILL-2026-0001" /></label>
          <div className="bill-period-fields"><label>Period start<input type="date" required value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label><label>Period end<input type="date" required value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label><label>Due date<input type="date" required value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label></div>
          <div className="bill-items-editor"><div className="bill-items-heading"><h3>Bill items</h3><button type="button" onClick={addItem}>+ Add item</button></div>
            {items.map((item, index) => <div className="bill-item-row" key={index}>
              <label>Category<select value={item.category} onChange={(event) => updateItem(index, { category: event.target.value })}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
              <label>Description<input required value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} /></label>
              <div className="bill-item-numbers"><label>Qty<input type="number" min="0.01" step="0.01" required value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} /></label><label>Unit price<input type="number" min="0" step="0.01" required value={item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: event.target.value })} /></label></div>
              {items.length > 1 && <button className="bill-remove-item" type="button" onClick={() => removeItem(index)}>Remove item</button>}
            </div>)}
            <div className="bill-estimated-total"><span>Estimated total</span><strong>{formatMoney(estimatedTotal)}</strong></div>
          </div>
          <div className="tenant-form-actions"><button className="tenant-cancel-button" type="button" onClick={() => setIsFormOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={saving || tenants.length === 0}>{saving ? "Creating…" : "Generate bill"}</button></div>
        </form>
      </section></div>}
    </section>
  );
}

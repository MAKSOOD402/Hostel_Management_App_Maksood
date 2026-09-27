import { useState } from "react";
import BillDetailsButton from "./BillDetailsButton";

interface TenantProfile {
  id: number;
  hostelId: number;
  roomId: number | null;
  roomNumber: string | null;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  moveInDate: string;
  moveOutDate: string | null;
  isActive: boolean;
}

interface TenantBill {
  id: number;
  tenantId: number;
  billNumber: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  totalAmount: number;
  status: string;
}

interface TenantProfileButtonProps {
  hostelId: number;
  tenantId: number;
  accessToken: string;
  onEdit?: () => void;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "https://hostelmanagementapp-epa5awhmedaxh5au.southindia-01.azurewebsites.net";

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

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function TenantProfileButton({
  hostelId,
  tenantId,
  accessToken,
  onEdit,
}: TenantProfileButtonProps) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [dueBill, setDueBill] = useState<TenantBill | null>(null);
  const [loading, setLoading] = useState(false);
  const [billsLoading, setBillsLoading] = useState(false);
  const [error, setError] = useState("");
  const [billError, setBillError] = useState("");

  async function showProfile() {
    setOpen(true);
    setLoading(true);
    setBillsLoading(true);
    setError("");
    setBillError("");
    setProfile(null);
    setDueBill(null);

    const headers = { Authorization: `Bearer ${accessToken}` };
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/tenants/${tenantId}`,
        { headers }
      );
      if (!response.ok) throw new Error(await readError(response));
      setProfile(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tenant profile.");
    } finally {
      setLoading(false);
    }

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/bills`,
        { headers }
      );
      if (!response.ok) throw new Error(await readError(response));
      const bills: TenantBill[] = await response.json();
      const latestOpenBill = bills
        .filter((bill) => bill.tenantId === tenantId && bill.status.toLowerCase() !== "paid")
        .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0] ?? null;
      setDueBill(latestOpenBill);
    } catch (err) {
      setBillError(err instanceof Error ? err.message : "Could not load current dues.");
    } finally {
      setBillsLoading(false);
    }
  }

  function editTenant() {
    setOpen(false);
    onEdit?.();
  }

  const initials = profile?.fullName.trim().split(/\s+/).slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "").join("") ?? "";

  return (
    <>
      <button type="button" onClick={() => void showProfile()}>Profile</button>

      {open && (
        <div className="tenant-profile-overlay" role="dialog" aria-modal="true" aria-labelledby={`tenant-profile-title-${tenantId}`}>
          <section className="tenant-profile-screen">
            <header className="tenant-profile-topbar">
              <button type="button" onClick={() => setOpen(false)} aria-label="Back to tenants">‹</button>
              <h2 id={`tenant-profile-title-${tenantId}`}>Tenant Profile</h2>
              <span aria-hidden="true">⋮</span>
            </header>

            {loading && <div className="profile-loading">Loading tenant profile…</div>}
            {error && <p className="profile-error" role="alert">{error}</p>}

            {profile && (
              <div className="tenant-profile-content">
                <section className="tenant-profile-hero">
                  <div className="tenant-profile-avatar">{initials}</div>
                  <h1>{profile.fullName}</h1>
                  <p>{profile.roomNumber ? `Room ${profile.roomNumber}` : "No room assigned"}</p>
                  <span className={`tenant-status ${profile.isActive ? "active" : "inactive"}`}>
                    {profile.isActive ? "Active" : "Inactive"}
                  </span>
                </section>

                <div className="tenant-profile-actions">
                  <a href={`tel:${profile.phoneNumber}`}><span>☎</span><small>Call</small></a>
                  <a href={profile.email ? `mailto:${profile.email}` : `sms:${profile.phoneNumber}`}><span>✉</span><small>Message</small></a>
                  <button type="button" onClick={editTenant}><span>✎</span><small>Edit</small></button>
                </div>

                <section className="profile-info-card">
                  <h3>Contact details</h3>
                  <div className="profile-info-row"><span>Mobile</span><a href={`tel:${profile.phoneNumber}`}>{profile.phoneNumber}</a></div>
                  <div className="profile-info-row"><span>Email</span>{profile.email ? <a href={`mailto:${profile.email}`}>{profile.email}</a> : <b>Not provided</b>}</div>
                  <div className="profile-info-row"><span>Move-in date</span><b>{formatDate(profile.moveInDate)}</b></div>
                  <div className="profile-info-row"><span>Move-out date</span><b>{formatDate(profile.moveOutDate)}</b></div>
                </section>

                <section className="profile-info-card emergency-card">
                  <h3>Emergency contact</h3>
                  <div className="profile-info-row"><span>Name</span><b>{profile.emergencyName || "Not provided"}</b></div>
                  <div className="profile-info-row"><span>Phone</span>{profile.emergencyPhone ? <a href={`tel:${profile.emergencyPhone}`}>{profile.emergencyPhone}</a> : <b>Not provided</b>}</div>
                </section>

                <section className="profile-dues-card">
                  <div className="profile-dues-heading"><div><span className="eyebrow">CURRENT DUES</span><h3>{dueBill ? new Date(`${dueBill.periodEnd}T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "No pending bill"}</h3></div>
                    {dueBill && <span className="bill-status-chip">{dueBill.status}</span>}
                  </div>
                  {billsLoading ? <p>Loading dues…</p> : billError ? <p className="profile-small-error">{billError}</p> : dueBill ? <div className="profile-dues-amount">{formatMoney(dueBill.totalAmount)}</div> : <p className="no-dues-copy">This tenant has no unpaid bills.</p>}
                  {dueBill && <div className="profile-bill-actions"><span>Bill {dueBill.billNumber} · Due {formatDate(dueBill.dueDate)}</span><BillDetailsButton hostelId={hostelId} billId={dueBill.id} accessToken={accessToken} /></div>}
                </section>

                <button className="profile-close-button" type="button" onClick={() => setOpen(false)}>Back to tenants</button>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

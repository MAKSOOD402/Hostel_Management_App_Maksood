import { useEffect, useState } from "react";
import type { FormEvent } from "react";

interface Complaint {
  id: number;
  hostelId: number;
  tenantId: number;
  tenantName: string;
  roomId: number | null;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string | null;
  resolvedAt: string | null;
}

interface TenantOption {
  id: number;
  fullName: string;
  isActive: boolean;
}

interface ComplaintsPageProps {
  hostelId: number;
  accessToken: string;
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5204";

const statuses = ["Open", "InProgress", "Resolved", "Rejected"];
const priorities = ["Low", "Normal", "High", "Urgent"];

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

export default function ComplaintsPage({
  hostelId,
  accessToken,
}: ComplaintsPageProps) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [priority, setPriority] = useState("Normal");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const query = filterStatus
        ? `?status=${encodeURIComponent(filterStatus)}`
        : "";

      const headers = {
        Authorization: `Bearer ${accessToken}`,
      };

      const [complaintsResponse, tenantsResponse] = await Promise.all([
        fetch(
          `${apiBaseUrl}/api/hostels/${hostelId}/complaints${query}`,
          { headers }
        ),
        fetch(`${apiBaseUrl}/api/hostels/${hostelId}/tenants`, { headers }),
      ]);

      if (!complaintsResponse.ok) {
        throw new Error(await readError(complaintsResponse));
      }

      if (!tenantsResponse.ok) {
        throw new Error(await readError(tenantsResponse));
      }

      const complaintData: Complaint[] = await complaintsResponse.json();
      const tenantData: TenantOption[] = await tenantsResponse.json();

      setComplaints(complaintData);
      setTenants(tenantData);

      if (!tenantId && tenantData.length > 0) {
        setTenantId(String(tenantData[0].id));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load complaints."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [hostelId, accessToken, filterStatus]);

  async function createComplaint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/complaints`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            tenantId: Number(tenantId),
            title,
            description,
            category: category || null,
            priority,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setTitle("");
      setDescription("");
      setCategory("General");
      setPriority("Normal");
      setMessage("Complaint created.");
      setCreateOpen(false);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create complaint."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(complaintId: number, status: string) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/complaints/${complaintId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ status }),
        }
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setMessage("Complaint status updated.");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update complaint."
      );
    }
  }

  const activeTenants = tenants.filter((tenant) => tenant.isActive);

  const openCount = complaints.filter((complaint) => complaint.status.toLowerCase() === "open").length;
  const resolvedCount = complaints.filter((complaint) => complaint.status.toLowerCase() === "resolved").length;

  return (
    <section className="complaints-page">
      <div className="complaints-heading"><div><span className="eyebrow">SUPPORT</span><h2>Complaints</h2><p>Track and resolve tenant requests</p></div><span className="complaint-count-badge">{openCount}<small> open</small></span></div>
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      <div className="complaint-summary"><span><b>{complaints.length}</b> total</span><span><b>{openCount}</b> open</span><span><b>{resolvedCount}</b> resolved</span></div>
      <div className="complaint-filter-tabs" role="tablist" aria-label="Filter complaints">
        {[{label:"All",value:""},...statuses.map((item)=>({label:item.replace(/([A-Z])/g," $1").trim(),value:item}))].map((filter)=><button key={filter.value||"all"} type="button" role="tab" aria-selected={filterStatus===filter.value} className={filterStatus===filter.value?"selected":""} onClick={()=>setFilterStatus(filter.value)}>{filter.label}</button>)}
      </div>
      {loading ? <div className="complaint-empty-state">Loading complaints…</div> : complaints.length===0 ? <div className="complaint-empty-state"><strong>No complaints found</strong><span>New tenant complaints will appear here.</span></div> : <div className="complaint-list">{complaints.map((complaint)=><article className="complaint-card" key={complaint.id}>
        <div className="complaint-card-top"><span className="complaint-category-icon">☷</span><span className={`complaint-priority ${complaint.priority.toLowerCase()}`}>{complaint.priority}</span></div>
        <div className="complaint-card-title"><h3>{complaint.title}</h3><span className={`complaint-status ${complaint.status.toLowerCase()}`}>{complaint.status.replace(/([A-Z])/g," $1").trim()}</span></div>
        <p className="complaint-description">{complaint.description}</p>
        <div className="complaint-meta"><span>{complaint.tenantName} · {complaint.category}</span><time>{new Date(complaint.createdAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}</time></div>
        <label className="complaint-status-control">Update status<select aria-label={`Status for complaint ${complaint.id}`} value={complaint.status} onChange={(event)=>void updateStatus(complaint.id,event.target.value)}>{statuses.map((item)=><option key={item} value={item}>{item.replace(/([A-Z])/g," $1").trim()}</option>)}</select></label>
      </article>)}</div>}
      <button className="tenant-add-fab" type="button" onClick={()=>setCreateOpen(true)} aria-label="Create complaint" title="Create complaint">+</button>
      {createOpen && <div className="tenant-dialog-backdrop"><section className="tenant-dialog" role="dialog" aria-modal="true" aria-labelledby="new-complaint-title"><div className="tenant-dialog-heading"><div><span className="eyebrow">TENANT SUPPORT</span><h2 id="new-complaint-title">New complaint</h2></div><button className="tenant-dialog-close" type="button" onClick={()=>setCreateOpen(false)} aria-label="Close">×</button></div>
        <form className="tenant-form" onSubmit={createComplaint}>
          <label>Tenant<select required value={tenantId} onChange={(event)=>setTenantId(event.target.value)} disabled={activeTenants.length===0}>{activeTenants.length===0?<option value="">No active tenants available</option>:activeTenants.map((tenant)=><option key={tenant.id} value={tenant.id}>{tenant.fullName} (ID {tenant.id})</option>)}</select></label>
          <label>Title<input required minLength={3} maxLength={180} value={title} onChange={(event)=>setTitle(event.target.value)} /></label>
          <label>Description<textarea required minLength={5} maxLength={5000} rows={4} value={description} onChange={(event)=>setDescription(event.target.value)} /></label>
          <label>Category<input maxLength={50} value={category} onChange={(event)=>setCategory(event.target.value)} /></label>
          <label>Priority<select value={priority} onChange={(event)=>setPriority(event.target.value)}>{priorities.map((item)=><option key={item} value={item}>{item}</option>)}</select></label>
          <div className="tenant-form-actions"><button className="tenant-cancel-button" type="button" onClick={()=>setCreateOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={saving||activeTenants.length===0}>{saving?"Saving…":"Create complaint"}</button></div>
        </form>
      </section></div>}
    </section>
  );
}

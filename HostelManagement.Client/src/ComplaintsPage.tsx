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

  return (
    <section style={{ marginTop: 32 }}>
      <h2>Complaints</h2>

      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
      {message && <p role="status">{message}</p>}

      <form onSubmit={createComplaint}>
        <h3>Create complaint</h3>

        <label>
          Tenant
          <select
            required
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
            disabled={activeTenants.length === 0}
          >
            {activeTenants.length === 0 ? (
              <option value="">No active tenants available</option>
            ) : (
              activeTenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.fullName} (ID {tenant.id})
                </option>
              ))
            )}
          </select>
        </label>

        <label>
          Title
          <input
            required
            minLength={3}
            maxLength={180}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label>
          Description
          <textarea
            required
            minLength={5}
            maxLength={5000}
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <label>
          Category
          <input
            maxLength={50}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          />
        </label>

        <label>
          Priority
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            {priorities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={saving || activeTenants.length === 0}
        >
          {saving ? "Saving..." : "Create complaint"}
        </button>
      </form>

      <div style={{ marginTop: 24 }}>
        <label>
          Filter by status
          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p>Loading complaints...</p>
      ) : complaints.length === 0 ? (
        <p>No complaints found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Title</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Created</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {complaints.map((complaint) => (
              <tr key={complaint.id}>
                <td>{complaint.tenantName}</td>
                <td>
                  <strong>{complaint.title}</strong>
                  <br />
                  {complaint.description}
                </td>
                <td>{complaint.category}</td>
                <td>{complaint.priority}</td>
                <td>{new Date(complaint.createdAt).toLocaleString()}</td>
                <td>
                  <select
                    aria-label={`Status for complaint ${complaint.id}`}
                    value={complaint.status}
                    onChange={(event) =>
                      void updateStatus(complaint.id, event.target.value)
                    }
                  >
                    {statuses.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
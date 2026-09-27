import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import CreateTenantAccountButton from "./CreateTenantAccountButton";
import TenantProfileButton from "./TenantProfileButton";

interface Tenant {
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

interface RoomOption {
  id: number;
  roomNumber: string;
  isActive: boolean;
}

interface TenantsPageProps {
  hostelId: number;
  accessToken: string;
  isAdmin: boolean;
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "https://hostelmanagementapp-epa5awhmedaxh5au.southindia-01.azurewebsites.net";

function todayAsDateInputValue() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
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

export default function TenantsPage({
  hostelId,
  accessToken,
  isAdmin,
}: TenantsPageProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingTenantId, setEditingTenantId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");

  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [moveInDate, setMoveInDate] = useState(todayAsDateInputValue());
  const [moveOutDate, setMoveOutDate] = useState("");
  const [roomId, setRoomId] = useState("");
  const [roomIds, setRoomIds] = useState<Record<number, string>>({});

  async function loadTenants() {
    setLoading(true);
    setError("");

    try {
      const query = includeInactive ? "?includeInactive=true" : "";
      const headers = {
        Authorization: `Bearer ${accessToken}`,
      };

      const [tenantsResponse, roomsResponse] = await Promise.all([
        fetch(
          `${apiBaseUrl}/api/hostels/${hostelId}/tenants${query}`,
          { headers }
        ),
        fetch(`${apiBaseUrl}/api/hostels/${hostelId}/rooms`, { headers }),
      ]);

      if (!tenantsResponse.ok) {
        throw new Error(await readError(tenantsResponse));
      }

      if (!roomsResponse.ok) {
        throw new Error(await readError(roomsResponse));
      }

      const tenantData: Tenant[] = await tenantsResponse.json();
      const roomData: RoomOption[] = await roomsResponse.json();

      setTenants(tenantData);
      setRooms(roomData.filter((room) => room.isActive));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tenants.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTenants();
  }, [hostelId, accessToken, includeInactive]);

  function startCreating() {
    clearForm();
    setIsFormOpen(true);
    setError("");
    setMessage("");
  }

  function clearForm() {
    setIsFormOpen(false);
    setEditingTenantId(null);
    setFullName("");
    setPhoneNumber("");
    setEmail("");
    setEmergencyName("");
    setEmergencyPhone("");
    setMoveInDate(todayAsDateInputValue());
    setMoveOutDate("");
    setRoomId("");
  }

  function startEditing(tenant: Tenant) {
    setEditingTenantId(tenant.id);
    setIsFormOpen(true);
    setFullName(tenant.fullName);
    setPhoneNumber(tenant.phoneNumber);
    setEmail(tenant.email ?? "");
    setEmergencyName(tenant.emergencyName ?? "");
    setEmergencyPhone(tenant.emergencyPhone ?? "");
    setMoveInDate(tenant.moveInDate);
    setMoveOutDate(tenant.moveOutDate ?? "");
    setRoomId("");
    setError("");
    setMessage("");
  }

  async function saveTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const parsedRoomId = roomId ? Number(roomId) : null;

    if (
      editingTenantId === null &&
      parsedRoomId !== null &&
      (!Number.isInteger(parsedRoomId) || parsedRoomId <= 0)
    ) {
      setError("Choose a valid room.");
      setSaving(false);
      return;
    }

    const isEditing = editingTenantId !== null;
    const url = isEditing
      ? `${apiBaseUrl}/api/hostels/${hostelId}/tenants/${editingTenantId}`
      : `${apiBaseUrl}/api/hostels/${hostelId}/tenants`;

    const body = isEditing
      ? {
          fullName,
          phoneNumber,
          email: email || null,
          emergencyName: emergencyName || null,
          emergencyPhone: emergencyPhone || null,
          moveInDate,
          moveOutDate: moveOutDate || null,
        }
      : {
          fullName,
          phoneNumber,
          email: email || null,
          emergencyName: emergencyName || null,
          emergencyPhone: emergencyPhone || null,
          moveInDate,
          roomId: parsedRoomId,
        };

    try {
      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(await readError(response));

      setMessage(isEditing ? "Tenant updated." : "Tenant added.");
      clearForm();
      await loadTenants();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save tenant.");
    } finally {
      setSaving(false);
    }
  }

  async function assignRoom(tenant: Tenant) {
    const newRoomId = Number(roomIds[tenant.id]);

    if (!Number.isInteger(newRoomId) || newRoomId <= 0) {
      setError("Choose a room before assigning it.");
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/tenants/${tenant.id}/room`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ roomId: newRoomId }),
        }
      );

      if (!response.ok) throw new Error(await readError(response));

      setMessage(`Room assigned to ${tenant.fullName}.`);
      setRoomIds((current) => ({ ...current, [tenant.id]: "" }));
      await loadTenants();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign room.");
    }
  }

  async function deactivateTenant(tenant: Tenant) {
    if (!window.confirm(`Deactivate ${tenant.fullName}?`)) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/tenants/${tenant.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) throw new Error(await readError(response));

      setMessage(`${tenant.fullName} was deactivated.`);
      await loadTenants();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not deactivate tenant."
      );
    }
  }

  const activeCount = tenants.filter((tenant) => tenant.isActive).length;
  const inactiveCount = tenants.length - activeCount;
  const visibleTenants = tenants.filter((tenant) => {
    const term = searchText.trim().toLowerCase();
    const matchesSearch = !term || [
      tenant.fullName,
      tenant.phoneNumber,
      tenant.email ?? "",
      tenant.roomNumber ?? "",
    ].some((value) => value.toLowerCase().includes(term));
    const matchesStatus = statusFilter === "All"
      || (statusFilter === "Active" && tenant.isActive)
      || (statusFilter === "Inactive" && !tenant.isActive);
    return matchesSearch && matchesStatus;
  });

  return (
    <section className="tenants-page">
      <div className="tenant-page-heading">
        <div>
          <span className="eyebrow">PEOPLE</span>
          <h2>Tenants</h2>
          <p>Manage residents and their room assignments.</p>
        </div>
        <span className="tenant-total-count">{activeCount}<small> active</small></span>
      </div>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      <label className="tenant-search">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          placeholder="Search tenants..."
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          aria-label="Search tenants"
        />
        <span className="search-filter-icon" aria-hidden="true">☷</span>
      </label>

      <div className="tenant-filter-tabs" role="tablist" aria-label="Filter tenants">
        {([
          { name: "All", count: tenants.length },
          { name: "Active", count: activeCount },
          { name: "Inactive", count: inactiveCount },
        ] as const).map((filter) => (
          <button
            key={filter.name}
            type="button"
            role="tab"
            aria-selected={statusFilter === filter.name}
            className={statusFilter === filter.name ? "selected" : ""}
            onClick={() => setStatusFilter(filter.name)}
          >
            {filter.name} <span>{filter.count}</span>
          </button>
        ))}
      </div>

      <label className="inactive-toggle">
        <input
          type="checkbox"
          checked={includeInactive}
          onChange={(event) => setIncludeInactive(event.target.checked)}
        />
        Show inactive tenants
      </label>

      {loading ? (
        <div className="tenant-list-state">Loading tenants…</div>
      ) : tenants.length === 0 ? (
        <div className="tenant-list-state"><strong>No tenants yet</strong><span>Add a tenant to see them in this list.</span></div>
      ) : visibleTenants.length === 0 ? (
        <div className="tenant-list-state"><strong>No matching tenants</strong><span>Try another name, phone number, or status filter.</span></div>
      ) : (
        <div className="tenant-card-list">
          {visibleTenants.map((tenant) => {
            const initials = tenant.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
            return (
              <article className="tenant-list-card" key={tenant.id}>
                <div className="tenant-card-main">
                  <span className={`tenant-avatar avatar-${tenant.id % 6}`} aria-hidden="true">{initials}</span>
                  <div className="tenant-card-identity">
                    <strong>{tenant.fullName}</strong>
                    <span>{tenant.roomNumber ? `Room ${tenant.roomNumber}` : "No room assigned"}</span>
                  </div>
                  <span className={`tenant-status ${tenant.isActive ? "active" : "inactive"}`}>
                    {tenant.isActive ? "Active" : "Inactive"}
                  </span>
                  <details className="tenant-card-menu">
                    <summary aria-label={`Manage ${tenant.fullName}`} title="Tenant actions">⋮</summary>
                    <div className="tenant-menu-panel">
                      <TenantProfileButton hostelId={hostelId} tenantId={tenant.id} accessToken={accessToken} onEdit={() => startEditing(tenant)} />
                      <button type="button" onClick={() => startEditing(tenant)}>Edit details</button>
                      {tenant.isActive && <button type="button" onClick={() => void deactivateTenant(tenant)}>Deactivate</button>}
                      {isAdmin && <CreateTenantAccountButton hostelId={hostelId} tenantId={tenant.id} tenantName={tenant.fullName} tenantEmail={tenant.email} accessToken={accessToken} />}
                    
                      <details className="tenant-room-assignment">
                  <summary>{tenant.roomNumber ? "Change room" : "Assign a room"}</summary>
                  <div>
                    <select
                      aria-label={`Room for ${tenant.fullName}`}
                      value={roomIds[tenant.id] ?? ""}
                      onChange={(event) => setRoomIds((current) => ({ ...current, [tenant.id]: event.target.value }))}
                    >
                      <option value="">Choose room</option>
                      {rooms.map((room) => <option key={room.id} value={room.id}>{room.roomNumber}</option>)}
                    </select>
                    <button type="button" onClick={() => void assignRoom(tenant)}>Assign</button>
                  </div>
                </details>
                    </div>
                  </details>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <button className="tenant-add-fab" type="button" onClick={startCreating} aria-label="Add tenant" title="Add tenant">+</button>

      {isFormOpen && (
        <div className="tenant-dialog-backdrop">
          <section className="tenant-dialog" role="dialog" aria-modal="true" aria-labelledby="tenant-form-title">
            <div className="tenant-dialog-heading">
              <div><span className="eyebrow">TENANT DETAILS</span><h2 id="tenant-form-title">{editingTenantId !== null ? "Edit tenant" : "Add tenant"}</h2></div>
              <button className="tenant-dialog-close" type="button" onClick={clearForm} aria-label="Close">×</button>
            </div>
            <form className="tenant-form" onSubmit={saveTenant}>
              <label>Full name<input required minLength={2} maxLength={150} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
              <label>Phone number<input required maxLength={30} value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} /></label>
              <label>Email<input type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <label>Emergency contact name<input maxLength={150} value={emergencyName} onChange={(event) => setEmergencyName(event.target.value)} /></label>
              <label>Emergency contact phone<input maxLength={30} value={emergencyPhone} onChange={(event) => setEmergencyPhone(event.target.value)} /></label>
              <label>Move-in date<input type="date" required value={moveInDate} onChange={(event) => setMoveInDate(event.target.value)} /></label>
              {editingTenantId !== null && <label>Move-out date<input type="date" value={moveOutDate} onChange={(event) => setMoveOutDate(event.target.value)} /></label>}
              {editingTenantId === null && <label>Room (optional)<select value={roomId} onChange={(event) => setRoomId(event.target.value)}><option value="">No room assigned</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.roomNumber}</option>)}</select></label>}
              <div className="tenant-form-actions">
                <button className="tenant-cancel-button" type="button" onClick={clearForm}>Cancel</button>
                <button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : editingTenantId !== null ? "Save changes" : "Add tenant"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}




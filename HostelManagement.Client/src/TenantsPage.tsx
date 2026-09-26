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
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5204";

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

  function clearForm() {
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

  return (
    <section style={{ marginTop: 32 }}>
      <h2>Tenants</h2>

      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
      {message && <p role="status">{message}</p>}

      <form onSubmit={saveTenant}>
        <h3>{editingTenantId !== null ? "Edit tenant" : "Add tenant"}</h3>

        <label>
          Full name
          <input
            required
            minLength={2}
            maxLength={150}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </label>

        <label>
          Phone number
          <input
            required
            maxLength={30}
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
          />
        </label>

        <label>
          Email
          <input
            type="email"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label>
          Emergency contact name
          <input
            maxLength={150}
            value={emergencyName}
            onChange={(event) => setEmergencyName(event.target.value)}
          />
        </label>

        <label>
          Emergency contact phone
          <input
            maxLength={30}
            value={emergencyPhone}
            onChange={(event) => setEmergencyPhone(event.target.value)}
          />
        </label>

        <label>
          Move-in date
          <input
            type="date"
            required
            value={moveInDate}
            onChange={(event) => setMoveInDate(event.target.value)}
          />
        </label>

        {editingTenantId !== null && (
          <label>
            Move-out date
            <input
              type="date"
              value={moveOutDate}
              onChange={(event) => setMoveOutDate(event.target.value)}
            />
          </label>
        )}

        {editingTenantId === null && (
          <label>
            Room (optional)
            <select
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
            >
              <option value="">No room assigned</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.roomNumber}
                </option>
              ))}
            </select>
          </label>
        )}

        <button type="submit" disabled={saving}>
          {saving
            ? "Saving..."
            : editingTenantId !== null
              ? "Save changes"
              : "Add tenant"}
        </button>

        {editingTenantId !== null && (
          <button type="button" onClick={clearForm}>
            Cancel edit
          </button>
        )}
      </form>

      <label style={{ display: "block", margin: "24px 0" }}>
        <input
          type="checkbox"
          checked={includeInactive}
          onChange={(event) => setIncludeInactive(event.target.checked)}
        />
        {" "}Include inactive tenants
      </label>

      {loading ? (
        <p>Loading tenants...</p>
      ) : tenants.length === 0 ? (
        <p>No tenants found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Room</th>
              <th>Move-in</th>
              <th>Status</th>
              <th>Assign room</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td>{tenant.id}</td>
                <td>{tenant.fullName}</td>
                <td>{tenant.phoneNumber}</td>
                <td>{tenant.email || "—"}</td>
                <td>{tenant.roomNumber || "Unassigned"}</td>
                <td>{tenant.moveInDate}</td>
                <td>{tenant.isActive ? "Active" : "Inactive"}</td>
                <td>
                  {tenant.isActive && (
                    <>
                      <select
                        aria-label={`Room for ${tenant.fullName}`}
                        value={roomIds[tenant.id] ?? ""}
                        onChange={(event) =>
                          setRoomIds((current) => ({
                            ...current,
                            [tenant.id]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Choose room</option>
                        {rooms.map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.roomNumber}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void assignRoom(tenant)}
                      >
                        Assign
                      </button>
                    </>
                  )}
                </td>
               <td>
  <button type="button" onClick={() => startEditing(tenant)}>
    Edit
  </button>{" "}

  {tenant.isActive && (
    <button
      type="button"
      onClick={() => void deactivateTenant(tenant)}
    >
      Deactivate
    </button>
  )}{" "}

  {isAdmin && (
    <CreateTenantAccountButton
      hostelId={hostelId}
      tenantId={tenant.id}
      tenantName={tenant.fullName}
      tenantEmail={tenant.email}
      accessToken={accessToken}
    />
  )}
  <TenantProfileButton
  hostelId={hostelId}
  tenantId={tenant.id}
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
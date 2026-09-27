import { useEffect, useState } from "react";
import type { FormEvent } from "react";

interface Room {
  id: number;
  hostelId: number;
  roomNumber: string;
  capacity: number;
  floorNumber: number | null;
  notes: string | null;
  isActive: boolean;
}

interface RoomOccupant {
  roomId: number | null;
  fullName: string;
  isActive: boolean;
}

interface RoomsPageProps {
  hostelId: number;
  accessToken: string;
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "https://hostelmanagementapp-epa5awhmedaxh5au.southindia-01.azurewebsites.net";

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

export default function RoomsPage({
  hostelId,
  accessToken,
}: RoomsPageProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [occupants, setOccupants] = useState<RoomOccupant[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [roomFilter, setRoomFilter] = useState<"All" | "Occupied" | "Vacant" | "Inactive">("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const [roomNumber, setRoomNumber] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [floorNumber, setFloorNumber] = useState("");
  const [notes, setNotes] = useState("");

  async function loadRooms() {
    setLoading(true);
    setError("");

    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [roomsResponse, tenantsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/hostels/${hostelId}/rooms`, { headers }),
        fetch(`${apiBaseUrl}/api/hostels/${hostelId}/tenants`, { headers }),
      ]);
      if (!roomsResponse.ok) throw new Error(await readError(roomsResponse));
      if (!tenantsResponse.ok) throw new Error(await readError(tenantsResponse));
      const roomData: Room[] = await roomsResponse.json();
      const tenantData: RoomOccupant[] = await tenantsResponse.json();
      setRooms(roomData);
      setOccupants(tenantData.filter((tenant) => tenant.isActive && tenant.roomId !== null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load rooms.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRooms();
  }, [hostelId, accessToken]);

  function startCreating() {
    clearForm();
    setIsFormOpen(true);
    setError("");
    setMessage("");
  }

  function clearForm() {
    setIsFormOpen(false);
    setEditingRoom(null);
    setRoomNumber("");
    setCapacity("1");
    setFloorNumber("");
    setNotes("");
  }

  function startEditing(room: Room) {
    setIsFormOpen(true);
    setEditingRoom(room);
    setRoomNumber(room.roomNumber);
    setCapacity(String(room.capacity));
    setFloorNumber(room.floorNumber === null ? "" : String(room.floorNumber));
    setNotes(room.notes ?? "");
    setError("");
    setMessage("");
  }

  async function saveRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const parsedCapacity = Number(capacity);
    const parsedFloor = floorNumber.trim() ? Number(floorNumber) : null;

    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
      setError("Capacity must be a whole number of at least 1.");
      setSaving(false);
      return;
    }

    if (
      parsedFloor !== null &&
      !Number.isInteger(parsedFloor)
    ) {
      setError("Floor number must be a whole number.");
      setSaving(false);
      return;
    }

    const body = {
      roomNumber: roomNumber.trim(),
      capacity: parsedCapacity,
      floorNumber: parsedFloor,
      notes: notes.trim() || null,
      ...(editingRoom ? { isActive: editingRoom.isActive } : {}),
    };

    try {
      const url = editingRoom
        ? `${apiBaseUrl}/api/hostels/${hostelId}/rooms/${editingRoom.id}`
        : `${apiBaseUrl}/api/hostels/${hostelId}/rooms`;

      const response = await fetch(url, {
        method: editingRoom ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setMessage(editingRoom ? "Room updated." : "Room created.");
      clearForm();
      await loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save room.");
    } finally {
      setSaving(false);
    }
  }

  async function setRoomActive(room: Room, isActive: boolean) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/rooms/${room.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            roomNumber: room.roomNumber,
            capacity: room.capacity,
            floorNumber: room.floorNumber,
            notes: room.notes,
            isActive,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setMessage(isActive ? "Room reactivated." : "Room deactivated.");
      await loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update room.");
    }
  }

  async function deactivateRoom(room: Room) {
    if (!window.confirm(`Deactivate room ${room.roomNumber}?`)) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/rooms/${room.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setMessage(`Room ${room.roomNumber} deactivated.`);
      await loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not deactivate room.");
    }
  }

  const occupiedCount = (roomId: number) => occupants.filter((tenant) => tenant.roomId === roomId).length;
  const activeRooms = rooms.filter((room) => room.isActive);
  const occupiedRooms = activeRooms.filter((room) => occupiedCount(room.id) > 0).length;
  const vacantRooms = activeRooms.filter((room) => occupiedCount(room.id) < room.capacity).length;
  const visibleRooms = rooms.filter((room) => {
    if (roomFilter === "Inactive") return !room.isActive;
    if (!room.isActive) return false;
    if (roomFilter === "Occupied") return occupiedCount(room.id) > 0;
    if (roomFilter === "Vacant") return occupiedCount(room.id) < room.capacity;
    return true;
  });

  return (
    <section className="rooms-page">
      <div className="room-page-heading"><div><span className="eyebrow">HOSTEL SPACE</span><h2>Rooms</h2><p>Room availability and occupancy</p></div><span className="room-count-badge">{activeRooms.length}<small> rooms</small></span></div>
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      <div className="room-summary-strip"><span><b>{occupiedRooms}</b> occupied</span><i/><span><b>{vacantRooms}</b> with vacancies</span><i/><span><b>{activeRooms.reduce((sum, room) => sum + room.capacity, 0)}</b> beds</span></div>
      <div className="room-filter-tabs" role="tablist" aria-label="Filter rooms">
        {([
          { name: "All", count: activeRooms.length },
          { name: "Occupied", count: occupiedRooms },
          { name: "Vacant", count: vacantRooms },
          { name: "Inactive", count: rooms.length - activeRooms.length },
        ] as const).map((filter) => <button key={filter.name} type="button" role="tab" aria-selected={roomFilter === filter.name} className={roomFilter === filter.name ? "selected" : ""} onClick={() => setRoomFilter(filter.name)}>{filter.name}<span>{filter.count}</span></button>)}
      </div>
      {loading ? <div className="room-empty-state">Loading rooms…</div> : visibleRooms.length === 0 ? <div className="room-empty-state"><strong>No rooms in this filter</strong><span>Add a room or choose another category.</span></div> : (
        <div className="room-card-grid">
          {visibleRooms.map((room) => {
            const assigned = occupants.filter((tenant) => tenant.roomId === room.id);
            const occupied = assigned.length;
            const status = !room.isActive ? "Inactive" : occupied > 0 ? "Occupied" : "Vacant";
            return <article className="room-card" key={room.id}>
              <div className="room-card-top"><span className="room-door-icon">⌂</span><span className={`room-status-chip ${status.toLowerCase()}`}>{status}</span></div>
              <h3>{room.roomNumber}</h3>
              <p className="room-floor-label">{room.floorNumber === null ? "Floor not set" : `Floor ${room.floorNumber}`}</p>
              <div className="room-bed-meter"><div><span>Beds</span><b>{occupied} / {room.capacity}</b></div><span className="room-meter-track"><i style={{ width: `${Math.min(100, occupied / room.capacity * 100)}%` }}/></span></div>
              <div className="room-occupants">{assigned.length ? assigned.map((tenant) => <span key={`${room.id}-${tenant.fullName}`} className="room-occupant-pill">{tenant.fullName}</span>) : <span className="room-empty-copy">No tenants assigned</span>}</div>
              {room.notes && <p className="room-note">{room.notes}</p>}
              <div className="room-card-actions"><button type="button" onClick={() => startEditing(room)}>Edit room</button>{room.isActive ? <button className="room-secondary-action" type="button" onClick={() => void deactivateRoom(room)}>Deactivate</button> : <button className="room-secondary-action" type="button" onClick={() => void setRoomActive(room, true)}>Reactivate</button>}</div>
            </article>;
          })}
        </div>
      )}
      <button className="tenant-add-fab" type="button" onClick={startCreating} aria-label="Add room" title="Add room">+</button>
      {isFormOpen && <div className="tenant-dialog-backdrop"><section className="tenant-dialog" role="dialog" aria-modal="true" aria-labelledby="room-form-title"><div className="tenant-dialog-heading"><div><span className="eyebrow">ROOM DETAILS</span><h2 id="room-form-title">{editingRoom ? "Edit room" : "Add room"}</h2></div><button className="tenant-dialog-close" type="button" onClick={clearForm} aria-label="Close">×</button></div><form className="tenant-form" onSubmit={saveRoom}>
        <label>Room number<input required maxLength={30} value={roomNumber} onChange={(event) => setRoomNumber(event.target.value)} /></label>
        <label>Capacity<input type="number" required min="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} /></label>
        <label>Floor number<input type="number" value={floorNumber} onChange={(event) => setFloorNumber(event.target.value)} /></label>
        <label>Notes<input maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        <div className="tenant-form-actions"><button className="tenant-cancel-button" type="button" onClick={clearForm}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : editingRoom ? "Save changes" : "Add room"}</button></div>
      </form></section></div>}
    </section>
  );
}


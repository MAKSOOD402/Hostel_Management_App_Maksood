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

interface RoomsPageProps {
  hostelId: number;
  accessToken: string;
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5204";

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
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/rooms`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data: Room[] = await response.json();
      setRooms(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load rooms.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRooms();
  }, [hostelId, accessToken]);

  function clearForm() {
    setEditingRoom(null);
    setRoomNumber("");
    setCapacity("1");
    setFloorNumber("");
    setNotes("");
  }

  function startEditing(room: Room) {
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

  return (
    <section style={{ marginTop: 32 }}>
      <h2>Rooms</h2>

      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
      {message && <p role="status">{message}</p>}

      <form onSubmit={saveRoom}>
        <h3>{editingRoom ? "Edit room" : "Add room"}</h3>

        <label>
          Room number
          <input
            required
            maxLength={30}
            value={roomNumber}
            onChange={(event) => setRoomNumber(event.target.value)}
          />
        </label>

        <label>
          Capacity
          <input
            type="number"
            required
            min="1"
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
          />
        </label>

        <label>
          Floor number
          <input
            type="number"
            value={floorNumber}
            onChange={(event) => setFloorNumber(event.target.value)}
          />
        </label>

        <label>
          Notes
          <input
            maxLength={500}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : editingRoom ? "Save changes" : "Add room"}
        </button>

        {editingRoom && (
          <button type="button" onClick={clearForm}>
            Cancel edit
          </button>
        )}
      </form>

      {loading ? (
        <p>Loading rooms...</p>
      ) : rooms.length === 0 ? (
        <p>No rooms found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Room</th>
              <th>Capacity</th>
              <th>Floor</th>
              <th>Notes</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id}>
                <td>{room.roomNumber}</td>
                <td>{room.capacity}</td>
                <td>{room.floorNumber ?? "—"}</td>
                <td>{room.notes || "—"}</td>
                <td>{room.isActive ? "Active" : "Inactive"}</td>
                <td>
                  <button type="button" onClick={() => startEditing(room)}>
                    Edit
                  </button>{" "}
                  {room.isActive ? (
                    <button
                      type="button"
                      onClick={() => void deactivateRoom(room)}
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void setRoomActive(room, true)}
                    >
                      Reactivate
                    </button>
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
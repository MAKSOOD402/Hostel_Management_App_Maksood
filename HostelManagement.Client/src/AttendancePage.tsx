import { useEffect, useState } from "react";

interface Tenant {
  id: number;
  fullName: string;
  isActive: boolean;
}

interface AttendanceRecord {
  id: number;
  hostelId: number;
  tenantId: number;
  tenantName: string;
  attendanceDate: string;
  status: string;
  notes: string | null;
}

interface AttendanceResponse {
  date: string;
  records: AttendanceRecord[];
}

interface AttendanceRow {
  tenantId: number;
  tenantName: string;
  status: string;
  notes: string;
}

interface AttendancePageProps {
  hostelId: number;
  accessToken: string;
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5204";

const attendanceStatuses = ["Present", "Absent", "Leave"];

function todayAsDateInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

export default function AttendancePage({
  hostelId,
  accessToken,
}: AttendancePageProps) {
  const [date, setDate] = useState(todayAsDateInputValue());
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingTenantId, setSavingTenantId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAttendance() {
      setLoading(true);
      setError("");
      setMessage("");

      try {
        const headers = {
          Authorization: `Bearer ${accessToken}`,
        };

        const [tenantsResponse, attendanceResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/hostels/${hostelId}/tenants`, { headers }),
          fetch(
            `${apiBaseUrl}/api/hostels/${hostelId}/attendance?date=${encodeURIComponent(date)}`,
            { headers }
          ),
        ]);

        if (!tenantsResponse.ok) {
          throw new Error(await readError(tenantsResponse));
        }

        if (!attendanceResponse.ok) {
          throw new Error(await readError(attendanceResponse));
        }

        const tenants: Tenant[] = await tenantsResponse.json();
        const attendance: AttendanceResponse =
          await attendanceResponse.json();

        const recordsByTenant = new Map(
          attendance.records.map((record) => [record.tenantId, record])
        );

        const nextRows = tenants
          .filter((tenant) => tenant.isActive)
          .map((tenant) => {
            const record = recordsByTenant.get(tenant.id);

            return {
              tenantId: tenant.id,
              tenantName: tenant.fullName,
              status: record?.status ?? "",
              notes: record?.notes ?? "",
            };
          });

        if (!cancelled) {
          setRows(nextRows);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load attendance."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAttendance();

    return () => {
      cancelled = true;
    };
  }, [hostelId, accessToken, date]);

  function updateRow(
    tenantId: number,
    changes: Partial<Pick<AttendanceRow, "status" | "notes">>
  ) {
    setRows((current) =>
      current.map((row) =>
        row.tenantId === tenantId ? { ...row, ...changes } : row
      )
    );
  }

  async function saveAttendance(row: AttendanceRow) {
    if (!row.status) {
      setError(`Choose an attendance status for ${row.tenantName}.`);
      return;
    }

    setSavingTenantId(row.tenantId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/attendance/${row.tenantId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            attendanceDate: date,
            status: row.status,
            notes: row.notes || null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setMessage(`Attendance saved for ${row.tenantName}.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save attendance."
      );
    } finally {
      setSavingTenantId(null);
    }
  }

  return (
    <section style={{ marginTop: 32 }}>
      <h2>Attendance</h2>

      <label>
        Attendance date
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>

      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
      {message && <p role="status">{message}</p>}

      {loading ? (
        <p>Loading attendance...</p>
      ) : rows.length === 0 ? (
        <p>No active tenants found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Status</th>
              <th>Notes</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.tenantId}>
                <td>{row.tenantName}</td>
                <td>
                  <select
                    value={row.status}
                    onChange={(event) =>
                      updateRow(row.tenantId, { status: event.target.value })
                    }
                  >
                    <option value="">Choose status</option>
                    {attendanceStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    maxLength={500}
                    value={row.notes}
                    onChange={(event) =>
                      updateRow(row.tenantId, { notes: event.target.value })
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    disabled={savingTenantId === row.tenantId}
                    onClick={() => void saveAttendance(row)}
                  >
                    {savingTenantId === row.tenantId ? "Saving..." : "Save"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
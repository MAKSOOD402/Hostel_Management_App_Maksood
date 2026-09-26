import { useEffect, useState } from "react";
import type { FormEvent } from "react";

interface BillOption {
  id: number;
  billNumber: string;
  status: string;
}

interface Reminder {
  id: number;
  billId: number;
  billNumber: string;
  billStatus: string;
  channel: string;
  scheduledAt: string;
  reminderStatus: string;
  attemptCount: number;
  processedAt: string | null;
}

interface RemindersPageProps {
  hostelId: number;
  accessToken: string;
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5204";

const channels = ["InApp", "Email", "SMS", "Push"];

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

function localDateTimeValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

export default function RemindersPage({
  hostelId,
  accessToken,
}: RemindersPageProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [bills, setBills] = useState<BillOption[]>([]);
  const [billId, setBillId] = useState("");
  const [channel, setChannel] = useState("InApp");
  const [scheduledAt, setScheduledAt] = useState(() =>
    localDateTimeValue(new Date(Date.now() + 60 * 60 * 1000))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
      };

      const [remindersResponse, billsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/hostels/${hostelId}/reminders`, { headers }),
        fetch(`${apiBaseUrl}/api/hostels/${hostelId}/bills`, { headers }),
      ]);

      if (!remindersResponse.ok) {
        throw new Error(await readError(remindersResponse));
      }

      if (!billsResponse.ok) {
        throw new Error(await readError(billsResponse));
      }

      const reminderData: Reminder[] = await remindersResponse.json();
      const billData: BillOption[] = await billsResponse.json();

      setReminders(reminderData);
      const eligibleBills = billData.filter(
        (bill) => !["paid", "cancelled"].includes(bill.status.toLowerCase())
      );
      setBills(eligibleBills);

      setBillId((current) => {
        if (eligibleBills.some((bill) => String(bill.id) === current)) {
          return current;
        }

        return eligibleBills.length > 0 ? String(eligibleBills[0].id) : "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reminders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [hostelId, accessToken]);

  async function scheduleReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const localScheduledDate = new Date(scheduledAt);

    if (Number.isNaN(localScheduledDate.getTime())) {
      setError("Choose a valid scheduled date and time.");
      setSaving(false);
      return;
    }

    if (localScheduledDate.getTime() <= Date.now()) {
      setError("Choose a future date and time.");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/reminders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            billId: Number(billId),
            channel,
            scheduledAt: localScheduledDate.toISOString(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setMessage("Reminder scheduled.");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not schedule reminder."
      );
    } finally {
      setSaving(false);
    }
  }

  async function cancelReminder(reminder: Reminder) {
    if (!window.confirm(`Cancel reminder for bill ${reminder.billNumber}?`)) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/reminders/${reminder.id}`,
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

      setMessage("Reminder cancelled.");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not cancel reminder."
      );
    }
  }

  return (
    <section className="hm-page reminders-page">
      <header className="hm-page-heading"><div><span className="hm-eyebrow">COLLECTIONS</span><h2>Bill reminders</h2><p>Schedule and track payment follow-ups.</p></div></header>

      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
      {message && <p role="status">{message}</p>}

      <form onSubmit={scheduleReminder}>
        <h3>Schedule reminder</h3>

        <label>
          Bill
          <select
            required
            value={billId}
            onChange={(event) => setBillId(event.target.value)}
            disabled={bills.length === 0}
          >
            {bills.length === 0 ? (
              <option value="">No eligible bills</option>
            ) : (
              bills.map((bill) => (
                <option key={bill.id} value={bill.id}>
                  {bill.billNumber} — {bill.status}
                </option>
              ))
            )}
          </select>
        </label>

        <label>
          Channel
          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
          >
            {channels.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          Scheduled date and time
          <input
            type="datetime-local"
            required
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
          />
        </label>

        <button type="submit" disabled={saving || bills.length === 0}>
          {saving ? "Scheduling..." : "Schedule reminder"}
        </button>
      </form>

      {loading ? (
        <p>Loading reminders...</p>
      ) : reminders.length === 0 ? (
        <p>No reminders found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Bill</th>
              <th>Bill status</th>
              <th>Channel</th>
              <th>Scheduled</th>
              <th>Reminder status</th>
              <th>Attempts</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {reminders.map((reminder) => (
              <tr key={reminder.id}>
                <td>{reminder.billNumber}</td>
                <td>{reminder.billStatus}</td>
                <td>{reminder.channel}</td>
                <td>{new Date(reminder.scheduledAt).toLocaleString()}</td>
                <td>{reminder.reminderStatus}</td>
                <td>{reminder.attemptCount}</td>
                <td>
                  {reminder.reminderStatus === "Scheduled" && (
                    <button
                      type="button"
                      onClick={() => void cancelReminder(reminder)}
                    >
                      Cancel
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

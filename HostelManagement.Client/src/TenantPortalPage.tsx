import { useEffect, useState } from "react";
import type { FormEvent } from "react";

interface TenantBill {
  id: number;
  billNumber: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  status: string;
  paidAt: string | null;
}

interface TenantComplaint {
  id: number;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
}

interface TenantNotification {
  id: number;
  billId: number | null;
  channel: string;
  title: string;
  message: string;
  readAt: string | null;
  sentAt: string;
}

interface NotificationsResponse {
  totalCount: number;
  notifications: TenantNotification[];
}

interface TenantPortalPageProps {
  accessToken: string;
}

type PortalTab = "bills" | "complaints" | "notifications";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "https://hostelmanagementapp-epa5awhmedaxh5au.southindia-01.azurewebsites.net";

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

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
}

export default function TenantPortalPage({
  accessToken,
}: TenantPortalPageProps) {
  const [activeTab, setActiveTab] = useState<PortalTab>("bills");
  const [bills, setBills] = useState<TenantBill[]>([]);
  const [complaints, setComplaints] = useState<TenantComplaint[]>([]);
  const [notifications, setNotifications] = useState<TenantNotification[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [priority, setPriority] = useState("Normal");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadPortal() {
    setLoading(true);
    setError("");

    try {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
      };

      const [billsResponse, complaintsResponse, notificationsResponse] =
        await Promise.all([
          fetch(`${apiBaseUrl}/api/tenant-portal/bills`, { headers }),
          fetch(`${apiBaseUrl}/api/tenant-portal/complaints`, { headers }),
          fetch(`${apiBaseUrl}/api/tenant-portal/notifications`, { headers }),
        ]);

      if (!billsResponse.ok) throw new Error(await readError(billsResponse));
      if (!complaintsResponse.ok) {
        throw new Error(await readError(complaintsResponse));
      }
      if (!notificationsResponse.ok) {
        throw new Error(await readError(notificationsResponse));
      }

      const billsData: TenantBill[] = await billsResponse.json();
      const complaintsData: TenantComplaint[] =
        await complaintsResponse.json();
      const notificationsData: NotificationsResponse =
        await notificationsResponse.json();

      setBills(billsData);
      setComplaints(complaintsData);
      setNotifications(notificationsData.notifications);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load your portal."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPortal();
  }, [accessToken]);

  async function submitComplaint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/tenant-portal/complaints`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            title,
            description,
            category,
            priority,
          }),
        }
      );

      if (!response.ok) throw new Error(await readError(response));

      setTitle("");
      setDescription("");
      setCategory("General");
      setPriority("Normal");
      setMessage("Your complaint was submitted.");
      await loadPortal();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not submit complaint."
      );
    } finally {
      setSaving(false);
    }
  }

  async function markNotificationRead(notificationId: number) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/tenant-portal/notifications/${notificationId}/read`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error(await readError(response));

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? { ...notification, readAt: new Date().toISOString() }
            : notification
        )
      );
      setMessage("Notification marked as read.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update notification."
      );
    }
  }

  return (
    <main className="hm-page tenant-portal-page">
      <header className="hm-page-heading"><div><span className="hm-eyebrow">YOUR ACCOUNT</span><h2>Tenant Portal</h2><p>Bills, requests, and hostel updates.</p></div></header>

      <nav className="portal-tabs" aria-label="Tenant portal navigation">
        <button className={activeTab === "bills" ? "active" : ""} type="button" onClick={() => setActiveTab("bills")}>
          My bills
        </button>
        <button className={activeTab === "complaints" ? "active" : ""} type="button" onClick={() => setActiveTab("complaints")}>
          My complaints
        </button>
        <button className={activeTab === "notifications" ? "active" : ""} type="button" onClick={() => setActiveTab("notifications")}>
          Notifications
        </button>
      </nav>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {loading && <p>Loading your information...</p>}

      {!loading && activeTab === "bills" && (
        <section>
          <h2>My bills</h2>
          {bills.length === 0 ? (
            <p>You don’t have any bills yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Period</th>
                  <th>Due date</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <tr key={bill.id}>
                    <td>{bill.billNumber}</td>
                    <td>
                      {bill.periodStart} – {bill.periodEnd}
                    </td>
                    <td>{bill.dueDate}</td>
                    <td>{formatMoney(bill.totalAmount)}</td>
                    <td>{bill.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {!loading && activeTab === "complaints" && (
        <section>
          <h2>Submit a complaint</h2>

          <form onSubmit={submitComplaint}>
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
                {["Low", "Normal", "High", "Urgent"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" disabled={saving}>
              {saving ? "Submitting..." : "Submit complaint"}
            </button>
          </form>

          <h2>My complaints</h2>
          {complaints.length === 0 ? (
            <p>You haven’t submitted any complaints.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((complaint) => (
                  <tr key={complaint.id}>
                    <td>
                      <strong>{complaint.title}</strong>
                      <br />
                      {complaint.description}
                    </td>
                    <td>{complaint.category}</td>
                    <td>{complaint.priority}</td>
                    <td>{complaint.status}</td>
                    <td>{new Date(complaint.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {!loading && activeTab === "notifications" && (
        <section>
          <h2>My notifications</h2>
          {notifications.length === 0 ? (
            <p>You don’t have any notifications yet.</p>
          ) : (
            <ul>
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                  <small>
                    {notification.channel} ·{" "}
                    {new Date(notification.sentAt).toLocaleString()}
                  </small>

                  {!notification.readAt && (
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          void markNotificationRead(notification.id)
                        }
                      >
                        Mark as read
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

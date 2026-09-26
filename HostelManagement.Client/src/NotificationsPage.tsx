import { useEffect, useState } from "react";

interface Tenant {
  id: number;
  fullName: string;
  isActive: boolean;
}

interface Notification {
  id: number;
  billId: number | null;
  channel: string;
  title: string;
  message: string;
  readAt: string | null;
  sentAt: string;
}

interface NotificationsResponse {
  page: number;
  pageSize: number;
  totalCount: number;
  notifications: Notification[];
}

interface NotificationsPageProps {
  hostelId: number;
  accessToken: string;
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5204";

const pageSize = 20;

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

export default function NotificationsPage({
  hostelId,
  accessToken,
}: NotificationsPageProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadTenants() {
      setLoadingTenants(true);
      setError("");

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/hostels/${hostelId}/tenants`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(await readError(response));
        }

        const data: Tenant[] = await response.json();
        const activeTenants = data.filter((tenant) => tenant.isActive);

        if (!cancelled) {
          setTenants(activeTenants);
          setTenantId((current) => {
            if (activeTenants.some((tenant) => String(tenant.id) === current)) {
              return current;
            }

            return activeTenants.length > 0
              ? String(activeTenants[0].id)
              : "";
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load tenants."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingTenants(false);
        }
      }
    }

    void loadTenants();

    return () => {
      cancelled = true;
    };
  }, [hostelId, accessToken]);

  useEffect(() => {
    if (!tenantId) {
      setNotifications([]);
      setTotalCount(0);
      return;
    }

    let cancelled = false;

    async function loadNotifications() {
      setLoadingNotifications(true);
      setError("");

      try {
        const query = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          unreadOnly: String(unreadOnly),
        });

        const response = await fetch(
          `${apiBaseUrl}/api/hostels/${hostelId}/tenants/${tenantId}/notifications?${query}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(await readError(response));
        }

        const data: NotificationsResponse = await response.json();

        if (!cancelled) {
          setNotifications(data.notifications);
          setTotalCount(data.totalCount);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load notifications."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingNotifications(false);
        }
      }
    }

    void loadNotifications();

    return () => {
      cancelled = true;
    };
  }, [hostelId, accessToken, tenantId, page, unreadOnly]);

  async function markAsRead(notificationId: number) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/tenants/${tenantId}/notifications/${notificationId}/read`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setMessage("Notification marked as read.");

      if (unreadOnly) {
        setPage(1);
      } else {
        // Trigger the notifications effect to reload the current page.
        setNotifications((current) =>
          current.map((notification) =>
            notification.id === notificationId
              ? { ...notification, readAt: new Date().toISOString() }
              : notification
          )
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not mark notification as read."
      );
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <section style={{ marginTop: 32 }}>
      <h2>Notifications</h2>

      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
      {message && <p role="status">{message}</p>}

      {loadingTenants ? (
        <p>Loading tenants...</p>
      ) : tenants.length === 0 ? (
        <p>No active tenants found.</p>
      ) : (
        <>
          <label>
            Tenant
            <select
              value={tenantId}
              onChange={(event) => {
                setTenantId(event.target.value);
                setPage(1);
                setMessage("");
              }}
            >
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.fullName}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "block", margin: "16px 0" }}>
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => {
                setUnreadOnly(event.target.checked);
                setPage(1);
                setMessage("");
              }}
            />
            {" "}Show unread only
          </label>

          {loadingNotifications ? (
            <p>Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <p>No notifications found for this tenant.</p>
          ) : (
            <>
              <ul>
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    style={{
                      marginBottom: 16,
                      fontWeight: notification.readAt ? "normal" : "bold",
                    }}
                  >
                    <strong>{notification.title}</strong>
                    <p>{notification.message}</p>
                    <small>
                      {notification.channel} ·{" "}
                      {new Date(notification.sentAt).toLocaleString()}
                      {notification.billId !== null &&
                        ` · Bill ID ${notification.billId}`}
                    </small>

                    {!notification.readAt && (
                      <div>
                        <button
                          type="button"
                          onClick={() => void markAsRead(notification.id)}
                        >
                          Mark as read
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <div>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </button>
                <span style={{ margin: "0 12px" }}>
                  Page {page} of {totalPages} · {totalCount} notification(s)
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
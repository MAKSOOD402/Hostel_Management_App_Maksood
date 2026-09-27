import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

interface StaffAccount {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

interface StaffAccountsPageProps {
  hostelId: number;
  accessToken: string;
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "https://hostelmanagementapp-epa5awhmedaxh5au.southindia-01.azurewebsites.net";

async function getErrorMessage(response: Response): Promise<string> {
  const text = await response.text();

  if (!text) return `Request failed (${response.status}).`;

  try {
    const data: unknown = JSON.parse(text);
    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string"
    ) {
      return data.message;
    }
  } catch {
    // The server returned plain text.
  }

  return text;
}

export default function StaffAccountsPage({
  hostelId,
  accessToken,
}: StaffAccountsPageProps) {
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const endpoint = `${apiBaseUrl}/api/hostels/${hostelId}/staff-accounts`;

  const loadStaff = useCallback(async () => {
    setError("");

    try {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data: StaffAccount[] = await response.json();
      setStaff(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load staff accounts."
      );
    } finally {
      setLoading(false);
    }
  }, [endpoint, accessToken]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  async function createStaffAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          password,
        }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      setFullName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setMessage("Staff account created.");
      await loadStaff();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create staff account."
      );
    } finally {
      setSaving(false);
    }
  }

  async function revokeAccess(account: StaffAccount) {
    const confirmed = window.confirm(
      `Revoke ${account.fullName}'s access to this hostel?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(`${endpoint}/${account.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      setMessage(`Access revoked for ${account.fullName}.`);
      await loadStaff();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not revoke staff access."
      );
    }
  }

  return (
    <section className="hm-page staff-page">
      <header className="hm-page-heading"><div><span className="hm-eyebrow">ADMINISTRATION</span><h2>Staff accounts</h2><p>Create logins and manage hostel access.</p></div></header>
      <p>Create staff logins and manage access to this hostel.</p>

      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
      {message && <p role="status">{message}</p>}

      <form onSubmit={createStaffAccount}>
        <h2>Create staff account</h2>

        <label>
          Full name
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            maxLength={150}
            autoComplete="name"
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            maxLength={254}
            autoComplete="email"
          />
        </label>

        <label>
          Phone
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            maxLength={30}
            autoComplete="tel"
          />
        </label>

        <label>
          Temporary password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>

        <button type="submit" disabled={saving}>
          {saving ? "Creating..." : "Create staff account"}
        </button>
      </form>

      <h2>Staff with access</h2>

      {loading ? (
        <p>Loading staff accounts...</p>
      ) : staff.length === 0 ? (
        <p>No staff accounts found for this hostel.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Created</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((account) => (
                <tr key={account.id}>
                  <td>{account.fullName}</td>
                  <td>{account.email}</td>
                  <td>{account.phone || "—"}</td>
                  <td>{account.isActive ? "Active" : "Inactive"}</td>
                  <td>
                    {new Date(account.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => void revokeAccess(account)}
                      disabled={!account.isActive}
                    >
                      {account.isActive ? "Revoke access" : "Inactive"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

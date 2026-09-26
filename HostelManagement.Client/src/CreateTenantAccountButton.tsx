import { useState } from "react";

interface CreateTenantAccountButtonProps {
  hostelId: number;
  tenantId: number;
  tenantName: string;
  tenantEmail: string | null;
  accessToken: string;
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5204";

export default function CreateTenantAccountButton({
  hostelId,
  tenantId,
  tenantName,
  tenantEmail,
  accessToken,
}: CreateTenantAccountButtonProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(tenantEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/tenants/${tenantId}/account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ email, password }),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        let message = text || `Request failed (${response.status}).`;

        try {
          message = JSON.parse(text).message ?? message;
        } catch {
          // Use the response text if it isn't JSON.
        }

        throw new Error(message);
      }

      setCreated(true);
      setPassword("");
      setConfirmPassword("");
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create tenant account."
      );
    } finally {
      setLoading(false);
    }
  }

  if (created) {
    return <span role="status">Login created</span>;
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Create login
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`tenant-account-title-${tenantId}`}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            display: "grid",
            placeItems: "center",
            padding: 16,
            background: "rgb(16 24 40 / 55%)",
          }}
        >
          <form
            onSubmit={createAccount}
            style={{
              width: "min(440px, 100%)",
              background: "white",
              borderRadius: 12,
              padding: 24,
            }}
          >
            <h2 id={`tenant-account-title-${tenantId}`}>
              Create login for {tenantName}
            </h2>

            {error && <p role="alert">{error}</p>}

            <label>
              Login email
              <input
                type="email"
                required
                maxLength={254}
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label>
              Temporary password (minimum 12 characters)
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            <label>
              Confirm password
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>

            <button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create account"}
            </button>

            <button type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </form>
        </div>
      )}
    </>
  );
}
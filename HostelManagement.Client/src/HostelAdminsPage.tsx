import { useState } from "react";
import type { FormEvent } from "react";

interface HostelAdminsPageProps {
  hostelId: number;
  accessToken: string;
}

interface CreatedAdmin {
  id: number;
  email: string;
  fullName: string;
  hostelId: number;
  role: string;
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "https://hostelmanagementapp-epa5awhmedaxh5au.southindia-01.azurewebsites.net";
const phonePattern = /^(?:[0-9]{10}|\+[1-9][0-9]{7,14})$/;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,128}$/;

export default function HostelAdminsPage({
  hostelId,
  accessToken,
}: HostelAdminsPageProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdAdmin, setCreatedAdmin] = useState<CreatedAdmin | null>(null);

  async function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setCreatedAdmin(null);

    const cleanName = fullName.trim().replace(/\s+/g, " ");
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    if (cleanName.length < 2 || cleanName.length > 150) {
      setError("Full name must be between 2 and 150 characters.");
      setSaving(false);
      return;
    }

    if (cleanPhone && !phonePattern.test(cleanPhone)) {
      setError("Enter a 10-digit phone number or an international number such as +14155552671.");
      setSaving(false);
      return;
    }

    if (!passwordPattern.test(password)) {
      setError("Password must be 12–128 characters and include lowercase, uppercase, a number, and a symbol.");
      setSaving(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/admins`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            fullName: cleanName,
            email: cleanEmail,
            phone: cleanPhone || null,
            password,
          }),
        }
      );

      const text = await response.text();
      let data: CreatedAdmin | { message?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        // Keep a plain-text API error available below.
      }

      if (!response.ok) {
        const apiMessage = "message" in data ? data.message : undefined;
        throw new Error(apiMessage || text || "Could not create the Admin account.");
      }

      setCreatedAdmin(data as CreatedAdmin);
      setFullName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create the Admin account."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="hm-page">
      <header className="hm-page-heading">
        <div>
          <span className="hm-eyebrow">ADMINISTRATION</span>
          <h2>Add an Admin</h2>
          <p>This account will have Admin access to this hostel.</p>
        </div>
      </header>

      {error && <p className="hm-alert-error" role="alert">{error}</p>}

      {createdAdmin && (
        <p className="hm-inline-success" role="status">
          Created {createdAdmin.fullName} ({createdAdmin.email}) as an Admin for
          hostel {createdAdmin.hostelId}. They can now find this hostel when they
          sign in.
        </p>
      )}

      <form className="staff-page-form" onSubmit={createAdmin}>
        <label>
          Full name
          <input
            required
            minLength={2}
            maxLength={150}
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </label>

        <label>
          Email
          <input
            required
            type="email"
            maxLength={254}
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label>
          Phone (optional)
          <input
            type="tel"
            maxLength={16}
            pattern="(?:[0-9]{10}|\+[1-9][0-9]{7,14})"
            title="Use 10 digits or an international number beginning with +."
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>

        <label>
          Password
          <input
            required
            type="password"
            minLength={12}
            maxLength={128}
            pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,128}"
            title="Use 12–128 characters with lowercase, uppercase, a number, and a symbol."
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <label>
          Confirm password
          <input
            required
            type="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>

        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? "Creating account…" : "Create Admin account"}
        </button>
      </form>
    </section>
  );
}


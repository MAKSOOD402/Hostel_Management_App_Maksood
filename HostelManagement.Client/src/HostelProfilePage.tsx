import { useEffect, useState } from "react";
import type { FormEvent } from "react";

interface HostelProfile {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  timezoneName: string;
  isActive: boolean;
}

interface HostelProfilePageProps {
  hostelId: number;
  accessToken: string;
  isAdmin: boolean;
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5204";

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

export default function HostelProfilePage({
  hostelId,
  accessToken,
  isAdmin,
}: HostelProfilePageProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [timezoneName, setTimezoneName] = useState("Asia/Kolkata");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/hostels/${hostelId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) throw new Error(await readError(response));

        const profile: HostelProfile = await response.json();

        if (!cancelled) {
          setName(profile.name);
          setAddress(profile.address ?? "");
          setPhone(profile.phone ?? "");
          setEmail(profile.email ?? "");
          setTimezoneName(profile.timezoneName);
          setIsActive(profile.isActive);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load hostel profile."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [hostelId, accessToken]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            name,
            address: address || null,
            phone: phone || null,
            email: email || null,
            timezoneName,
          }),
        }
      );

      if (!response.ok) throw new Error(await readError(response));

      const updated: HostelProfile = await response.json();
      setName(updated.name);
      setAddress(updated.address ?? "");
      setPhone(updated.phone ?? "");
      setEmail(updated.email ?? "");
      setTimezoneName(updated.timezoneName);
      setIsActive(updated.isActive);
      setMessage("Hostel profile saved.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save hostel profile."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading hostel profile...</p>;

  return (
    <section>
      <h2>Hostel profile</h2>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      <form onSubmit={saveProfile}>
        <label>
          Hostel name
          <input
            required
            minLength={2}
            maxLength={150}
            disabled={!isAdmin}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label>
          Address
          <textarea
            maxLength={500}
            disabled={!isAdmin}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </label>

        <label>
          Phone
          <input
            maxLength={30}
            disabled={!isAdmin}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>

        <label>
          Email
          <input
            type="email"
            maxLength={254}
            disabled={!isAdmin}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label>
          Timezone
          <input
            required
            maxLength={100}
            disabled={!isAdmin}
            value={timezoneName}
            onChange={(event) => setTimezoneName(event.target.value)}
          />
        </label>

        <p>Account status: {isActive ? "Active" : "Inactive"}</p>

        {isAdmin ? (
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save profile"}
          </button>
        ) : (
          <p>This profile is read-only for Staff users.</p>
        )}
      </form>
    </section>
  );
}
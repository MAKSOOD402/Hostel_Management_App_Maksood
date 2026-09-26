import { useState } from "react";

interface TenantProfile {
  id: number;
  hostelId: number;
  roomId: number | null;
  roomNumber: string | null;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  moveInDate: string;
  moveOutDate: string | null;
  isActive: boolean;
}

interface TenantProfileButtonProps {
  hostelId: number;
  tenantId: number;
  accessToken: string;
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

export default function TenantProfileButton({
  hostelId,
  tenantId,
  accessToken,
}: TenantProfileButtonProps) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function showProfile() {
    setOpen(true);
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/tenants/${tenantId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setProfile(await response.json());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load tenant profile."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => void showProfile()}>
        Profile
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`tenant-profile-title-${tenantId}`}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: 16,
            background: "rgb(16 24 40 / 55%)",
          }}
        >
          <section
            style={{
              width: "min(560px, 100%)",
              maxHeight: "90vh",
              overflow: "auto",
              padding: 24,
              background: "white",
              borderRadius: 12,
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ float: "right" }}
            >
              Close
            </button>

            <h2 id={`tenant-profile-title-${tenantId}`}>Tenant profile</h2>

            {loading && <p>Loading profile...</p>}
            {error && <p role="alert">{error}</p>}

            {profile && (
              <>
                <h3>{profile.fullName}</h3>
                <p>
                  {profile.roomNumber
                    ? `Room ${profile.roomNumber}`
                    : "No room assigned"}{" "}
                  · {profile.isActive ? "Active" : "Inactive"}
                </p>

                <p>
                  <strong>Phone:</strong>{" "}
                  <a href={`tel:${profile.phoneNumber}`}>
                    {profile.phoneNumber}
                  </a>
                </p>
                <p>
                  <strong>Email:</strong>{" "}
                  {profile.email ? (
                    <a href={`mailto:${profile.email}`}>{profile.email}</a>
                  ) : (
                    "—"
                  )}
                </p>
                <p><strong>Move-in:</strong> {profile.moveInDate}</p>
                <p><strong>Move-out:</strong> {profile.moveOutDate ?? "—"}</p>
                <p>
                  <strong>Emergency contact:</strong>{" "}
                  {profile.emergencyName ?? "—"}
                </p>
                <p>
                  <strong>Emergency phone:</strong>{" "}
                  {profile.emergencyPhone ?? "—"}
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
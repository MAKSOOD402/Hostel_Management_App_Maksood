import { useState } from "react";
import type { FormEvent } from "react";

export interface AuthResponse {
  accessToken: string;
  expiresAtUtc: string;
  user: {
    id: number;
    email: string;
    fullName: string;
    hostelId: number;
    hostelName?: string;
    role: string;
    tenantId?: number | null;
  };
}

interface HostelOption {
  hostelId: number;
  hostelName: string;
  role: string;
}

interface LoginPageProps {
  onLogin: (auth: AuthResponse) => void;
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

function validateCredentials(email: string, password: string): string | null {
  const normalizedEmail = email.trim();

  if (
    normalizedEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    return "Enter a valid email address.";
  }

  if (!password || password.length > 256) {
    return "Enter your password. It must be 256 characters or fewer.";
  }

  return null;
}

function HostelIllustration() {
  return (
    <svg
      className="login-art"
      viewBox="0 0 320 170"
      role="img"
      aria-label="Illustration of a hostel building"
    >
      <circle cx="257" cy="35" r="19" fill="#ffd66b" />
      <path
        d="M0 139c45-22 77-17 116-4 45 15 94 13 204-10v45H0z"
        fill="#dff4e8"
      />
      <path
        d="M27 144c25-12 50-11 77-1v27H27zM236 135c27-14 53-13 84-1v36h-84z"
        fill="#b7e5c8"
      />
      <path
        d="M88 61 157 23l72 38v88H88z"
        fill="#f8fbff"
        stroke="#b6cae5"
        strokeWidth="3"
      />
      <path d="M75 63 157 17l84 46-8 13-76-42-75 42z" fill="#3478d4" />
      <path d="M145 106h26v43h-26z" fill="#79a8e9" />
      <path
        d="M104 77h22v22h-22zM137 77h22v22h-22zM177 77h22v22h-22zM210 77h9v22h-9z"
        fill="#b9dcff"
        stroke="#81a8d6"
        strokeWidth="2"
      />
      <path
        d="M45 145v-21m0 8-11-9m11 15 12-10M267 143v-22m0 8-12-10m12 14 12-11"
        fill="none"
        stroke="#4e9c69"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M39 124c-8-14 9-24 17-12 9-15 25-4 16 10M258 121c-7-13 8-21 15-11 8-13 21-3 14 11"
        fill="#66b77b"
      />
      <path
        d="M152 121h12"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState(
    () => localStorage.getItem("hostel.login.email") ?? ""
  );
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"Admin" | "Tenant">("Admin");
  const [rememberEmail, setRememberEmail] = useState(
    () => localStorage.getItem("hostel.login.email") !== null
  );
  const [hostels, setHostels] = useState<HostelOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newHostelName, setNewHostelName] = useState("");
  const [newHostelAddress, setNewHostelAddress] = useState("");
  const [newHostelPhone, setNewHostelPhone] = useState("");
  const [newHostelEmail, setNewHostelEmail] = useState("");
  const [newHostelTimezone, setNewHostelTimezone] =
    useState("Asia/Kolkata");

  async function findHostels(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const validationError = validateCredentials(email, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);

    if (rememberEmail) {
      localStorage.setItem("hostel.login.email", normalizedEmail);
    } else {
      localStorage.removeItem("hostel.login.email");
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/hostels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data: { hostels: HostelOption[] } = await response.json();
      const matches = data.hostels.filter((hostel) =>
        accountType === "Tenant"
          ? hostel.role.toLowerCase() === "tenant"
          : ["admin", "staff"].includes(hostel.role.toLowerCase())
      );

      if (matches.length === 0) {
        throw new Error(
          `No ${accountType.toLowerCase()} hostel access was found for this account.`
        );
      }

      setHostels(matches);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not find your hostels."
      );
    } finally {
      setLoading(false);
    }
  }

  async function selectHostel(hostel: HostelOption) {
    setError("");

    const validationError = validateCredentials(email, password);
    if (validationError) {
      setError(validationError);
      setHostels(null);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          hostelId: hostel.hostelId,
          role: hostel.role,
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const auth: AuthResponse = await response.json();

      onLogin({
        ...auth,
        user: { ...auth.user, hostelName: hostel.hostelName },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  async function createHostel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const validationError = validateCredentials(email, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    const cleanHostelName = newHostelName.trim();
    if (cleanHostelName.length < 2 || cleanHostelName.length > 150) {
      setError("Hostel name must be between 2 and 150 characters.");
      return;
    }

    const adminHostel = hostels?.find(
      (hostel) => hostel.role.toLowerCase() === "admin"
    );

    if (!adminHostel) {
      setError("Only an Admin account can create a hostel.");
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const existingLoginResponse = await fetch(
        `${apiBaseUrl}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            password,
            hostelId: adminHostel.hostelId,
            role: "Admin",
          }),
        }
      );

      if (!existingLoginResponse.ok) {
        throw new Error(await readError(existingLoginResponse));
      }

      const existingAuth: AuthResponse = await existingLoginResponse.json();

      const createResponse = await fetch(`${apiBaseUrl}/api/hostels`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${existingAuth.accessToken}`,
        },
        body: JSON.stringify({
          name: cleanHostelName,
          address: newHostelAddress.trim() || null,
          phone: newHostelPhone.trim() || null,
          email: newHostelEmail.trim().toLowerCase() || null,
          timezoneName: newHostelTimezone.trim() || "Asia/Kolkata",
        }),
      });

      if (!createResponse.ok) {
        throw new Error(await readError(createResponse));
      }

      const createdHostel: { id: number; name: string } =
        await createResponse.json();

      const newHostelLoginResponse = await fetch(
        `${apiBaseUrl}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            password,
            hostelId: createdHostel.id,
            role: "Admin",
          }),
        }
      );

      if (!newHostelLoginResponse.ok) {
        setHostels(null);
        setNotice(
          `Hostel created (ID ${createdHostel.id}). Find your hostels again and choose it to continue.`
        );
        return;
      }

      const newAuth: AuthResponse = await newHostelLoginResponse.json();

      onLogin({
        ...newAuth,
        user: {
          ...newAuth.user,
          hostelName: createdHostel.name || cleanHostelName,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create hostel.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-brand">
          <HostelIllustration />
          <div className="login-brand-mark" aria-hidden="true">
            H
          </div>
          <h1>Hostel Management</h1>
          <p>Manage your hostel with ease</p>
        </div>

        {hostels === null ? (
          <form className="login-form" onSubmit={findHostels}>
            <div
              className="account-type-switch"
              role="tablist"
              aria-label="Account type"
            >
              {(["Admin", "Tenant"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  role="tab"
                  aria-selected={accountType === type}
                  className={accountType === type ? "selected" : ""}
                  onClick={() => {
                    setAccountType(type);
                    setError("");
                  }}
                >
                  {type}
                </button>
              ))}
            </div>

            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
              />
            </label>

            <div className="login-options">
              <label className="remember-option">
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={(event) =>
                    setRememberEmail(event.target.checked)
                  }
                />
                Remember me
              </label>

              <button
                className="text-button"
                type="button"
                onClick={() =>
                  setNotice(
                    "Please contact your hostel administrator to reset your password."
                  )
                }
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="login-notice" role="status">
                {notice}
              </p>
            )}

            <button
              className="primary-button login-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? "Checking account…" : "Login"}
            </button>
            <p className="login-help">Secure access to your hostel account</p>
          </form>
        ) : (
          <section className="hostel-choice">
            <div className="hostel-choice-heading">
              <div>
                <h2>Choose your hostel</h2>
                <p>Signed in as {email}</p>
              </div>
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setHostels(null);
                  setError("");
                }}
                disabled={loading}
              >
                Back
              </button>
            </div>

            {hostels.map((hostel) => (
              <button
                className="hostel-choice-card"
                key={`${hostel.hostelId}-${hostel.role}`}
                type="button"
                disabled={loading}
                onClick={() => void selectHostel(hostel)}
              >
                <span className="hostel-choice-icon" aria-hidden="true">
                  ⌂
                </span>
                <span>
                  <strong>{hostel.hostelName}</strong>
                  <small>{hostel.role}</small>
                </span>
                <span className="hostel-choice-arrow" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}

            {hostels.some(
              (hostel) => hostel.role.toLowerCase() === "admin"
            ) && (
              <div className="hostel-create-section">
                {!isCreateOpen ? (
                  <button
                    className="primary-button login-submit"
                    type="button"
                    onClick={() => {
                      setError("");
                      setNotice("");
                      setIsCreateOpen(true);
                    }}
                    disabled={loading}
                  >
                    + Create a new hostel
                  </button>
                ) : (
                  <form
                    className="hostel-create-form"
                    onSubmit={createHostel}
                  >
                    <h3>Create a hostel</h3>

                    <label>
                      Hostel name
                      <input
                        required
                        minLength={2}
                        maxLength={150}
                        value={newHostelName}
                        onChange={(event) =>
                          setNewHostelName(event.target.value)
                        }
                        placeholder="Example: Green Valley Hostel"
                      />
                    </label>

                    <label>
                      Address
                      <input
                        maxLength={500}
                        value={newHostelAddress}
                        onChange={(event) =>
                          setNewHostelAddress(event.target.value)
                        }
                      />
                    </label>

                    <label>
                      Phone
                      <input
                        type="tel"
                        maxLength={30}
                        value={newHostelPhone}
                        onChange={(event) =>
                          setNewHostelPhone(event.target.value)
                        }
                      />
                    </label>

                    <label>
                      Email
                      <input
                        type="email"
                        maxLength={254}
                        value={newHostelEmail}
                        onChange={(event) =>
                          setNewHostelEmail(event.target.value)
                        }
                      />
                    </label>

                    <label>
                      Timezone
                      <input
                        required
                        maxLength={80}
                        value={newHostelTimezone}
                        onChange={(event) =>
                          setNewHostelTimezone(event.target.value)
                        }
                      />
                    </label>

                    <div className="login-options">
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => setIsCreateOpen(false)}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                      <button
                        className="primary-button"
                        type="submit"
                        disabled={loading || !newHostelName.trim()}
                      >
                        {loading ? "Creating…" : "Create hostel"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="login-notice" role="status">
                {notice}
              </p>
            )}
            {loading && (
              <p className="login-help">Opening your hostel…</p>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
interface HostelSetting {
  settingKey: string;
  value: unknown;
  updatedAt: string;
}

interface HostelSettingsPageProps {
  hostelId: number;
  accessToken: string;
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

export default function HostelSettingsPage({
  hostelId,
  accessToken,
}: HostelSettingsPageProps) {
  const [settings, setSettings] = useState<HostelSetting[]>([]);
  const [settingKey, setSettingKey] = useState("");
  const [valueText, setValueText] = useState("{}");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadSettings() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/settings`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data: HostelSetting[] = await response.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, [hostelId, accessToken]);

  function selectSetting(setting: HostelSetting) {
    setSettingKey(setting.settingKey);
    setValueText(JSON.stringify(setting.value, null, 2));
    setError("");
    setMessage("");
  }

  async function saveSetting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    let parsedValue: unknown;

    try {
      parsedValue = JSON.parse(valueText);
    } catch {
      setError("The setting value must be valid JSON.");
      setSaving(false);
      return;
    }

    const trimmedKey = settingKey.trim();

    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,99}$/.test(trimmedKey)) {
      setError(
        "Key must start with a letter and contain only letters, numbers, _ or -."
      );
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/settings/${encodeURIComponent(trimmedKey)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ value: parsedValue }),
        }
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setMessage(`Setting "${trimmedKey}" saved.`);
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save setting.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSetting(key: string) {
    if (!window.confirm(`Delete setting "${key}"?`)) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/hostels/${hostelId}/settings/${encodeURIComponent(key)}`,
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

      if (settingKey === key) {
        setSettingKey("");
        setValueText("{}");
      }

      setMessage(`Setting "${key}" deleted.`);
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete setting.");
    }
  }

  return (
    <section style={{ marginTop: 32 }}>
      <h2>Hostel settings</h2>
      <p>Values are stored as JSON. Only Admin users can access this screen.</p>

      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
      {message && <p role="status">{message}</p>}

      <form onSubmit={saveSetting}>
        <label>
          Setting key
          <input
            required
            maxLength={100}
            value={settingKey}
            onChange={(event) => setSettingKey(event.target.value)}
            placeholder="billingDefaults"
          />
        </label>

        <label>
          JSON value
          <textarea
            required
            rows={8}
            value={valueText}
            onChange={(event) => setValueText(event.target.value)}
            style={{ display: "block", width: "100%", fontFamily: "monospace" }}
          />
        </label>

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save setting"}
        </button>

        <button
          type="button"
          onClick={() => {
            setSettingKey("");
            setValueText("{}");
            setError("");
            setMessage("");
          }}
        >
          Clear form
        </button>
      </form>

      <h3>Saved settings</h3>

      {loading ? (
        <p>Loading settings...</p>
      ) : settings.length === 0 ? (
        <p>No settings have been saved.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Value</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {settings.map((setting) => (
              <tr key={setting.settingKey}>
                <td>{setting.settingKey}</td>
                <td>
                  <pre style={{ whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(setting.value, null, 2)}
                  </pre>
                </td>
                <td>{new Date(setting.updatedAt).toLocaleString()}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => selectSetting(setting)}
                  >
                    Edit
                  </button>{" "}
                  <button
                    type="button"
                    onClick={() => void deleteSetting(setting.settingKey)}
                  >
                    Delete
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
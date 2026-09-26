import { useState } from "react";
import type { AuthResponse } from "./LoginPage";
import LoginPage from "./LoginPage";
import TenantPortalPage from "./TenantPortalPage";
import DashboardPage, {
  type DashboardDestination,
} from "./DashboardPage";
import BillsPage from "./BillsPage";
import TenantsPage from "./TenantsPage";
import RoomsPage from "./RoomsPage";
import ComplaintsPage from "./ComplaintsPage";
import AttendancePage from "./AttendancePage";
import NotificationsPage from "./NotificationsPage";
import ReportsPage from "./ReportsPage";
import RemindersPage from "./RemindersPage";
import HostelSettingsPage from "./HostelSettingsPage";
import "./hostel.css";
import OverdueAlertsPage from "./OverdueAlertsPage";
import HostelProfilePage from "./HostelProfilePage";
import StaffAccountsPage from "./StaffAccountsPage";

type Page = DashboardDestination | "settings" | "dashboard" | "hostelProfile"| "staffAccounts";

const pages: { id: Page; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "overdue", label: "Overdue Alerts" },
  { id: "bills", label: "Bills" },
  { id: "tenants", label: "Tenants" },
  { id: "rooms", label: "Rooms" },
  { id: "complaints", label: "Complaints" },
  { id: "attendance", label: "Attendance" },
  { id: "notifications", label: "Notifications" },
  { id: "reports", label: "Reports" },
  { id: "reminders", label: "Reminders" },
  { id: "settings", label: "Settings" },
  { id: "hostelProfile", label: "Hostel Profile" },
  { id: "staffAccounts", label: "Staff Accounts" },
  
];

function App() {
  const [auth, setAuth] = useState<AuthResponse | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");

  if (auth === null) {
    return <LoginPage onLogin={setAuth} />;
  }

  const session = auth;

  function signOut() {
    setAuth(null);
    setCurrentPage("dashboard");
  }

  if (session.user.role === "Tenant") {
    return (
      <main style={{ maxWidth: 1200, margin: "32px auto", padding: 24 }}>
        <header>
          <h1>Welcome, {session.user.fullName}</h1>
          <p>Tenant Portal · Hostel {session.user.hostelId}</p>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </header>
        <TenantPortalPage accessToken={session.accessToken} />
      </main>
    );
  }

  function renderPage() {
    const props = {
      hostelId: session.user.hostelId,
      accessToken: session.accessToken,
    };

    switch (currentPage) {
      case "dashboard":
        return (
          <DashboardPage
            {...props}
            onNavigate={(page: DashboardDestination) => setCurrentPage(page)}
          />
        );
      case "bills":
        return <BillsPage {...props} />;
      case "tenants":
        return (
          <TenantsPage
            {...props}
            isAdmin={session.user.role === "Admin"}
          />
        );
      case "rooms":
        return <RoomsPage {...props} />;
      case "complaints":
        return <ComplaintsPage {...props} />;
      case "attendance":
        return <AttendancePage {...props} />;
      case "notifications":
        return <NotificationsPage {...props} />;
      case "reports":
        return <ReportsPage {...props} />;
      case "reminders":
        return <RemindersPage {...props} />;
      case "settings":
        return session.user.role === "Admin" ? (
          <HostelSettingsPage {...props} />
        ) : (
          <p>Settings are available to Admin users only.</p>
        );
case "overdue":
  return <OverdueAlertsPage {...props} />;
  case "hostelProfile":
  return (
    <HostelProfilePage
      {...props}
      isAdmin={session.user.role === "Admin"}
    />
  );
  case "staffAccounts":
  return <StaffAccountsPage {...props} />;
    }
  }
const availablePages =
  session.user.role === "Admin"
    ? pages
    : pages.filter(
        (page) =>
          page.id !== "settings" &&
          page.id !== "staffAccounts"
      );

  return (
    <main style={{ maxWidth: 1200, margin: "32px auto", padding: 24 }}>
      <header>
        <h1>Hostel Management</h1>
        <p>
          Welcome, {session.user.fullName} · Hostel {session.user.hostelId} ·{" "}
          {session.user.role}
        </p>
        <button type="button" onClick={signOut}>
          Sign out
        </button>
      </header>

      <nav aria-label="Main navigation">
        {availablePages.map((page) => (
          <button
            key={page.id}
            type="button"
            aria-current={currentPage === page.id ? "page" : undefined}
            onClick={() => setCurrentPage(page.id)}
          >
            {page.label}
          </button>
        ))}
      </nav>

      {renderPage()}
    </main>
  );
}

export default App;
import { createBrowserRouter } from "react-router";
import { Dashboard } from "./pages/Dashboard";
import { Transfer } from "./pages/Transfer";
import { History } from "./pages/History";
import { Wallet } from "./pages/Wallet";
import { Kyc } from "./pages/Kyc";
import { Notifications } from "./pages/Notifications";
import { News } from "./pages/News";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { Admin } from "./pages/Admin";
import { ProtectedLayout } from "./components/ProtectedLayout";
import { AdminGuard } from "./components/AdminGuard";
import { AdminGate } from "./components/AdminGate";
import { Terms } from "./pages/Terms";
import { Privacy } from "./pages/Privacy";
import { Profile } from "./pages/Profile";
import { Landing } from "./pages/Landing";
import { NotFound } from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/landing",
    Component: Landing,
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/register",
    Component: Register,
  },
  {
    path: "/forgot-password",
    Component: ForgotPassword,
  },
  {
    path: "/reset-password",
    Component: ResetPassword,
  },
  {
    path: "/terms",
    Component: Terms,
  },
  {
    path: "/privacy",
    Component: Privacy,
  },
  {
    path: "/admin",
    element: (
      <AdminGuard>
        <AdminGate>
          <Admin />
        </AdminGate>
      </AdminGuard>
    ),
  },
  {
    path: "/",
    Component: ProtectedLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "transfer", Component: Transfer },
      { path: "history", Component: History },
      { path: "wallet", Component: Wallet },
      { path: "profile", Component: Profile },
{ path: "kyc", Component: Kyc }, 
      { path: "notifications", Component: Notifications },
      { path: "news", Component: News },
    ],
  },
    {
    path: "*",
    Component: NotFound,
  },
]);
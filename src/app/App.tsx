import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { WalletProvider } from "./contexts/WalletContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PWAInstallBanner } from "./components/PWAInstallBanner";
import { useOneSignal } from "./hooks/useOneSignal";

function OneSignalBridge() {
  useOneSignal();
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <WalletProvider>
          <OneSignalBridge />
          <RouterProvider router={router} />
          <Toaster />
          <PWAInstallBanner />
        </WalletProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

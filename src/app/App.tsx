import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { WalletProvider } from "./contexts/WalletContext";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PWAInstallBanner } from "./components/PWAInstallBanner";

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
      <CurrencyProvider>
        <WalletProvider>
          <RouterProvider router={router} />
          <Toaster />
          <PWAInstallBanner />
        </WalletProvider>
      </CurrencyProvider>
    </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
// Force rebuild 1794939854

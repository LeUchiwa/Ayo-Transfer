import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { WalletProvider } from "./contexts/WalletContext";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  return (
    /* MARKER-MAKE-KIT-INVOKED */
    <ErrorBoundary>
      <AuthProvider>
        <WalletProvider>
          <RouterProvider router={router} />
          <Toaster />
        </WalletProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
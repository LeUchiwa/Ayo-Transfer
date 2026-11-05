import { Component, type ReactNode } from "react";
import { Button } from "./ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-background">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Oups, quelque chose s'est mal passé
            </h1>
            <p className="text-muted-foreground mb-6">
              Une erreur inattendue est survenue. Vous pouvez recharger la page ou revenir à l'accueil.
            </p>
            {this.state.error && (
              <details className="mb-6 text-left bg-muted/50 rounded-lg p-3">
                <summary className="text-xs text-muted-foreground cursor-pointer">
                  Détails techniques
                </summary>
                <pre className="text-xs mt-2 overflow-auto max-h-32 text-red-600">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={this.handleReload} className="bg-primary hover:bg-primary/90 text-white">
                <RefreshCw className="w-4 h-4 mr-2" />
                Recharger
              </Button>
              <Button variant="outline" onClick={this.handleGoHome}>
                <Home className="w-4 h-4 mr-2" />
                Accueil
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
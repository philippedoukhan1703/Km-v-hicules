import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl">
            <div className="w-14 h-14 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold mb-2">Application Prêt Flotte RTE</h1>
            <p className="text-sm text-slate-300 mb-6">
              Une mise à jour a été effectuée. Cliquez sur le bouton ci-dessous pour actualiser l’affichage en direct.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Actualiser l'application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

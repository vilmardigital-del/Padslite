import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { clearStoredPads } from '../services/storage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public props: Props;
  public state: State = {
    hasError: false,
    error: null,
  };

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    clearStoredPads();
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-100">
                Recuperação do Reprodutor de Pads
              </h2>
              <p className="text-xs text-slate-400">
                Ocorreu uma falha inesperada na interface. Você pode recarregar a página ou restaurar os pads para a configuração original.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-rose-300 text-left overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar Página
              </button>

              <button
                onClick={this.handleReset}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Restaurar Padrões
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

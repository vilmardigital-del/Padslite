import React, { useState } from 'react';
import {
  KeyRound,
  X,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  LogOut
} from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  isAdmin,
  onLogin,
  onLogout,
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim() === '4526') {
      setError(null);
      setPassword('');
      onLogin();
      onClose();
    } else {
      setError('Senha incorreta! Digite a senha para gerenciar os áudios.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-[#081533] border border-blue-500/50 rounded-3xl p-6 shadow-[0_15px_50px_rgba(0,0,0,0.85)] text-white space-y-5 relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-blue-300 hover:text-white hover:bg-blue-900/40 transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-blue-500 to-sky-400 flex items-center justify-center text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] border border-white/20">
            {isAdmin ? <Unlock className="w-5 h-5 text-emerald-300" /> : <Lock className="w-5 h-5 text-white" />}
          </div>
          <div>
            <h3 className="font-extrabold text-white text-base font-mono">
              {isAdmin ? 'ADMINISTRADOR ATIVO' : 'ACESSO DO ADMINISTRADOR'}
            </h3>
            <p className="text-xs text-blue-200/70 font-sans">
              {isAdmin ? 'Você pode adicionar e excluir áudios' : 'Digite a senha para habilitar o botão de adicionar'}
            </p>
          </div>
        </div>

        {isAdmin ? (
          <div className="space-y-4 pt-2">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300 font-sans">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              <span>
                Você está autenticado como <strong>Administrador</strong>. O botão "Adicionar Áudio" e as opções de edição estão liberados neste dispositivo.
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full py-3 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-mono text-xs font-bold flex items-center justify-center gap-2 border border-rose-500/40 transition-all cursor-pointer active:scale-95"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair do Modo Administrador</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-blue-200 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-blue-400" />
                SENHA (4 DÍGITOS)
              </label>
              <input
                id="modal-admin-password"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                autoFocus
                placeholder="••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                className="w-full px-4 py-3 rounded-xl bg-[#061129] border border-blue-500/50 text-white font-mono text-lg tracking-widest text-center focus:outline-none focus:border-blue-400 placeholder:text-blue-300/30 shadow-inner"
              />
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-rose-300 bg-rose-500/15 border border-rose-500/30 p-2.5 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-[#0d224d] hover:bg-[#133068] text-blue-200 font-mono text-xs font-bold border border-blue-500/30 transition-colors"
              >
                Voltar aos Pads
              </button>
              <button
                id="btn-confirm-admin-modal"
                type="submit"
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400 hover:from-blue-500 hover:to-sky-300 text-white font-mono font-black text-xs uppercase shadow-[0_0_15px_rgba(59,130,246,0.5)] border border-white active:scale-95 transition-all cursor-pointer"
              >
                Liberar Acesso
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

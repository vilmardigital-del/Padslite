import React, { useState } from 'react';
import {
  Music,
  ShieldCheck,
  Lock,
  ArrowRight,
  Sparkles,
  Volume2,
  Radio,
  Layers,
  KeyRound,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface WelcomePortalProps {
  onEnterAsUser: () => void;
  onEnterAsAdmin: () => void;
  totalPadsCount: number;
}

export const WelcomePortal: React.FC<WelcomePortalProps> = ({
  onEnterAsUser,
  onEnterAsAdmin,
  totalPadsCount,
}) => {
  const [showAdminInput, setShowAdminInput] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim() === '4526') {
      setError(null);
      onEnterAsAdmin();
    } else {
      setError('Senha incorreta. Apenas o administrador possui a senha de acesso (4526).');
    }
  };

  return (
    <div
      className="min-h-screen text-white flex flex-col justify-between font-sans selection:bg-blue-500 selection:text-white notranslate relative overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 50% 20%, rgba(59, 130, 246, 0.4) 0%, transparent 60%), radial-gradient(circle at 90% 80%, rgba(37, 99, 235, 0.35) 0%, transparent 55%), radial-gradient(circle at 10% 90%, rgba(30, 64, 175, 0.4) 0%, transparent 50%), linear-gradient(135deg, #030712 0%, #061129 30%, #0a1b42 60%, #050d24 100%)',
        backgroundAttachment: 'fixed',
      }}
      translate="no"
    >
      {/* Subtle Ambient Light Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e3a8a10_1px,transparent_1px),linear-gradient(to_bottom,#1e3a8a10_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Top Bar Branding */}
      <header className="relative z-10 w-full max-w-4xl mx-auto px-4 pt-6 sm:pt-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-blue-500 to-sky-300 flex items-center justify-center text-white shadow-[0_0_20px_rgba(59,130,246,0.6)] border border-white/20">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold font-mono tracking-tight text-white uppercase">
              Pads Louvor & Adoração
            </h2>
            <p className="text-[11px] text-blue-200/70 font-mono">
              MINISTÉRIO DE MÚSICA NA IGREJA
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-blue-500/15 text-blue-200 border border-blue-400/30">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            Nuvem Sincronizada
          </span>
        </div>
      </header>

      {/* Main Hero Card */}
      <main className="relative z-10 max-w-xl w-full mx-auto px-4 py-8 sm:py-12 flex-1 flex flex-col justify-center">
        <div className="bg-[#081533]/90 border border-blue-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_12px_45px_rgba(0,0,0,0.7)] backdrop-blur-2xl space-y-6">
          
          {/* Header Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-200 text-xs font-mono font-bold mb-1 shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>APRESENTAÇÕES & CULTOS</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight uppercase">
              Pads de Áudio para Louvor
            </h1>
            <p className="text-xs sm:text-sm text-blue-200/80 leading-relaxed font-sans max-w-md mx-auto">
              Plataforma musical para apresentações na igreja. Use os pads de áudio administrados pelo seu líder de louvor de qualquer celular ou computador.
            </p>
          </div>

          {/* Quick Stats/Features */}
          <div className="grid grid-cols-3 gap-2 py-2 border-y border-blue-500/20 text-center font-mono text-xs">
            <div className="p-2 rounded-xl bg-[#061129]/60 border border-blue-500/20">
              <span className="block text-blue-400 font-black text-base">{totalPadsCount}</span>
              <span className="text-[10px] text-blue-200/70">Áudios no Kit</span>
            </div>
            <div className="p-2 rounded-xl bg-[#061129]/60 border border-blue-500/20">
              <span className="block text-sky-300 font-black text-base">Palco</span>
              <span className="text-[10px] text-blue-200/70">Modo Apresentação</span>
            </div>
            <div className="p-2 rounded-xl bg-[#061129]/60 border border-blue-500/20">
              <span className="block text-emerald-400 font-black text-base">4526</span>
              <span className="text-[10px] text-blue-200/70">Acesso Admin</span>
            </div>
          </div>

          {/* Action 1: CONTINUAR PARA OS PADS (LIVRE PARA USUÁRIOS/MÚSICOS) */}
          <div className="space-y-2.5">
            <button
              id="btn-continue-to-pads"
              type="button"
              onClick={onEnterAsUser}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400 hover:from-blue-500 hover:to-sky-300 text-white font-mono font-black text-sm sm:text-base flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(59,130,246,0.6)] border border-white active:scale-[0.98] transition-all cursor-pointer group"
            >
              <Music className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>CONTINUAR PARA OS PADS</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-[11px] text-center text-blue-200/60 font-sans">
              Acesso livre para instrumentistas e cantores • Sem necessidade de senha
            </p>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-blue-500/25" />
            <span className="absolute bg-[#081533] px-3 text-[10px] font-mono text-blue-300/60 uppercase">
              Gerenciamento
            </span>
          </div>

          {/* Action 2: ÁREA DO ADMINISTRADOR (COM SENHA 4526) */}
          {!showAdminInput ? (
            <button
              id="btn-open-admin-access"
              type="button"
              onClick={() => {
                setShowAdminInput(true);
                setError(null);
              }}
              className="w-full py-3 px-4 rounded-xl bg-[#0d224d]/80 hover:bg-[#133068] border border-blue-500/40 hover:border-blue-400 text-blue-100 font-mono text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              <Lock className="w-4 h-4 text-blue-400" />
              <span>Acesso do Administrador (Adicionar Áudios)</span>
            </button>
          ) : (
            <form onSubmit={handleAdminSubmit} className="space-y-3 p-4 rounded-2xl bg-[#061129] border border-blue-500/50 shadow-inner animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-blue-400" />
                  SENHA DE ADMINISTRADOR
                </label>
                <button
                  type="button"
                  onClick={() => setShowAdminInput(false)}
                  className="text-xs text-blue-300 hover:text-white p-1"
                >
                  Cancelar
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  id="input-admin-password"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  autoFocus
                  placeholder="Digite a senha..."
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#0a1838] border border-blue-500/50 text-white font-mono text-base tracking-widest text-center focus:outline-none focus:border-blue-400 placeholder:text-blue-300/40 placeholder:tracking-normal placeholder:text-xs"
                />
                <button
                  id="btn-submit-admin-password"
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400 text-white font-mono font-black text-xs uppercase shadow-[0_0_15px_rgba(59,130,246,0.5)] border border-white hover:from-blue-500 hover:to-sky-300 active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  Entrar
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-1.5 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 p-2 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <p className="text-[10px] text-blue-300/60 font-sans leading-tight">
                Permite enviar arquivos de áudio do seu celular ou PC e sincronizar com toda a igreja.
              </p>
            </form>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-4xl mx-auto px-4 pb-6 text-center text-[11px] text-blue-200/50 font-mono">
        Pads Louvor & Adoração • Criado para o Ministério de Música da Igreja
      </footer>
    </div>
  );
};

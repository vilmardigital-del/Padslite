import React, { useState } from 'react';
import { Cloud, Check, Copy, HardDrive, RefreshCw, X, Globe, DownloadCloud, AlertTriangle, Trash2 } from 'lucide-react';
import { CloudStorageStats, PadItem } from '../types';

interface CloudStorageInfoProps {
  isOpen: boolean;
  onClose: () => void;
  stats: CloudStorageStats | null;
  pads: PadItem[];
  onResetPads: () => void;
  onRemoveSystemPads?: () => void;
  onClearAll?: () => void;
  isResetting: boolean;
}

export const CloudStorageInfo: React.FC<CloudStorageInfoProps> = ({
  isOpen,
  onClose,
  stats,
  pads,
  onResetPads,
  onRemoveSystemPads,
  onClearAll,
  isResetting,
}) => {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [copiedAppUrl, setCopiedAppUrl] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  if (!isOpen) return null;

  const appPublicUrl = window.location.origin;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(id);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const copyAppPublicLink = () => {
    navigator.clipboard.writeText(appPublicUrl);
    setCopiedAppUrl(true);
    setTimeout(() => setCopiedAppUrl(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-100 text-base">Armazenamento em Nuvem Pública</h2>
              <p className="text-xs text-slate-400">Todos os seus áudios hospedados e prontos para uso público ao vivo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* Status Banner */}
          <div className="p-4 bg-gradient-to-r from-sky-950/40 via-slate-800/60 to-slate-900/60 border border-sky-500/20 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold text-slate-200 text-sm">Servidor em Nuvem Ativo</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                Disponibilidade Pública 24/7
              </span>
            </div>

            <p className="text-slate-300 leading-relaxed">
              Os áudios da lista de pads estão armazenados no servidor web da aplicação, permitindo que qualquer pessoa, músico, equipe de louvor ou transmissão ao vivo acesse e reproduza sem bloqueios.
            </p>

            {/* Quick Public Link */}
            <div className="flex items-center gap-2 bg-slate-950/80 p-2 rounded-lg border border-slate-700/60">
              <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
              <input
                type="text"
                readOnly
                value={appPublicUrl}
                className="bg-transparent text-slate-200 font-mono text-xs w-full focus:outline-none"
              />
              <button
                onClick={copyAppPublicLink}
                className="px-3 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-medium shrink-0 flex items-center gap-1.5 transition-colors"
              >
                {copiedAppUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedAppUrl ? 'Copiado!' : 'Copiar Link'}
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-slate-800/40 border border-slate-700/40 rounded-xl">
              <span className="text-slate-400 block text-[11px]">Total de Pads</span>
              <span className="text-xl font-bold text-slate-100">{stats?.totalPads ?? pads.length}</span>
            </div>
            <div className="p-3 bg-slate-800/40 border border-slate-700/40 rounded-xl">
              <span className="text-slate-400 block text-[11px]">Espaço em Disco</span>
              <span className="text-xl font-bold text-cyan-400">{stats?.totalSizeMb ?? 0} MB</span>
            </div>
            <div className="p-3 bg-slate-800/40 border border-slate-700/40 rounded-xl">
              <span className="text-slate-400 block text-[11px]">Cota de Armazenamento</span>
              <span className="text-xl font-bold text-emerald-400">10 GB</span>
            </div>
          </div>

          {/* List of Public Direct Audio URLs */}
          <div>
            <h3 className="font-semibold text-slate-200 text-sm mb-2 flex items-center justify-between">
              <span>Links Públicos Diretos dos Áudios ({pads.length})</span>
              <span className="text-[11px] text-slate-400 font-normal">Streaming direto via HTTP Range</span>
            </h3>

            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
              {pads.map((p) => {
                const directUrl = `${appPublicUrl}${p.url}`;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-[11px]"
                  >
                    <div className="truncate pr-2 max-w-[70%]">
                      <span className="font-medium text-slate-200">{p.name}</span>
                      <span className="block text-slate-500 font-mono truncate">{p.url}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(directUrl, p.id)}
                      className="px-2 py-1 rounded bg-slate-700/70 hover:bg-slate-700 text-slate-300 flex items-center gap-1 shrink-0 transition-colors"
                    >
                      {copiedUrl === p.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedUrl === p.id ? 'Copiado' : 'Link Direto'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Management & Reset Section */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            {/* Remove System Pads Button (if any system pads exist) */}
            {pads.some(p => !p.isCustomUpload) && onRemoveSystemPads && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <div>
                  <h4 className="font-semibold text-rose-300 text-xs">Remover Pads do Sistema</h4>
                  <p className="text-slate-400 text-[11px]">Remove todos os 22 pads pré-carregados mantendo apenas seus áudios</p>
                </div>
                <button
                  onClick={() => {
                    onRemoveSystemPads();
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remover Sistema
                </button>
              </div>
            )}

            {/* Clear All Pads */}
            {pads.length > 0 && onClearAll && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40">
                <div>
                  <h4 className="font-semibold text-slate-200 text-xs">Limpar Toda a Lista de Pads</h4>
                  <p className="text-slate-400 text-[11px]">Esvazia a lista para começar com o repertório totalmente limpo</p>
                </div>
                <button
                  onClick={() => {
                    onClearAll();
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-rose-500/50 hover:bg-rose-500/10 text-slate-300 hover:text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpar Tudo
                </button>
              </div>
            )}

            {/* Optional Factory Restore */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <h4 className="font-semibold text-slate-300 text-xs">Restaurar Kit de Demonstração (22 pads)</h4>
                <p className="text-slate-500 text-[11px]">Recria os pads de exemplo caso queira consultá-los</p>
              </div>
              {!showConfirmReset ? (
                <button
                  onClick={() => setShowConfirmReset(true)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors flex items-center gap-1.5 text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Restaurar Exemplo
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowConfirmReset(false)}
                    className="px-2.5 py-1 text-slate-400 hover:text-white text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      onResetPads();
                      setShowConfirmReset(false);
                    }}
                    disabled={isResetting}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Confirmar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-end bg-slate-950/40">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

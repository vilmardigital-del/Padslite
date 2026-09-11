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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#081533] border border-blue-500/40 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-blue-900/60 bg-[#0c1f4a]/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-sky-400 flex items-center justify-center border border-blue-400/30">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-base">Armazenamento em Nuvem Pública</h2>
              <p className="text-xs text-blue-200/70">Todos os seus áudios hospedados e prontos para uso público ao vivo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-blue-300 hover:text-white hover:bg-blue-900/50 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* Status Banner */}
          <div className="p-4 bg-gradient-to-r from-blue-950/60 via-[#0a1b42] to-blue-950/60 border border-blue-500/30 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold text-white text-sm">Servidor em Nuvem Ativo</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-400/30">
                Disponibilidade Pública 24/7
              </span>
            </div>

            <p className="text-blue-100/90 leading-relaxed">
              Os áudios da lista de pads estão armazenados no servidor web da aplicação, permitindo que qualquer pessoa, músico, equipe de louvor ou transmissão ao vivo acesse e reproduza sem bloqueios.
            </p>

            {/* Quick Public Link */}
            <div className="flex items-center gap-2 bg-[#040c1e] p-2 rounded-lg border border-blue-500/30">
              <Globe className="w-4 h-4 text-sky-400 shrink-0" />
              <input
                type="text"
                readOnly
                value={appPublicUrl}
                className="bg-transparent text-blue-100 font-mono text-xs w-full focus:outline-none"
              />
              <button
                onClick={copyAppPublicLink}
                className="px-3 py-1 rounded bg-blue-500/25 hover:bg-blue-500/40 text-sky-200 font-medium shrink-0 flex items-center gap-1.5 transition-colors border border-blue-400/30 cursor-pointer"
              >
                {copiedAppUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedAppUrl ? 'Copiado!' : 'Copiar Link'}
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-[#061129] border border-blue-500/30 rounded-xl">
              <span className="text-blue-300 block text-[11px]">Total de Pads</span>
              <span className="text-xl font-bold text-white">{stats?.totalPads ?? pads.length}</span>
            </div>
            <div className="p-3 bg-[#061129] border border-blue-500/30 rounded-xl">
              <span className="text-blue-300 block text-[11px]">Espaço em Disco</span>
              <span className="text-xl font-bold text-sky-400">{stats?.totalSizeMb ?? 0} MB</span>
            </div>
            <div className="p-3 bg-[#061129] border border-blue-500/30 rounded-xl">
              <span className="text-blue-300 block text-[11px]">Cota de Armazenamento</span>
              <span className="text-xl font-bold text-emerald-400">10 GB</span>
            </div>
          </div>

          {/* List of Public Direct Audio URLs */}
          <div>
            <h3 className="font-semibold text-white text-sm mb-2 flex items-center justify-between">
              <span>Links Públicos Diretos dos Áudios ({pads.length})</span>
              <span className="text-[11px] text-blue-300/70 font-normal">Streaming direto via HTTP Range</span>
            </h3>

            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
              {pads.map((p) => {
                const directUrl = `${appPublicUrl}${p.url}`;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#061129] border border-blue-500/20 text-[11px]"
                  >
                    <div className="truncate pr-2 max-w-[70%]">
                      <span className="font-medium text-white">{p.name}</span>
                      <span className="block text-blue-300/60 font-mono truncate">{p.url}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(directUrl, p.id)}
                      className="px-2 py-1 rounded bg-blue-900/40 hover:bg-blue-800/60 text-blue-200 flex items-center gap-1 shrink-0 transition-colors border border-blue-500/30 cursor-pointer"
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
          <div className="pt-3 border-t border-blue-900/60 space-y-3">
            {/* Remove System Pads Button (if any system pads exist) */}
            {pads.some(p => !p.isCustomUpload) && onRemoveSystemPads && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <div>
                  <h4 className="font-semibold text-rose-300 text-xs">Remover Pads do Sistema</h4>
                  <p className="text-blue-200/60 text-[11px]">Remove todos os 22 pads pré-carregados mantendo apenas seus áudios</p>
                </div>
                <button
                  onClick={() => {
                    onRemoveSystemPads();
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remover Sistema
                </button>
              </div>
            )}

            {/* Clear All Pads */}
            {pads.length > 0 && onClearAll && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#061129] border border-blue-500/20">
                <div>
                  <h4 className="font-semibold text-white text-xs">Limpar Toda a Lista de Pads</h4>
                  <p className="text-blue-200/60 text-[11px]">Esvazia a lista para começar com o repertório totalmente limpo</p>
                </div>
                <button
                  onClick={() => {
                    onClearAll();
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg border border-blue-500/30 hover:border-rose-500/50 hover:bg-rose-500/10 text-blue-200 hover:text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpar Tudo
                </button>
              </div>
            )}

            {/* Optional Factory Restore */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <h4 className="font-semibold text-blue-200 text-xs">Restaurar Kit de Demonstração (22 pads)</h4>
                <p className="text-blue-300/50 text-[11px]">Recria os pads de exemplo caso queira consultá-los</p>
              </div>
              {!showConfirmReset ? (
                <button
                  onClick={() => setShowConfirmReset(true)}
                  className="px-2.5 py-1.5 rounded-lg border border-blue-500/30 hover:border-blue-400 text-blue-300 hover:text-white hover:bg-blue-900/40 transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Restaurar Exemplo
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowConfirmReset(false)}
                    className="px-2.5 py-1 text-blue-300 hover:text-white text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      onResetPads();
                      setShowConfirmReset(false);
                    }}
                    disabled={isResetting}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs flex items-center gap-1 cursor-pointer"
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
        <div className="p-4 border-t border-blue-900/60 flex items-center justify-end bg-[#061129]">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

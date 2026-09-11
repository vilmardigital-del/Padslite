import React, { useState, useEffect } from 'react';
import { PadItem } from '../types';
import { X, Check, Sliders, Palette } from 'lucide-react';

interface PadEditModalProps {
  pad: PadItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<PadItem>) => void;
}

const PRESET_COLORS = [
  '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd',
  '#0284c7', '#0ea5e9', '#38bdf8', '#06b6d4',
  '#6366f1', '#818cf8', '#4f46e5', '#312e81',
  '#14b8a6', '#2dd4bf', '#0d9488', '#ffffff'
];

export const PadEditModal: React.FC<PadEditModalProps> = ({ pad, isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PadItem['category']>('worship');
  const [musicalKey, setMusicalKey] = useState<string>('');
  const [bpm, setBpm] = useState<string>('');
  const [color, setColor] = useState('#3b82f6');
  const [isLoop, setIsLoop] = useState(true);
  const [fadeInTime, setFadeInTime] = useState(1.0);
  const [fadeOutTime, setFadeOutTime] = useState(2.0);
  const [hotkey, setHotkey] = useState('');

  useEffect(() => {
    if (pad) {
      setName(pad.name || '');
      setCategory(pad.category || 'worship');
      setMusicalKey(pad.musicalKey || '');
      setBpm(pad.bpm ? pad.bpm.toString() : '');
      setColor(pad.color || '#3b82f6');
      setIsLoop(pad.isLoop ?? true);
      setFadeInTime(pad.fadeInTime ?? 1.0);
      setFadeOutTime(pad.fadeOutTime ?? 2.0);
      setHotkey(pad.hotkey || '');
    }
  }, [pad]);

  if (!isOpen || !pad) return null;

  const handleSave = () => {
    onSave(pad.id, {
      name: name.trim() || pad.name,
      category,
      musicalKey: musicalKey.trim() ? musicalKey.trim() : '',
      bpm: bpm.trim() ? parseInt(bpm.trim(), 10) : undefined,
      color,
      isLoop,
      fadeInTime,
      fadeOutTime,
      hotkey: hotkey.trim() ? hotkey.trim().toUpperCase()[0] : '',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#081533] border border-blue-500/40 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-blue-900/60 bg-[#0c1f4a]/90 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full border border-white/60 shadow-sm"
              style={{ backgroundColor: color }}
            />
            <h2 className="font-semibold text-white text-base">Editar Pad: {pad.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-blue-300 hover:text-white hover:bg-blue-900/50 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          <div>
            <label className="block font-medium text-blue-200 mb-1">Nome do Pad</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#061129] border border-blue-500/40 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-blue-200 mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-[#061129] border border-blue-500/40 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
              >
                <option value="worship">Pads Contínuos (Worship)</option>
                <option value="percussao">Percussão & Bateria</option>
                <option value="ritmo">Loops Rítmicos</option>
                <option value="fx">Efeitos (FX)</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-blue-200 mb-1">Tom Musical</label>
              <select
                value={musicalKey}
                onChange={(e) => setMusicalKey(e.target.value)}
                className="w-full bg-[#061129] border border-blue-500/40 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
              >
                <option value="">Nenhum / Rítmico</option>
                {['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B', 'Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm'].map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-blue-200 mb-1">BPM (Andamento)</label>
              <input
                type="number"
                placeholder="Ex: 100"
                value={bpm}
                onChange={(e) => setBpm(e.target.value)}
                className="w-full bg-[#061129] border border-blue-500/40 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block font-medium text-blue-200 mb-1">Tecla de Atalho</label>
              <input
                type="text"
                maxLength={1}
                placeholder="Ex: 1, Q, A..."
                value={hotkey}
                onChange={(e) => setHotkey(e.target.value)}
                className="w-full bg-[#061129] border border-blue-500/40 rounded-xl px-3 py-2 text-sm text-white uppercase font-mono focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-[#0c1f4a]/50 rounded-xl border border-blue-500/30">
            <input
              type="checkbox"
              id="pad-loop-checkbox"
              checked={isLoop}
              onChange={(e) => setIsLoop(e.target.checked)}
              className="w-4 h-4 rounded text-blue-500 focus:ring-blue-400 bg-[#061129] border-blue-500/40 cursor-pointer"
            />
            <label htmlFor="pad-loop-checkbox" className="text-white cursor-pointer text-xs">
              <span className="font-semibold block">Reprodução em Loop Infinito</span>
              <span className="text-blue-200/70">O áudio repete continuamente até ser pausado ou trocado</span>
            </label>
          </div>

          {/* Fade In / Fade Out */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-blue-200 mb-1">
                Fade In (Entrada): {fadeInTime.toFixed(1)}s
              </label>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={fadeInTime}
                onChange={(e) => setFadeInTime(parseFloat(e.target.value))}
                className="w-full accent-blue-400 h-1.5 bg-blue-950 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <label className="block font-medium text-blue-200 mb-1">
                Fade Out (Saída): {fadeOutTime.toFixed(1)}s
              </label>
              <input
                type="range"
                min="0.1"
                max="6"
                step="0.1"
                value={fadeOutTime}
                onChange={(e) => setFadeOutTime(parseFloat(e.target.value))}
                className="w-full accent-blue-400 h-1.5 bg-blue-950 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block font-medium text-blue-200 mb-2 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-blue-400" />
              Cor do Pad
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-lg transition-transform border border-white/30 cursor-pointer ${
                    color === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#081533]' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-blue-900/60 flex items-center justify-end gap-2.5 bg-[#061129]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-blue-300 hover:text-white rounded-xl hover:bg-blue-900/40 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-sm font-bold rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400 hover:from-blue-500 hover:to-sky-300 text-white flex items-center gap-2 shadow-lg shadow-blue-500/30 border border-white cursor-pointer active:scale-95 transition-all"
          >
            <Check className="w-4 h-4" />
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
};

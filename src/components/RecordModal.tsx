import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, RotateCcw, Check, X, Loader2, Volume2 } from 'lucide-react';
import { saveRecordedAudioPad } from '../services/api';
import { PadItem } from '../types';

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (pad: PadItem) => void;
}

export const RecordModal: React.FC<RecordModalProps> = ({ isOpen, onClose, onSaveSuccess }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const [padName, setPadName] = useState('');
  const [category, setCategory] = useState<'worship' | 'percussao' | 'ritmo' | 'fx' | 'custom'>('custom');
  const [musicalKey, setMusicalKey] = useState('C');
  const [bpm, setBpm] = useState<number | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      cleanup();
    }
  }, [isOpen]);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (previewAudioUrl) {
      URL.revokeObjectURL(previewAudioUrl);
    }
    setRecordedBlob(null);
    setPreviewAudioUrl(null);
    setIsRecording(false);
    setIsPlayingPreview(false);
    setRecordDuration(0);
    setMicError(null);
  };

  if (!isOpen) return null;

  const startRecording = async () => {
    setMicError(null);
    setRecordedBlob(null);
    setPreviewAudioUrl(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setPreviewAudioUrl(url);

        // Stop mic tracks to free the mic
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordDuration(0);

      timerRef.current = window.setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      setMicError('Não foi possível acessar o microfone. Verifique as permissões.');
      console.error('Mic error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsRecording(false);
  };

  const togglePreview = () => {
    if (!previewAudioUrl) return;

    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio(previewAudioUrl);
      previewAudioRef.current.onended = () => setIsPlayingPreview(false);
    }

    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  const handleSave = async () => {
    if (!recordedBlob) return;
    const finalName = padName.trim() || `Gravação ao Vivo ${new Date().toLocaleTimeString()}`;
    setIsSaving(true);

    try {
      const pad = await saveRecordedAudioPad(
        finalName,
        recordedBlob,
        category,
        category === 'worship' ? musicalKey : undefined,
        bpm
      );
      onSaveSuccess(pad);
      cleanup();
      onClose();
    } catch (err: any) {
      setMicError(err.message || 'Erro ao salvar na nuvem.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-100 text-base">Gravar Pad no Microfone</h2>
              <p className="text-xs text-slate-400">Grave voz, instrumentos ou efeitos sonoros diretamente</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-center">
          {micError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              {micError}
            </div>
          )}

          {/* Recorder Big Button & Counter */}
          <div className="flex flex-col items-center justify-center py-4">
            <div className="text-3xl font-mono font-bold text-slate-100 mb-4">
              {formatSeconds(recordDuration)}
            </div>

            {!recordedBlob ? (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all ${
                  isRecording
                    ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-500/40'
                    : 'bg-slate-800 text-rose-400 hover:bg-slate-700 hover:scale-105'
                }`}
              >
                {isRecording ? <Square className="w-8 h-8 fill-current" /> : <Mic className="w-8 h-8" />}
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePreview}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  <Volume2 className="w-4 h-4" />
                  {isPlayingPreview ? 'Pausar' : 'Ouvir Prévia'}
                </button>
                <button
                  onClick={startRecording}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  Regravar
                </button>
              </div>
            )}

            <p className="mt-3 text-xs text-slate-400">
              {isRecording
                ? 'Gravando... Toque no botão vermelho para finalizar'
                : recordedBlob
                ? 'Gravação concluída! Dê um nome e salve na nuvem.'
                : 'Toque para iniciar a gravação'}
            </p>
          </div>

          {/* Form details once recorded */}
          {recordedBlob && (
            <div className="text-left space-y-3 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nome do Pad
                </label>
                <input
                  type="text"
                  placeholder="Ex: Pad Ambiente Voz, Violão Dó..."
                  value={padName}
                  onChange={(e) => setPadName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Categoria
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400"
                  >
                    <option value="custom">Personalizado</option>
                    <option value="worship">Worship / Harmonia</option>
                    <option value="percussao">Percussão</option>
                    <option value="ritmo">Ritmo / Beat</option>
                    <option value="fx">Efeitos (FX)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tom Musical
                  </label>
                  <select
                    value={musicalKey}
                    onChange={(e) => setMusicalKey(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400"
                  >
                    {['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2.5 bg-slate-950/40">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!recordedBlob || isSaving}
            className={`px-5 py-2 text-sm font-medium rounded-xl flex items-center gap-2 transition-all ${
              recordedBlob && !isSaving
                ? 'bg-rose-500 hover:bg-rose-400 text-white font-semibold shadow-lg shadow-rose-500/25'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando na Nuvem...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Salvar na Nuvem Pública
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

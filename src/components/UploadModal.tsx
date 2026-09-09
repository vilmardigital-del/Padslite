import React, { useState, useRef } from 'react';
import { UploadCloud, X, FileAudio, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { uploadAudioFiles } from '../services/api';
import { PadItem } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (newPads: PadItem[]) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onUploadSuccess }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const audioFiles: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|weba|flac|aac)$/i.test(file.name)) {
        audioFiles.push(file);
      }
    }
    if (audioFiles.length === 0) {
      setErrorMessage('Por favor, selecione arquivos de áudio válidos (.mp3, .wav, .ogg, .m4a)');
      return;
    }
    setErrorMessage(null);
    setSelectedFiles(prev => [...prev, ...audioFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    setErrorMessage(null);

    try {
      const result = await uploadAudioFiles(selectedFiles);
      onUploadSuccess(result.addedPads);
      setSelectedFiles([]);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao enviar áudios para a nuvem.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-100 text-base">Adicionar Áudios à Nuvem</h2>
              <p className="text-xs text-slate-400">Armazena seus arquivos para reprodução pública e personalizada</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-cyan-400 bg-cyan-500/10'
                : 'border-slate-700 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800/60'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFiles(e.target.files)}
              multiple
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
              className="hidden"
            />
            <UploadCloud className="w-10 h-10 text-cyan-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-200">
              Arraste e solte seus arquivos de áudio aqui (ou clique para selecionar)
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Suporta envio dos 22 arquivos simultaneamente (.MP3, .WAV, .OGG, .M4A)
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Files List */}
          {selectedFiles.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {selectedFiles.length} arquivo(s) selecionado(s)
                </span>
                <button
                  onClick={() => setSelectedFiles([])}
                  className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
                >
                  Limpar todos
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <FileAudio className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="truncate text-slate-200">{file.name}</span>
                      <span className="text-slate-500 shrink-0">
                        ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(idx)}
                      className="p-1 hover:text-rose-400 text-slate-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2.5 bg-slate-950/40">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isUploading || selectedFiles.length === 0}
            className={`px-5 py-2 text-sm font-medium rounded-xl flex items-center gap-2 transition-all ${
              selectedFiles.length > 0 && !isUploading
                ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-lg shadow-cyan-500/25'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando para Nuvem...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Salvar {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''} na Nuvem
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

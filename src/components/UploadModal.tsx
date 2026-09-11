import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, X, FileAudio, CheckCircle2, AlertCircle, Loader2, Sparkles, Clock, Music, Check } from 'lucide-react';
import { uploadAudioFiles, AudioUploadItem } from '../services/api';
import { PadItem } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (newPads: PadItem[]) => void;
  initialCategory?: 'worship' | 'ritmo' | 'percussao';
}

type AudioCategory = 'worship' | 'ritmo' | 'percussao';

interface FileWithMeta {
  id: string;
  file: File;
  category: AudioCategory;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  initialCategory = 'worship'
}) => {
  const [filesList, setFilesList] = useState<FileWithMeta[]>([]);
  const [activeCategory, setActiveCategory] = useState<AudioCategory>(initialCategory);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync initialCategory if changed when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveCategory(initialCategory);
    }
  }, [isOpen, initialCategory]);

  if (!isOpen) return null;

  // Auto-suggest category based on name, fallback to activeCategory
  const detectCategoryFromName = (fileName: string): AudioCategory => {
    const lower = fileName.toLowerCase();
    if (lower.includes('samba') || lower.includes('pagode') || lower.includes('batucada') || lower.includes('percuss') || lower.includes('pandeiro') || lower.includes('surdo')) {
      return 'percussao';
    }
    if (lower.includes('loop') || lower.includes('beat') || lower.includes('drum') || lower.includes('ritmo') || lower.includes('bpm')) {
      return 'ritmo';
    }
    if (lower.includes('pad') || lower.includes('worship') || lower.includes('ambient') || lower.includes('string')) {
      return 'worship';
    }
    return activeCategory;
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const newItems: FileWithMeta[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|weba|flac|aac)$/i.test(file.name)) {
        newItems.push({
          id: `f-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          file,
          category: detectCategoryFromName(file.name),
        });
      }
    }

    if (newItems.length === 0) {
      setErrorMessage('Por favor, selecione arquivos de áudio válidos (.mp3, .wav, .ogg, .m4a)');
      return;
    }

    setErrorMessage(null);
    setFilesList(prev => [...prev, ...newItems]);
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

  const removeFile = (id: string) => {
    setFilesList(prev => prev.filter(f => f.id !== id));
  };

  // Set category for ALL currently selected files
  const handleSelectCategoryForAll = (cat: AudioCategory) => {
    setActiveCategory(cat);
    setFilesList(prev => prev.map(item => ({ ...item, category: cat })));
  };

  // Set category for a single specific file
  const handleSetFileCategory = (id: string, cat: AudioCategory) => {
    setFilesList(prev => prev.map(item => item.id === id ? { ...item, category: cat } : item));
  };

  const handleSubmit = async () => {
    if (filesList.length === 0) return;
    setIsUploading(true);
    setErrorMessage(null);

    try {
      const itemsToUpload: AudioUploadItem[] = filesList.map(item => ({
        file: item.file,
        category: item.category,
      }));

      const result = await uploadAudioFiles(itemsToUpload);
      onUploadSuccess(result.addedPads);
      setFilesList([]);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao enviar áudios para a nuvem.');
    } finally {
      setIsUploading(false);
    }
  };

  const getCategoryTitle = (cat: AudioCategory) => {
    switch (cat) {
      case 'worship': return 'Worship';
      case 'ritmo': return 'Ritmo';
      case 'percussao': return 'Percussão';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#0d1322] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-100 text-sm sm:text-base">Upload de Áudio para Nuvem</h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Selecione os áudios e escolha a categoria correta
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3.5 flex-1">
          {/* 1. Dropzone or Add button */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-5 sm:p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-cyan-400 bg-cyan-500/15'
                : 'border-slate-700/80 bg-slate-900/40 hover:border-cyan-500/50 hover:bg-slate-900/70'
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
            <UploadCloud className="w-8 h-8 sm:w-9 sm:h-9 text-cyan-400 mx-auto mb-2" />
            <p className="text-xs sm:text-sm font-semibold text-slate-200">
              {filesList.length === 0
                ? 'Clique para selecionar os arquivos de áudio ou arraste aqui'
                : 'Clique para adicionar mais arquivos de áudio'}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1">
              Formatos suportados: .MP3, .WAV, .OGG, .M4A
            </p>
          </div>

          {/* 2. PROMPT: ONDE VOCÊ DESEJA COLOCAR ESTE ÁUDIO? */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold flex items-center justify-center">
                  ?
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-100">
                  {filesList.length <= 1
                    ? 'Onde você quer colocar este áudio?'
                    : 'Onde você quer colocar os áudios?'}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Selecione abaixo:
              </span>
            </div>

            {/* 3 Categories Selection Grid */}
            <div className="grid grid-cols-3 gap-2">
              {/* Option 1: Worship */}
              <button
                type="button"
                id="select-cat-worship"
                onClick={() => handleSelectCategoryForAll('worship')}
                className={`p-2.5 rounded-xl border text-left transition-all active:scale-95 cursor-pointer relative flex flex-col justify-between ${
                  activeCategory === 'worship'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-md shadow-amber-500/15 ring-1 ring-amber-500/50'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-amber-500/50 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  {activeCategory === 'worship' && (
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-300">Worship</div>
                  <div className="text-[10px] text-slate-400 leading-tight mt-0.5 hidden xs:block">
                    Pads contínuos & ambiências
                  </div>
                </div>
              </button>

              {/* Option 2: Ritmo */}
              <button
                type="button"
                id="select-cat-ritmo"
                onClick={() => handleSelectCategoryForAll('ritmo')}
                className={`p-2.5 rounded-xl border text-left transition-all active:scale-95 cursor-pointer relative flex flex-col justify-between ${
                  activeCategory === 'ritmo'
                    ? 'bg-sky-500/20 border-sky-500 text-sky-200 shadow-md shadow-sky-500/15 ring-1 ring-sky-500/50'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-sky-500/50 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <Clock className="w-4 h-4 text-sky-400" />
                  {activeCategory === 'ritmo' && (
                    <span className="w-4 h-4 rounded-full bg-sky-500 text-slate-950 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-sky-300">Ritmo</div>
                  <div className="text-[10px] text-slate-400 leading-tight mt-0.5 hidden xs:block">
                    Loops & batidas com BPM
                  </div>
                </div>
              </button>

              {/* Option 3: Percussão */}
              <button
                type="button"
                id="select-cat-percussao"
                onClick={() => handleSelectCategoryForAll('percussao')}
                className={`p-2.5 rounded-xl border text-left transition-all active:scale-95 cursor-pointer relative flex flex-col justify-between ${
                  activeCategory === 'percussao'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 shadow-md shadow-emerald-500/15 ring-1 ring-emerald-500/50'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-emerald-500/50 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <Music className="w-4 h-4 text-emerald-400" />
                  {activeCategory === 'percussao' && (
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-300">Percussão</div>
                  <div className="text-[10px] text-slate-400 leading-tight mt-0.5 hidden xs:block">
                    Samba, batucadas e acústico
                  </div>
                </div>
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 3. List of Selected Files with per-file category selector */}
          {filesList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <FileAudio className="w-3.5 h-3.5 text-cyan-400" />
                  {filesList.length} arquivo(s) preparado(s)
                </span>
                <button
                  type="button"
                  onClick={() => setFilesList([])}
                  className="text-xs text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Limpar todos
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {filesList.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate pr-1">
                        <FileAudio className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="truncate text-slate-200 font-medium">{item.file.name}</span>
                        <span className="text-slate-500 shrink-0 text-[10px]">
                          ({(item.file.size / (1024 * 1024)).toFixed(2)} MB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(item.id)}
                        className="p-1 hover:text-rose-400 text-slate-400 transition-colors cursor-pointer shrink-0"
                        title="Remover arquivo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Per-file category selector pills */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                      <span className="text-[10px] text-slate-400 font-medium">Colocar em:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSetFileCategory(item.id, 'worship')}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                            item.category === 'worship'
                              ? 'bg-amber-500 text-slate-950 font-bold'
                              : 'bg-slate-800 text-amber-300/80 hover:bg-slate-700'
                          }`}
                        >
                          ✨ Worship
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetFileCategory(item.id, 'ritmo')}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                            item.category === 'ritmo'
                              ? 'bg-sky-500 text-slate-950 font-bold'
                              : 'bg-slate-800 text-sky-300/80 hover:bg-slate-700'
                          }`}
                        >
                          ⏱️ Ritmo
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetFileCategory(item.id, 'percussao')}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                            item.category === 'percussao'
                              ? 'bg-emerald-500 text-slate-950 font-bold'
                              : 'bg-slate-800 text-emerald-300/80 hover:bg-slate-700'
                          }`}
                        >
                          🥁 Percussão
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 flex items-center justify-between gap-2.5 bg-slate-950/70">
          <div className="text-[11px] text-slate-400 truncate">
            {filesList.length > 0 ? (
              <span>
                Destino: <strong className="text-slate-200">{getCategoryTitle(activeCategory)}</strong>
              </span>
            ) : (
              <span>Selecione os arquivos de áudio acima</span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              id="btn-confirm-upload"
              onClick={handleSubmit}
              disabled={isUploading || filesList.length === 0}
              className={`px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                filesList.length > 0 && !isUploading
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/25 active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando na Nuvem...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {filesList.length === 0
                      ? 'Adicionar Áudio'
                      : filesList.length === 1
                      ? `Adicionar em ${getCategoryTitle(filesList[0].category)}`
                      : `Adicionar ${filesList.length} Áudios`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

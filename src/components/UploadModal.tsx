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
      <div className="w-full max-w-lg bg-[#081533] border border-blue-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-blue-900/60 flex items-center justify-between bg-[#0c1f4a]/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0 border border-blue-500/40">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm sm:text-base">Upload de Áudio para Nuvem</h2>
              <p className="text-[11px] sm:text-xs text-blue-200/80">
                Selecione os áudios e escolha a categoria correta
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-blue-300/70 hover:text-white hover:bg-blue-900/40 rounded-lg transition-colors cursor-pointer"
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
                ? 'border-blue-400 bg-blue-500/15'
                : 'border-blue-600/50 bg-[#061129]/70 hover:border-blue-400/80 hover:bg-[#091b40]/80'
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
            <UploadCloud className="w-8 h-8 sm:w-9 sm:h-9 text-blue-400 mx-auto mb-2" />
            <p className="text-xs sm:text-sm font-semibold text-white">
              {filesList.length === 0
                ? 'Clique para selecionar os arquivos de áudio ou arraste aqui'
                : 'Clique para adicionar mais arquivos de áudio'}
            </p>
            <p className="text-[10px] sm:text-[11px] text-blue-300/70 mt-1">
              Formatos suportados: .MP3, .WAV, .OGG, .M4A
            </p>
          </div>

          {/* 2. PROMPT: ONDE VOCÊ DESEJA COLOCAR ESTE ÁUDIO? */}
          <div className="bg-[#0b1b3d]/90 border border-blue-500/30 rounded-xl p-3 sm:p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold flex items-center justify-center border border-blue-500/40">
                  ?
                </span>
                <span className="text-xs sm:text-sm font-bold text-white">
                  {filesList.length <= 1
                    ? 'Onde você quer colocar este áudio?'
                    : 'Onde você quer colocar os áudios?'}
                </span>
              </div>
              <span className="text-[11px] text-blue-200/70 font-medium">
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
                    ? 'bg-blue-600/30 border-blue-400 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-400'
                    : 'bg-[#061129] border-blue-900/60 text-blue-200/80 hover:border-blue-500/50 hover:bg-[#0d224d]'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  {activeCategory === 'worship' && (
                    <span className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Worship</div>
                  <div className="text-[10px] text-blue-200/70 leading-tight mt-0.5 hidden xs:block">
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
                    ? 'bg-blue-600/30 border-blue-400 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-400'
                    : 'bg-[#061129] border-blue-900/60 text-blue-200/80 hover:border-blue-500/50 hover:bg-[#0d224d]'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <Clock className="w-4 h-4 text-blue-400" />
                  {activeCategory === 'ritmo' && (
                    <span className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Ritmo</div>
                  <div className="text-[10px] text-blue-200/70 leading-tight mt-0.5 hidden xs:block">
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
                    ? 'bg-sky-600/30 border-sky-400 text-white shadow-md shadow-sky-500/25 ring-1 ring-sky-400'
                    : 'bg-[#061129] border-blue-900/60 text-blue-200/80 hover:border-sky-500/50 hover:bg-[#0d224d]'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <Music className="w-4 h-4 text-sky-300" />
                  {activeCategory === 'percussao' && (
                    <span className="w-4 h-4 rounded-full bg-sky-500 text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Percussão</div>
                  <div className="text-[10px] text-blue-200/70 leading-tight mt-0.5 hidden xs:block">
                    Samba, batucadas e acústico
                  </div>
                </div>
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 3. List of Selected Files with per-file category selector */}
          {filesList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-200 flex items-center gap-1.5">
                  <FileAudio className="w-3.5 h-3.5 text-blue-400" />
                  {filesList.length} arquivo(s) preparado(s)
                </span>
                <button
                  type="button"
                  onClick={() => setFilesList([])}
                  className="text-xs text-blue-300/70 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Limpar todos
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {filesList.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-[#0a1b3f] border border-blue-900/60 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate pr-1">
                        <FileAudio className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="truncate text-white font-medium">{item.file.name}</span>
                        <span className="text-blue-300/60 shrink-0 text-[10px]">
                          ({(item.file.size / (1024 * 1024)).toFixed(2)} MB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(item.id)}
                        className="p-1 hover:text-rose-400 text-blue-300/60 transition-colors cursor-pointer shrink-0"
                        title="Remover arquivo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Per-file category selector pills */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-blue-900/60">
                      <span className="text-[10px] text-blue-200/70 font-medium">Colocar em:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSetFileCategory(item.id, 'worship')}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                            item.category === 'worship'
                              ? 'bg-blue-600 text-white font-bold'
                              : 'bg-[#061129] text-blue-200 hover:bg-[#0d224d]'
                          }`}
                        >
                          ✨ Worship
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetFileCategory(item.id, 'ritmo')}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                            item.category === 'ritmo'
                              ? 'bg-blue-600 text-white font-bold'
                              : 'bg-[#061129] text-blue-200 hover:bg-[#0d224d]'
                          }`}
                        >
                          ⏱️ Ritmo
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetFileCategory(item.id, 'percussao')}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                            item.category === 'percussao'
                              ? 'bg-sky-600 text-white font-bold'
                              : 'bg-[#061129] text-blue-200 hover:bg-[#0d224d]'
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
        <div className="p-3.5 sm:p-4 border-t border-blue-900/60 flex items-center justify-between gap-2.5 bg-[#061129]/95">
          <div className="text-[11px] text-blue-200/80 truncate">
            {filesList.length > 0 ? (
              <span>
                Destino: <strong className="text-white">{getCategoryTitle(activeCategory)}</strong>
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
              className="px-3.5 py-2 text-xs sm:text-sm font-medium text-blue-300/80 hover:text-white rounded-xl hover:bg-blue-900/30 transition-colors cursor-pointer"
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
                  ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400 hover:from-blue-500 hover:to-sky-300 text-white font-bold shadow-lg shadow-blue-500/30 border border-white active:scale-95'
                  : 'bg-[#0d224d] text-blue-400/40 cursor-not-allowed'
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

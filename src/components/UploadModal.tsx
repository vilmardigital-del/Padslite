import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  X,
  FileAudio,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Clock,
  Music,
  Check,
  Link2,
  FolderUp
} from 'lucide-react';
import { uploadAudioFiles, AudioUploadItem, createPadFromUrl } from '../services/api';
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
  const [activeTab, setActiveTab] = useState<'file' | 'url'>('file');
  const [filesList, setFilesList] = useState<FileWithMeta[]>([]);
  const [activeCategory, setActiveCategory] = useState<AudioCategory>(initialCategory);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Direct URL state
  const [directUrl, setDirectUrl] = useState('');
  const [urlPadName, setUrlPadName] = useState('');
  const [urlKey, setUrlKey] = useState<string>('');
  const [urlBpm, setUrlBpm] = useState<string>('');

  // Sync initialCategory if changed when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveCategory(initialCategory);
      setErrorMessage(null);
    }
  }, [isOpen, initialCategory]);

  if (!isOpen) return null;

  // Auto-suggest category based on name, fallback to activeCategory
  const detectCategoryFromName = (fileName: string): AudioCategory => {
    const lower = fileName.toLowerCase();
    if (
      lower.includes('samba') ||
      lower.includes('pagode') ||
      lower.includes('batucada') ||
      lower.includes('percuss') ||
      lower.includes('pandeiro') ||
      lower.includes('surdo')
    ) {
      return 'percussao';
    }
    if (
      lower.includes('loop') ||
      lower.includes('beat') ||
      lower.includes('drum') ||
      lower.includes('ritmo') ||
      lower.includes('bpm')
    ) {
      return 'ritmo';
    }
    if (
      lower.includes('pad') ||
      lower.includes('worship') ||
      lower.includes('ambient') ||
      lower.includes('string')
    ) {
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

  const handleFileUploadSubmit = async () => {
    if (filesList.length === 0) return;
    setIsUploading(true);
    setErrorMessage(null);
    setUploadStatus('Salvando áudio no banco de dados...');
    setUploadPercent(10);

    try {
      const itemsToUpload: AudioUploadItem[] = filesList.map(item => ({
        file: item.file,
        category: item.category,
      }));

      const result = await uploadAudioFiles(itemsToUpload, (status, percent) => {
        setUploadStatus(status);
        setUploadPercent(percent);
      });
      onUploadSuccess(result.addedPads);
      setFilesList([]);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao salvar áudios na nuvem.');
    } finally {
      setIsUploading(false);
      setUploadStatus('');
      setUploadPercent(0);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directUrl.trim()) {
      setErrorMessage('Informe a URL direta do áudio (.mp3, .wav, etc.)');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setUploadStatus('Sincronizando link do áudio...');
    setUploadPercent(40);

    try {
      const finalName = urlPadName.trim() || directUrl.split('/').pop()?.split('?')[0] || 'Pad em Nuvem';
      const cleanKey = urlKey.trim() || undefined;
      const cleanBpm = urlBpm ? parseInt(urlBpm, 10) : undefined;

      const createdPad = await createPadFromUrl({
        name: finalName,
        url: directUrl.trim(),
        category: activeCategory,
        musicalKey: cleanKey,
        bpm: cleanBpm,
      });

      onUploadSuccess([createdPad]);
      setDirectUrl('');
      setUrlPadName('');
      setUrlKey('');
      setUrlBpm('');
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao salvar pad via link.');
    } finally {
      setIsUploading(false);
      setUploadStatus('');
      setUploadPercent(0);
    }
  };

  const getCategoryTitle = (cat: AudioCategory) => {
    switch (cat) {
      case 'worship': return 'Worship';
      case 'ritmo': return 'Ritmo';
      case 'percussao': return 'Percussão';
    }
  };

  const musicalKeys = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

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
              <h2 className="font-bold text-white text-sm sm:text-base">Adicionar Áudio para Nuvem</h2>
              <p className="text-[11px] sm:text-xs text-blue-200/80">
                Somente o Administrador (senha 4526) pode adicionar
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

        {/* Tab switch: File upload vs URL Link */}
        <div className="grid grid-cols-2 p-1.5 bg-[#061129] border-b border-blue-900/40 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'file'
                ? 'bg-blue-600 text-white shadow'
                : 'text-blue-300/70 hover:text-white hover:bg-blue-950/50'
            }`}
          >
            <FolderUp className="w-4 h-4" />
            <span>Arquivo do Aparelho</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'url'
                ? 'bg-blue-600 text-white shadow'
                : 'text-blue-300/70 hover:text-white hover:bg-blue-950/50'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>Link / URL de Áudio</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3.5 flex-1">
          {/* Category Selection Prompt */}
          <div className="bg-[#0b1b3d]/90 border border-blue-500/30 rounded-xl p-3 sm:p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold flex items-center justify-center border border-blue-500/40">
                  ?
                </span>
                <span className="text-xs sm:text-sm font-bold text-white">
                  Onde você deseja colocar o áudio?
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
                    Batucada, samba & grooves
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* TAB 1: FILE UPLOAD */}
          {activeTab === 'file' && (
            <>
              {/* Dropzone */}
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

              {/* Selected Files List */}
              {filesList.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-blue-200/80 px-1">
                    <span className="font-semibold">
                      {filesList.length} arquivo(s) selecionado(s):
                    </span>
                    <button
                      type="button"
                      onClick={() => setFilesList([])}
                      className="text-red-400 hover:text-red-300 text-[11px] cursor-pointer"
                    >
                      Limpar todos
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {filesList.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#061129] border border-blue-900/60 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileAudio className="w-4 h-4 text-blue-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate max-w-[170px] sm:max-w-xs">
                              {item.file.name}
                            </p>
                            <span className="text-[10px] text-blue-300/70">
                              {(item.file.size / (1024 * 1024)).toFixed(1)} MB
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Category pill */}
                          <select
                            value={item.category}
                            onChange={(e) => handleSetFileCategory(item.id, e.target.value as AudioCategory)}
                            className="bg-[#0b1f48] border border-blue-500/40 text-blue-200 text-[11px] rounded-lg px-2 py-1 outline-none cursor-pointer"
                          >
                            <option value="worship">Worship</option>
                            <option value="ritmo">Ritmo</option>
                            <option value="percussao">Percussão</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => removeFile(item.id)}
                            className="p-1 text-blue-300/60 hover:text-red-400 transition-colors cursor-pointer"
                            title="Remover"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: DIRECT AUDIO URL */}
          {activeTab === 'url' && (
            <form onSubmit={handleUrlSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-blue-200 mb-1">
                  URL Direta do Áudio (MP3, WAV ou Stream) *
                </label>
                <input
                  type="url"
                  placeholder="https://exemplo.com/audio.mp3 ou link direto"
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  required
                  className="w-full bg-[#061129] border border-blue-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-blue-300/40 outline-none focus:border-blue-400"
                />
                <p className="text-[10px] text-blue-300/70 mt-1">
                  Funciona com links diretos de Dropbox, Google Drive (export=download), Amazon S3 ou servidores CDN.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-blue-200 mb-1">
                    Nome do Pad / Áudio
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Pad Celestial Worship"
                    value={urlPadName}
                    onChange={(e) => setUrlPadName(e.target.value)}
                    className="w-full bg-[#061129] border border-blue-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-blue-300/40 outline-none focus:border-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1">
                    Tom Musical
                  </label>
                  <select
                    value={urlKey}
                    onChange={(e) => setUrlKey(e.target.value)}
                    className="w-full bg-[#061129] border border-blue-500/40 rounded-xl px-2.5 py-2 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="">Sem Tom</option>
                    {musicalKeys.map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-blue-200 mb-1">
                  BPM (Opcional)
                </label>
                <input
                  type="number"
                  placeholder="Ex: 72 ou 100"
                  value={urlBpm}
                  onChange={(e) => setUrlBpm(e.target.value)}
                  className="w-full bg-[#061129] border border-blue-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-blue-300/40 outline-none focus:border-blue-400"
                />
              </div>
            </form>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-500/15 border border-red-500/40 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Aviso</p>
                <p className="text-[11px] text-red-200/90 mt-0.5">{errorMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-red-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Upload Progress Bar when uploading */}
          {isUploading && (
            <div className="bg-[#0b1f48] border border-blue-500/50 rounded-xl p-3.5 space-y-2 animate-pulse">
              <div className="flex items-center justify-between text-xs font-semibold text-blue-200">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                  {uploadStatus || 'Sincronizando áudio permanentemente na nuvem...'}
                </span>
                <span className="text-sky-300 font-mono font-bold">{uploadPercent}%</span>
              </div>
              <div className="w-full h-2 bg-blue-950 rounded-full overflow-hidden border border-blue-800">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-sky-400 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(5, uploadPercent)}%` }}
                />
              </div>
              <p className="text-[10px] text-blue-300/70 text-center">
                Gravando na nuvem global. Ficará disponível para todos os usuários em qualquer aparelho.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-blue-900/60 flex items-center justify-between gap-2.5 bg-[#061129]/95">
          <div className="text-[11px] text-blue-200/80 truncate">
            <span>
              Destino: <strong className="text-white">{getCategoryTitle(activeCategory)}</strong>
            </span>
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

            {activeTab === 'file' ? (
              <button
                type="button"
                id="btn-confirm-upload"
                onClick={handleFileUploadSubmit}
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
                    <span>Salvando...</span>
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
            ) : (
              <button
                type="button"
                id="btn-confirm-url"
                onClick={handleUrlSubmit}
                disabled={isUploading || !directUrl.trim()}
                className={`px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                  directUrl.trim() && !isUploading
                    ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400 hover:from-blue-500 hover:to-sky-300 text-white font-bold shadow-lg shadow-blue-500/30 border border-white active:scale-95'
                    : 'bg-[#0d224d] text-blue-400/40 cursor-not-allowed'
                }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando Link...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Salvar Link na Nuvem</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

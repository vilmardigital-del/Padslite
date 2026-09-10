import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { generateAmbientPadWav, generateRhythmLoopWav } from './server/audioGenerator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Directories
const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'audio');
const dataDir = path.join(process.cwd(), 'data');
const padsFilePath = path.join(dataDir, 'pads.json');

fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

// Configure Multer for audio uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename and preserve extension
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e4);
    cb(null, `${base}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max per file
  fileFilter: (req, file, cb) => {
    // Accept audio formats
    const allowed = /\.(mp3|wav|ogg|m4a|weba|flac|aac)$/i;
    if (file.originalname.match(allowed) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de áudio são permitidos (.mp3, .wav, .ogg, .m4a, etc)'));
    }
  },
});

// Color palettes for pads
const PAD_COLORS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#eab308', '#84cc16', '#10b981', '#06b6d4',
  '#14b8a6', '#0ea5e9', '#64748b', '#d946ef'
];

interface PadRecord {
  id: string;
  name: string;
  category: 'worship' | 'percussao' | 'ritmo' | 'fx' | 'custom';
  musicalKey?: string;
  bpm?: number;
  url: string;
  originalFileName?: string;
  fileSize?: number;
  duration?: number;
  color: string;
  isLoop: boolean;
  volume: number;
  pan: number;
  filterCutoff: number;
  fadeInTime: number;
  fadeOutTime: number;
  isCustomUpload?: boolean;
  cloudStored: boolean;
  createdAt: string;
  hotkey?: string;
}

// 22 Initial default cloud pads: 12 ambient musical pads (C through B) + 10 rhythm & percussion loops
const INITIAL_PADS_META = [
  // 12 Harmonic Ambient Worship Pads (All 12 keys)
  { key: 'C', name: 'Pad C (Dó Maior - Atmosfera)', cat: 'worship', isLoop: true, hotkey: '1' },
  { key: 'C#', name: 'Pad C# (Dó# Maior - Deep)', cat: 'worship', isLoop: true, hotkey: '2' },
  { key: 'D', name: 'Pad D (Ré Maior - Brilho)', cat: 'worship', isLoop: true, hotkey: '3' },
  { key: 'D#', name: 'Pad Eb (Mib Maior - Suave)', cat: 'worship', isLoop: true, hotkey: '4' },
  { key: 'E', name: 'Pad E (Mi Maior - Profundo)', cat: 'worship', isLoop: true, hotkey: '5' },
  { key: 'F', name: 'Pad F (Fá Maior - Caloroso)', cat: 'worship', isLoop: true, hotkey: '6' },
  { key: 'F#', name: 'Pad F# (Fá# Maior - Shimmer)', cat: 'worship', isLoop: true, hotkey: '7' },
  { key: 'G', name: 'Pad G (Sol Maior - Celestial)', cat: 'worship', isLoop: true, hotkey: '8' },
  { key: 'G#', name: 'Pad Ab (Láb Maior - Sereno)', cat: 'worship', isLoop: true, hotkey: '9' },
  { key: 'A', name: 'Pad A (Lá Maior - Aveludado)', cat: 'worship', isLoop: true, hotkey: '0' },
  { key: 'A#', name: 'Pad Bb (Sib Maior - Épico)', cat: 'worship', isLoop: true, hotkey: 'Q' },
  { key: 'B', name: 'Pad B (Si Maior - Espacial)', cat: 'worship', isLoop: true, hotkey: 'W' },

  // 10 Rhythms and Percussion Loops (Samba, Pagode, Batucada, Drums)
  { type: 'samba', name: 'Samba Batucada Completa (100 BPM)', cat: 'ritmo', bpm: 100, isLoop: true, hotkey: 'E' },
  { type: 'pagode', name: 'Pagode Groove & Tantan (92 BPM)', cat: 'ritmo', bpm: 92, isLoop: true, hotkey: 'R' },
  { type: 'pandeiro', name: 'Pandeiro Brasileiro Suingado (96 BPM)', cat: 'percussao', bpm: 96, isLoop: true, hotkey: 'T' },
  { type: 'worship_beat', name: 'Bateria Worship Dinâmica (72 BPM)', cat: 'ritmo', bpm: 72, isLoop: true, hotkey: 'Y' },
  { type: 'worship_beat', name: 'Bateria Pop / Praise (120 BPM)', cat: 'ritmo', bpm: 120, isLoop: true, hotkey: 'U' },
  { type: 'batucada', name: 'Surdo Marcação & Repique (104 BPM)', cat: 'percussao', bpm: 104, isLoop: true, hotkey: 'I' },
  { type: 'percussao', name: 'Shaker & Chocalho Condução (110 BPM)', cat: 'percussao', bpm: 110, isLoop: true, hotkey: 'O' },
  { type: 'samba', name: 'Tamborim & Agogô Virada (108 BPM)', cat: 'percussao', bpm: 108, isLoop: true, hotkey: 'P' },
  { type: 'acoustic', name: 'Bossa Nova Suave (84 BPM)', cat: 'ritmo', bpm: 84, isLoop: true, hotkey: 'A' },
  { type: 'acoustic', name: 'Groove Acústico Lo-Fi (88 BPM)', cat: 'ritmo', bpm: 88, isLoop: true, hotkey: 'S' },
];

function seedDefaultPads(): PadRecord[] {
  console.log('Verifying & seeding 22 default cloud audio pads on server...');
  const pads: PadRecord[] = [];

  INITIAL_PADS_META.forEach((item, index) => {
    const id = `pad-${index + 1}`;
    let filename = '';
    let duration = 6.0;

    if (item.cat === 'worship') {
      const safeKey = item.key!.replace('#', 'sharp');
      filename = `pad_${safeKey.toLowerCase()}.wav`;
      const filePath = path.join(uploadsDir, filename);
      if (!fs.existsSync(filePath)) {
        try {
          const buf = generateAmbientPadWav(item.key!);
          fs.writeFileSync(filePath, buf);
        } catch (e) {
          console.error(`Error generating wav for ${item.key}:`, e);
        }
      }
      duration = 6.0;
    } else {
      filename = `loop_${item.type}_${item.bpm || 100}bpm_${index}.wav`;
      const filePath = path.join(uploadsDir, filename);
      if (!fs.existsSync(filePath)) {
        try {
          const buf = generateRhythmLoopWav(item.type || 'samba', item.bpm || 100);
          fs.writeFileSync(filePath, buf);
        } catch (e) {
          console.error(`Error generating rhythm wav for ${item.name}:`, e);
        }
      }
      const beatDur = 60 / (item.bpm || 100);
      duration = Math.round(beatDur * 8 * 100) / 100;
    }

    const stat = fs.existsSync(path.join(uploadsDir, filename)) ? fs.statSync(path.join(uploadsDir, filename)) : null;

    pads.push({
      id,
      name: item.name,
      category: item.cat as any,
      musicalKey: item.key,
      bpm: item.bpm,
      url: `/uploads/audio/${filename}`,
      originalFileName: filename,
      fileSize: stat ? stat.size : 256000,
      duration,
      color: PAD_COLORS[index % PAD_COLORS.length],
      isLoop: item.isLoop ?? true,
      volume: 0.8,
      pan: 0,
      filterCutoff: 20000,
      fadeInTime: item.cat === 'worship' ? 1.5 : 0.05,
      fadeOutTime: item.cat === 'worship' ? 2.5 : 0.1,
      isCustomUpload: false,
      cloudStored: true,
      createdAt: new Date().toISOString(),
      hotkey: item.hotkey,
    });
  });

  fs.writeFileSync(padsFilePath, JSON.stringify(pads, null, 2), 'utf-8');
  return pads;
}

function getPads(): PadRecord[] {
  if (!fs.existsSync(padsFilePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(padsFilePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch (err) {
    console.error('Error reading pads.json:', err);
    return [];
  }
}

function savePads(pads: PadRecord[]): void {
  try {
    fs.writeFileSync(padsFilePath, JSON.stringify(pads, null, 2), 'utf-8');
    const publicPadsPath = path.join(process.cwd(), 'public', 'pads.json');
    fs.writeFileSync(publicPadsPath, JSON.stringify(pads, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving pads file:', err);
  }
}

// Ensure initial seed
getPads();

// =================== API ROUTES ===================

// Serve uploaded audio files with range/streaming support
app.use('/uploads/audio', express.static(uploadsDir, {
  setHeaders: (res, filePath) => {
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    if (filePath.endsWith('.wav')) res.setHeader('Content-Type', 'audio/wav');
    if (filePath.endsWith('.mp3')) res.setHeader('Content-Type', 'audio/mpeg');
    if (filePath.endsWith('.ogg')) res.setHeader('Content-Type', 'audio/ogg');
    if (filePath.endsWith('.m4a')) res.setHeader('Content-Type', 'audio/mp4');
  }
}));

// GET /api/health - Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// GET /api/pads - Get all cloud pads
app.get('/api/pads', (req, res) => {
  try {
    const pads = getPads();
    res.json({ success: true, count: pads.length, pads });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stats - Cloud storage stats
app.get('/api/stats', (req, res) => {
  try {
    const pads = getPads();
    let totalBytes = 0;
    try {
      const files = fs.readdirSync(uploadsDir);
      for (const f of files) {
        const stat = fs.statSync(path.join(uploadsDir, f));
        if (stat.isFile()) totalBytes += stat.size;
      }
    } catch {
      // fallback
    }

    const totalSizeMb = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;
    const customCount = pads.filter(p => p.isCustomUpload).length;

    res.json({
      success: true,
      totalPads: pads.length,
      totalSizeMb,
      customPadsCount: customCount,
      storageQuotaMb: 10240, // 10 GB available
      cloudStatus: 'online',
      serverTime: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/upload - Upload one or multiple audio files to cloud storage
app.post('/api/upload', upload.array('audioFiles', 50), (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum arquivo de áudio enviado.' });
    }

    const currentPads = getPads();
    const newPads: PadRecord[] = [];

    files.forEach((file, index) => {
      const cleanName = path.parse(file.originalname).name.replace(/[_-]+/g, ' ');
      // Detect key if in name (e.g. "Pad Em", "C#", "Sol")
      const keyMatch = file.originalname.match(/\b([A-G][#b]?m?)\b/i);
      const detectedKey = keyMatch ? keyMatch[1].toUpperCase() : undefined;

      // Detect BPM if in name (e.g. "120bpm", "96 bpm")
      const bpmMatch = file.originalname.match(/(\d{2,3})\s*bpm/i);
      const detectedBpm = bpmMatch ? parseInt(bpmMatch[1], 10) : undefined;

      // Category detection
      let category: PadRecord['category'] = 'custom';
      const lower = file.originalname.toLowerCase();
      if (lower.includes('pad') || lower.includes('worship') || lower.includes('ambient')) {
        category = 'worship';
      } else if (lower.includes('samba') || lower.includes('pagode') || lower.includes('batucada') || lower.includes('percuss')) {
        category = 'percussao';
      } else if (lower.includes('loop') || lower.includes('beat') || lower.includes('drum')) {
        category = 'ritmo';
      }

      const pad: PadRecord = {
        id: `pad-custom-${Date.now()}-${index}`,
        name: cleanName,
        category,
        musicalKey: detectedKey,
        bpm: detectedBpm,
        url: `/uploads/audio/${file.filename}`,
        originalFileName: file.originalname,
        fileSize: file.size,
        duration: 0, // Will be decoded in browser
        color: PAD_COLORS[(currentPads.length + index) % PAD_COLORS.length],
        isLoop: true,
        volume: 0.95,
        pan: 0,
        filterCutoff: 20000,
        fadeInTime: 0,
        fadeOutTime: 0.05,
        isCustomUpload: true,
        cloudStored: true,
        createdAt: new Date().toISOString()
      };

      currentPads.push(pad);
      newPads.push(pad);
    });

    savePads(currentPads);
    res.json({
      success: true,
      message: `${newPads.length} áudio(s) salvo(s) na nuvem com sucesso!`,
      addedPads: newPads,
      totalPads: currentPads.length
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/pads - Create manual pad (e.g., recorded microphone audio)
app.post('/api/pads', (req, res) => {
  try {
    const { name, category, musicalKey, bpm, audioData, duration, isLoop } = req.body;
    if (!name || !audioData) {
      return res.status(400).json({ success: false, error: 'Nome e áudio são obrigatórios' });
    }

    // audioData is base64
    const base64Data = audioData.replace(/^data:audio\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `recording_${Date.now()}.wav`;
    fs.writeFileSync(path.join(uploadsDir, filename), buffer);

    const currentPads = getPads();
    const newPad: PadRecord = {
      id: `pad-rec-${Date.now()}`,
      name,
      category: category || 'custom',
      musicalKey,
      bpm: bpm ? parseInt(bpm, 10) : undefined,
      url: `/uploads/audio/${filename}`,
      originalFileName: filename,
      fileSize: buffer.length,
      duration: duration || 5.0,
      color: PAD_COLORS[currentPads.length % PAD_COLORS.length],
      isLoop: isLoop ?? true,
      volume: 0.9,
      pan: 0,
      filterCutoff: 20000,
      fadeInTime: 0.1,
      fadeOutTime: 0.2,
      isCustomUpload: true,
      cloudStored: true,
      createdAt: new Date().toISOString()
    };

    currentPads.push(newPad);
    savePads(currentPads);

    res.json({ success: true, pad: newPad });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/pads/:id - Update pad settings
app.put('/api/pads/:id', (req, res) => {
  try {
    const { id } = req.params;
    const currentPads = getPads();
    const index = currentPads.findIndex(p => p.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Pad não encontrado' });
    }

    const updated = {
      ...currentPads[index],
      ...req.body,
      id // preserve ID
    };

    if (req.body.musicalKey !== undefined) {
      updated.musicalKey = req.body.musicalKey ? req.body.musicalKey : undefined;
    }
    if (req.body.hotkey !== undefined) {
      updated.hotkey = req.body.hotkey ? req.body.hotkey : undefined;
    }

    currentPads[index] = updated;
    savePads(currentPads);

    res.json({ success: true, pad: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/pads/:id - Remove pad and delete file from cloud
app.delete('/api/pads/:id', (req, res) => {
  try {
    const { id } = req.params;
    let currentPads = getPads();
    const pad = currentPads.find(p => p.id === id);

    if (!pad) {
      return res.status(404).json({ success: false, error: 'Pad não encontrado' });
    }

    // If it's a custom file, optionally delete from disk
    if (pad.isCustomUpload && pad.originalFileName) {
      const filePath = path.join(uploadsDir, path.basename(pad.url));
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('Failed to unlink file:', e);
        }
      }
    }

    currentPads = currentPads.filter(p => p.id !== id);
    savePads(currentPads);

    res.json({ success: true, message: 'Pad excluído com sucesso', remainingCount: currentPads.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/pads/remove-system - Remove all pre-loaded system pads, keeping only custom uploads
app.post('/api/pads/remove-system', (req, res) => {
  try {
    let currentPads = getPads();
    const customOnly = currentPads.filter(p => p.isCustomUpload === true);
    savePads(customOnly);
    res.json({ success: true, message: 'Pads do sistema removidos!', count: customOnly.length, pads: customOnly });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/pads/clear-all - Clear all pads completely
app.post('/api/pads/clear-all', (req, res) => {
  try {
    savePads([]);
    res.json({ success: true, message: 'Todos os pads foram removidos!', count: 0, pads: [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/pads/reset - Restore standard 22 cloud pads (optional factory kit)
app.post('/api/pads/reset', (req, res) => {
  try {
    const pads = seedDefaultPads();
    res.json({ success: true, message: 'Pads resetados para a lista padrão!', count: pads.length, pads });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =================== VITE INTEGRATION ===================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Pads Cloud Audio] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

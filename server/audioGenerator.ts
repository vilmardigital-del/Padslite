import fs from 'fs';
import path from 'path';

// Helper to write a 16-bit Mono PCM WAV buffer
export function createWavBuffer(sampleRate: number, samples: Float32Array): Buffer {
  const byteRate = sampleRate * 2; // 1 channel, 16 bits = 2 bytes
  const blockAlign = 2;
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    // Clamp to -1.0 .. 1.0
    let s = Math.max(-1, Math.min(1, samples[i]));
    const intVal = s < 0 ? s * 32768 : s * 32767;
    buffer.writeInt16LE(Math.round(intVal), offset);
    offset += 2;
  }

  return buffer;
}

// Key frequencies for Ambient Pads
const KEY_FREQS: Record<string, number> = {
  'C': 130.81,
  'C#': 138.59,
  'D': 146.83,
  'D#': 155.56,
  'E': 164.81,
  'F': 174.61,
  'F#': 185.00,
  'G': 196.00,
  'G#': 207.65,
  'A': 220.00,
  'A#': 233.08,
  'B': 246.94
};

// Generate warm ambient worship pad sound (8 seconds, perfectly loopable)
export function generateAmbientPadWav(key: string): Buffer {
  const sampleRate = 44100;
  const duration = 6.0; // 6 seconds loop
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);
  const baseFreq = KEY_FREQS[key] || 196.0; // default G

  // Chord harmonics: Root, 5th, Octave, 9th, 3rd (warm ambient chord)
  const harmonics = [
    { freq: baseFreq, amp: 0.3 },
    { freq: baseFreq * 1.002, amp: 0.25 }, // detune chorusing
    { freq: baseFreq * 0.998, amp: 0.25 },
    { freq: baseFreq * 1.5, amp: 0.2 },    // 5th
    { freq: baseFreq * 2.0, amp: 0.15 },   // 8ve
    { freq: baseFreq * 2.003, amp: 0.12 }, // shimmer
    { freq: baseFreq * 2.5, amp: 0.08 },   // 3rd up
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let val = 0;
    // Slow LFO for gentle sweeping filter
    const lfo = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.3 * t);

    for (const h of harmonics) {
      val += Math.sin(2 * Math.PI * h.freq * t) * h.amp;
    }
    // Soft saturation / warmth
    val = Math.tanh(val * 1.2) * lfo;

    // Smooth envelope at edges to make seamlessly loopable
    const fadeSamples = Math.floor(sampleRate * 0.05);
    let edgeEnv = 1.0;
    if (i < fadeSamples) {
      edgeEnv = i / fadeSamples;
    } else if (i > numSamples - fadeSamples) {
      edgeEnv = (numSamples - i) / fadeSamples;
    }

    samples[i] = val * edgeEnv * 0.7;
  }

  return createWavBuffer(sampleRate, samples);
}

// Generate Rhythm & Percussion Loops (e.g. Samba, Pagode, Pandeiro, Rock/Worship Beat)
export function generateRhythmLoopWav(type: string, bpm: number = 100): Buffer {
  const sampleRate = 44100;
  // 2 bars of 4/4 at BPM
  const beatDuration = 60 / bpm;
  const barDuration = beatDuration * 4;
  const duration = barDuration * 2;
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  // Synthesis helpers for drum sounds
  const addKick = (startSec: number) => {
    const kickLen = Math.floor(sampleRate * 0.35);
    const startIdx = Math.floor(startSec * sampleRate);
    for (let i = 0; i < kickLen && startIdx + i < numSamples; i++) {
      const t = i / sampleRate;
      const freq = 130 * Math.exp(-t * 18);
      const env = Math.exp(-t * 9);
      samples[startIdx + i] += Math.sin(2 * Math.PI * freq * t) * env * 0.6;
    }
  };

  const addSnare = (startSec: number) => {
    const snareLen = Math.floor(sampleRate * 0.25);
    const startIdx = Math.floor(startSec * sampleRate);
    for (let i = 0; i < snareLen && startIdx + i < numSamples; i++) {
      const t = i / sampleRate;
      const tone = Math.sin(2 * Math.PI * 180 * Math.exp(-t * 20) * t) * Math.exp(-t * 15) * 0.4;
      const noise = (Math.random() * 2 - 1) * Math.exp(-t * 12) * 0.35;
      samples[startIdx + i] += (tone + noise) * 0.7;
    }
  };

  const addHihat = (startSec: number, open = false) => {
    const len = Math.floor(sampleRate * (open ? 0.3 : 0.06));
    const startIdx = Math.floor(startSec * sampleRate);
    const decay = open ? 8 : 45;
    for (let i = 0; i < len && startIdx + i < numSamples; i++) {
      const t = i / sampleRate;
      // High pass noise
      const noise = (Math.random() * 2 - 1);
      const env = Math.exp(-t * decay);
      samples[startIdx + i] += noise * env * 0.2;
    }
  };

  const addSurdo = (startSec: number, pitch = 65) => {
    const len = Math.floor(sampleRate * 0.5);
    const startIdx = Math.floor(startSec * sampleRate);
    for (let i = 0; i < len && startIdx + i < numSamples; i++) {
      const t = i / sampleRate;
      const freq = pitch * Math.exp(-t * 6);
      const env = Math.exp(-t * 5);
      samples[startIdx + i] += Math.sin(2 * Math.PI * freq * t) * env * 0.65;
    }
  };

  const addPandeiro = (startSec: number, platinela = true) => {
    const len = Math.floor(sampleRate * 0.12);
    const startIdx = Math.floor(startSec * sampleRate);
    for (let i = 0; i < len && startIdx + i < numSamples; i++) {
      const t = i / sampleRate;
      const jingle = (Math.random() * 2 - 1) * Math.sin(2 * Math.PI * 6500 * t) * Math.exp(-t * 22) * 0.25;
      const thumb = Math.sin(2 * Math.PI * 190 * Math.exp(-t * 25) * t) * Math.exp(-t * 18) * (platinela ? 0.2 : 0.45);
      samples[startIdx + i] += (jingle + thumb) * 0.7;
    }
  };

  const addShaker = (startSec: number) => {
    const len = Math.floor(sampleRate * 0.08);
    const startIdx = Math.floor(startSec * sampleRate);
    for (let i = 0; i < len && startIdx + i < numSamples; i++) {
      const t = i / sampleRate;
      const env = Math.sin(Math.PI * (i / len));
      const noise = (Math.random() * 2 - 1);
      samples[startIdx + i] += noise * env * 0.15;
    }
  };

  const numBeats = 8; // 2 bars of 4 beats

  if (type === 'samba' || type === 'pagode' || type === 'batucada') {
    // Brazilian Samba/Pagode Groove: Surdo on beat 2 and 4, syncopated pandeiro & tamborim
    for (let b = 0; b < numBeats; b++) {
      const t = b * beatDuration;
      // Surdo on beat 2 & 4 with accent
      if (b % 2 === 1) {
        addSurdo(t, 60);
      } else {
        addSurdo(t, 75); // lighter response
      }
      // 16th note subdivisions
      for (let s = 0; s < 4; s++) {
        const subT = t + s * (beatDuration / 4);
        if (s === 0 || s === 2) {
          addPandeiro(subT, true);
        } else {
          addShaker(subT);
        }
      }
    }
    // Add tamborim accents at typical syncopations
    const syncs = [0.375, 0.875, 1.25, 1.75, 2.375, 2.875, 3.25, 3.75];
    for (const sync of syncs) {
      const t = sync * beatDuration;
      if (t < duration) addPandeiro(t, false);
    }
  } else if (type === 'percussao' || type === 'pandeiro') {
    for (let b = 0; b < numBeats; b++) {
      const t = b * beatDuration;
      addPandeiro(t, false); // Thumb
      addPandeiro(t + beatDuration * 0.25, true); // Fingertips
      addPandeiro(t + beatDuration * 0.5, false); // Heel
      addPandeiro(t + beatDuration * 0.75, true); // Fingertips
    }
  } else if (type === 'worship_beat' || type === 'bateria') {
    // Solid pop/worship groove: Kick 1, 3(syncopated), Snare on 2 & 4, 8th note hi-hat
    for (let b = 0; b < numBeats; b++) {
      const t = b * beatDuration;
      if (b % 4 === 0) addKick(t);
      if (b % 4 === 2) {
        addKick(t);
        addKick(t + beatDuration * 0.5); // syncopated kick
      }
      if (b % 4 === 1 || b % 4 === 3) addSnare(t);

      // Hi hats 8ths
      addHihat(t, false);
      addHihat(t + beatDuration * 0.5, b % 4 === 3); // open on end of bar
    }
  } else {
    // Acoustic shaker / rhythmic groove
    for (let b = 0; b < numBeats; b++) {
      const t = b * beatDuration;
      for (let s = 0; s < 4; s++) {
        addShaker(t + s * (beatDuration / 4));
      }
      if (b % 2 === 0) addKick(t);
      if (b % 2 === 1) addSnare(t);
    }
  }

  // Soft master limiting
  for (let i = 0; i < numSamples; i++) {
    samples[i] = Math.tanh(samples[i] * 1.3) * 0.85;
  }

  return createWavBuffer(sampleRate, samples);
}

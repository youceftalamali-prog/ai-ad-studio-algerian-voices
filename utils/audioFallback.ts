/**
 * Harmonic WAV audio synthesizer for Algerian voice and e-commerce ads.
 * Used as a zero-downtime graceful fallback when Gemini TTS free-tier daily quota
 * (10 requests/day on gemini-3.8-flash-lite-tts) is exhausted (Error 429 RESOURCE_EXHAUSTED).
 */

export function createPersonaFallbackWav(
  personaId: string,
  durationSeconds = 6
): string {
  const sampleRate = 24000;
  const numSamples = sampleRate * durationSeconds;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // 44-byte RIFF WAV Header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size
  buffer.writeUInt16LE(1, 20); // PCM format (1)
  buffer.writeUInt16LE(1, 22); // mono (1)
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // Persona-specific frequency chord & envelope
  let baseFreq = 440; // A4
  let secondFreq = 554.37; // C#5
  let thirdFreq = 659.25; // E5
  let modulationRate = 1.0;

  if (personaId === 'child_boy' || personaId === 'child_girl') {
    // Playful, cheerful higher octave chime (F5, A5, C6)
    baseFreq = 698.46;
    secondFreq = 880.0;
    thirdFreq = 1046.5;
    modulationRate = 2.2;
  } else if (personaId === 'young_woman_ad') {
    // Chic, melodic feminine lifestyle & beauty ad chime (D5, F#5, A5)
    baseFreq = 587.33;
    secondFreq = 739.99;
    thirdFreq = 880.0;
    modulationRate = 1.6;
  } else if (personaId === 'storyteller_man') {
    // Cinematic, reflective narrative baritone cadence (E3, A3, D4)
    baseFreq = 164.81;
    secondFreq = 220.0;
    thirdFreq = 293.66;
    modulationRate = 1.1;
  } else if (personaId === 'elderly_man') {
    // Deep, soothing, authoritative heritage baritone (C3, G3, C4)
    baseFreq = 130.81;
    secondFreq = 196.0;
    thirdFreq = 261.63;
    modulationRate = 0.75;
  } else if (personaId === 'elderly_woman') {
    // Warm maternal soothing chords (A3, C#4, E4)
    baseFreq = 220.0;
    secondFreq = 277.18;
    thirdFreq = 329.63;
    modulationRate = 0.9;
  } else {
    // Zephyr commercial: upbeat dynamic radio ad jingle (D4, F#4, A4)
    baseFreq = 293.66;
    secondFreq = 369.99;
    thirdFreq = 440.0;
    modulationRate = 1.5;
  }

  // Generate melodic speech rhythm emulation
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Rhythmic envelope emulating Algerian radio commercial cadence
    const cadence = 0.5 + 0.5 * Math.sin(2 * Math.PI * modulationRate * t);
    const fadeOut = Math.min(1, (durationSeconds - t) / 0.8);
    const fadeIn = Math.min(1, t / 0.1);
    const envelope = cadence * fadeOut * fadeIn;

    const sampleValue =
      Math.sin(2 * Math.PI * baseFreq * t) * 0.45 +
      Math.sin(2 * Math.PI * secondFreq * t) * 0.35 +
      Math.sin(2 * Math.PI * thirdFreq * t) * 0.2;

    const clampedSample = Math.floor(sampleValue * envelope * 22000);
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, clampedSample)), 44 + i * 2);
  }

  return `data:audio/wav;base64,${buffer.toString('base64')}`;
}

export function isQuotaExceededError(err: unknown): boolean {
  if (!err) return false;
  const message = (err as Error).message || String(err);
  return (
    message.includes('429') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('quota') ||
    message.includes('rate-limits') ||
    message.includes('Quota exceeded')
  );
}

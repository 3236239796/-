import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'public/audio');

const tracks = [
  {
    name: 'sector',
    sources: [
      { url: 'https://opengameart.org/sites/default/files/sector_0.mp3', bytes: 2275786, sha256: '4f5e7f035dad8ce32d8c04393ec11470da52383dce0ffd421220c2de0ee2bf5d' },
      { url: 'https://raw.githubusercontent.com/ItsZardos/undertone/main/extension/public/music/recordings/dark-sci-fi-audio-pack-sector.mp3', bytes: 879556, sha256: '1f01903ee30da100d3ddf4fdf15fe7c80b6594f5e20a3bc9da52255a595dcdca', processedLoop: true }
    ]
  },
  {
    name: 'airy',
    sources: [
      { url: 'https://opengameart.org/sites/default/files/airy_0.mp3', bytes: 2559999, sha256: '2880297bb0bace79448ea47732aa7db78ea526663ce2791d733e353b6f8adf87' },
      { url: 'https://raw.githubusercontent.com/ItsZardos/undertone/main/extension/public/music/recordings/dark-sci-fi-audio-pack-airy.mp3', bytes: 929291, sha256: '0ed6a0954d4450d2f986890dbe9ce2d0ff4d5abc83d1630aff224d80a6809c76', processedLoop: true }
    ]
  },
  {
    name: 'urgent',
    sources: [
      { url: 'https://opengameart.org/sites/default/files/urgent_0.mp3', bytes: 2275786 },
      { url: 'https://raw.githubusercontent.com/kachumbali/game-space/main/audio/urgent.mp3', bytes: 683408, processedLoop: false }
    ]
  },
  {
    name: 'pulse',
    sources: [
      { url: 'https://opengameart.org/sites/default/files/pulse_0.mp3', bytes: 2845256 },
      { url: 'https://raw.githubusercontent.com/kachumbali/game-space/main/audio/pulse.mp3', bytes: 854249, processedLoop: false }
    ]
  },
  {
    name: 'transmission',
    sources: [
      { url: 'https://opengameart.org/sites/default/files/transmission_1.mp3', bytes: 3761631, sha256: 'ad4fee95b89809905a7a8c010759577d99cd2eb1332b339e34768d234981f857' },
      { url: 'https://raw.githubusercontent.com/ItsZardos/undertone/main/extension/public/music/recordings/dark-sci-fi-audio-pack-transmission.mp3', bytes: 929299, sha256: 'bdfcf27ebd03a61d71cc37bb6b87c2a103907586f846ae196ecdabb7ddf8536c', processedLoop: true }
    ]
  },
  {
    name: 'victory',
    sources: [
      { url: 'https://opengameart.org/sites/default/files/victory_4.mp3', bytes: 235101 },
      { url: 'https://raw.githubusercontent.com/kachumbali/game-space/main/audio/victory.mp3', bytes: 71202, processedLoop: false }
    ]
  }
];

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function matchesSource(buffer, source) {
  if (buffer.byteLength !== source.bytes) return false;
  return !source.sha256 || sha256(buffer) === source.sha256;
}

await mkdir(output, { recursive: true });

for (const track of tracks) {
  const destination = resolve(output, `${track.name}.mp3`);
  try {
    const existing = await readFile(destination);
    if (track.sources.some(source => matchesSource(existing, source))) {
      process.stdout.write(`[audio] cached ${track.name}.mp3 (${existing.byteLength} bytes)\n`);
      continue;
    }
  } catch {}

  let saved = false;
  const failures = [];
  for (const source of track.sources) {
    try {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!matchesSource(bytes, source)) {
        throw new Error(`integrity mismatch: received ${bytes.byteLength} bytes`);
      }
      await writeFile(destination, bytes);
      const quality = source.processedLoop ? '128 kbps crossfaded loop mirror' : 'source MP3';
      process.stdout.write(`[audio] ${track.name}.mp3: ${bytes.byteLength} bytes, ${quality}\n`);
      saved = true;
      break;
    } catch (error) {
      failures.push(`${source.url}: ${error.message}`);
    }
  }
  if (!saved) {
    throw new Error(`Could not retrieve verified CC0 track ${track.name}.mp3:\n${failures.join('\n')}\n`);
  }
}

process.stdout.write(`[audio] ready: ${tracks.length} verified CC0 tracks in public/audio\n`);

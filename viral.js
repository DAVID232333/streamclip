
import { pipeline, env } from
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

const el = id => document.getElementById(id);

const viralBtn = el("findViral");
const visualBtn = el("analyze");
const cancelBtn = el("cancelAnalysis");
const status = el("analyzeStatus");
const progress = el("progressBar");
const progressText = el("analysisProgress");
const suggestions = el("suggestions");
const keywordsBox = el("keywords");
const player = el("video");

env.allowLocalModels = false;

let model = null;
let running = false;
let cancelled = false;
let activeMedia = null;

// =============================================
// STREAMCLIP SLANG LIBRARY
// =============================================

const slang = [

  // GEN Z + TIKTOK
  "cooked", "I'm cooked", "we're cooked",
  "crash out", "crashing out", "locked in",
  "lock in", "aura", "aura farming",
  "negative aura", "aura points",
  "no cap", "that's cap", "deadass",
  "for real", "fr fr", "lowkey", "highkey",
  "bet", "say less", "tuff", "valid",
  "mid", "washed", "chopped",
  "glazing", "stop glazing",
  "doing too much", "type shi",
  "pmo", "sybau", "unc", "unc status",
  "six seven", "67", "41", "brainrot",
  "skibidi", "delulu", "rizz", "rizzler",
  "gyatt", "fanum tax", "sigma",
  "mogging", "looksmaxxing", "NPC",
  "main character", "side quest",
  "canon event", "lore", "plot armor",
  "rage bait", "let him cook",
  "who let him cook", "we're so back",
  "it's over", "absolute cinema",
  "peak", "generational", "diabolical",
  "insane work", "nasty work", "goated",
  "big W", "big L",

  // STREAMER REACTIONS
  "chat", "yo chat", "W chat", "L chat",
  "chat is this real", "chat am I cooked",
  "clip that", "somebody clip that",
  "run the clip", "ain't no way",
  "no way", "bro what", "bro is crazy",
  "what the hell", "what is happening",
  "nah bro", "nah that's crazy",
  "that's wild", "that's insane",
  "I'm dead", "I'm crying", "I'm weak",
  "I'm done", "I'm out", "on god",
  "on me", "I swear", "you're trolling",
  "stop trolling", "that's embarrassing",
  "I'm losing it", "I'm about to crash out",
  "he's crashing out", "bro fell off",
  "he fell off", "he's finished",
  "it's wraps", "pack it up", "get out",
  "hold on", "wait a minute",
  "wait wait wait", "pause", "ayo",
  "what did he say", "did you see that",
  "did you hear that", "that's a clip",
  "that's going viral", "put that on TikTok",
  "send me that clip", "bro really thought",
  "you can't be serious", "are you serious",

  // GTA + GAMING
  "GTA", "GTA RP", "roleplay", "RDM",
  "VDM", "metagaming", "powergaming",
  "NoPixel", "FiveM", "getting robbed",
  "we got robbed", "pull up", "spin back",
  "run it back", "get in the car",
  "get out the car", "drive drive drive",
  "police chase", "the cops", "twelve",
  "I'm getting chased", "he's shooting",
  "shots fired", "I'm down", "he's down",
  "we got him", "one shot", "one HP",
  "I'm one shot", "he's cheating",
  "he's hacking", "aimbot", "wall hacks",
  "clutch", "1v1", "1v2", "1v3", "1v4",
  "ace", "squad wipe", "team wipe",
  "third party", "camping", "camper",
  "spawn kill", "headshot", "no scope",
  "quick scope", "skill issue",
  "get better", "get good", "GG", "GGs",
  "easy", "free kill", "bot", "bot lobby",
  "sweaty", "tryhard", "rage quit",
  "lagging", "my game crashed",
  "server crashed", "server restart",
  "banned", "perma banned", "admin",
  "report him", "stream sniper",
  "stream sniping",

  // INTERNET REACTIONS
  "caught in 4K", "receipts", "exposed",
  "cancelled", "ratio", "ratioed",
  "no context", "out of context",
  "bro thought", "he's him", "I'm him",
  "built different", "different breed",
  "ate", "ate that", "left no crumbs",
  "it's giving", "slay", "period",
  "periodt", "bffr", "be so for real",
  "side eye", "bombastic side eye",
  "the audacity", "not too much",
  "clock it", "tea", "spill the tea",
  "messy", "I'm screaming",
  "send help", "I can't breathe",
  "I'm wheezing", "this took me out",
  "you can't make this up",
  "this is crazy work", "bro is not real",
  "what are we doing"
];

keywordsBox.value = slang.join(", ");

// =============================================
// HELPERS
// =============================================

function normalize(value) {
  return String(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getKeywords() {
  return [...new Set(
    keywordsBox.value.split(",")
      .map(normalize)
      .filter(Boolean)
  )];
}

function matchesText(text, keywords) {
  const speech = ` ${normalize(text)} `;

  // Prefer longer phrases instead of counting
  // "chat" and "yo chat" as separate events.
  const found = keywords.filter(word =>
    speech.includes(` ${word} `)
  );

  return found.filter(word =>
    !found.some(other =>
      other !== word &&
      (` ${other} `).includes(` ${word} `)
    )
  );
}

const important = [
  "clip that", "somebody clip that",
  "aint no way", "im cooked",
  "crash out", "crashing out",
  "thats a clip", "thats going viral",
  "put that on tiktok", "police chase",
  "shots fired", "squad wipe",
  "team wipe", "rage quit"
].map(normalize);

const lowPriority = [
  "chat", "bet", "gg", "gta",
  "easy", "bot", "cap", "ate"
].map(normalize);

function keywordScore(words) {
  return words.reduce((sum, word) => {
    if (important.includes(word)) return sum + 10;
    if (lowPriority.includes(word)) return sum + 1;
    return sum + 4;
  }, 0);
}

function fmt(time) {
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function setProgress(value, message) {
  const n = Math.max(0, Math.min(100, value));
  progress.value = n;
  progressText.textContent = `Progress: ${Math.round(n)}%`;
  if (message) status.textContent = message;
}

function checkCancel() {
  if (cancelled) {
    throw new Error("Analysis cancelled.");
  }
}

function settings() {
  const mode = el("performanceMode").value;

  if (mode === "high") {
    return { chunk: 30, frame: 1 };
  }

  if (mode === "balanced") {
    return { chunk: 30, frame: 3 };
  }

  return { chunk: 20, frame: 5 };
}

function clipWindow(moment, duration) {
  const length = Number(el("clipLength").value);

  const start = Math.max(
    0,
    Math.min(
      moment - length / 2,
      Math.max(0, duration - length)
    )
  );

  return {
    start,
    end: Math.min(duration, start + length)
  };
}

function addSuggestion(item) {
  const card = document.createElement("div");
  card.className = "suggestion";

  const title = document.createElement("strong");
  title.textContent =
    `${item.type} · Score ${item.score}`;

  const time = document.createElement("p");
  time.textContent =
    `${fmt(item.start)} – ${fmt(item.end)}`;

  const detail = document.createElement("p");
  detail.textContent = item.label;

  const button = document.createElement("button");
  button.textContent = "Select This Clip";

  button.onclick = () => {
    el("start").value = item.start.toFixed(1);
    el("end").value = item.end.toFixed(1);

    el("start").dispatchEvent(new Event("input"));
    player.pause();
    player.currentTime = item.start;
    player.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  };

  card.append(title, time, detail, button);
  suggestions.appendChild(card);
}

function showBest(items) {
  const sorted = [...items].sort(
    (a, b) => b.score - a.score
  );

  const selected = [];

  for (const item of sorted) {
    if (selected.some(other =>
      item.start < other.end &&
      item.end > other.start
    )) continue;

    selected.push(item);

    if (selected.length >= 15) break;
  }

  suggestions.replaceChildren();

  for (const item of selected) {
    addSuggestion(item);
  }

  return selected.length;
}

async function loadModel() {
  if (model) return model;

  status.textContent =
    "Loading Whisper Tiny speech recognition model...";

  model = await pipeline(
    "automatic-speech-recognition",
    "onnx-community/whisper-tiny.en",
    {
      device: "wasm",
      dtype: "q8"
    }
  );

  return model;
}

// =============================================
// MEDIA + FRAME HELPERS
// =============================================

function loadVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const media = document.createElement("video");

    media.preload = "metadata";
    media.playsInline = true;

    const timeout = setTimeout(() => {
      cleanup();
      URL.revokeObjectURL(url);
      reject(new Error("Video metadata timed out."));
    }, 20000);

    function cleanup() {
      clearTimeout(timeout);
      media.onloadedmetadata = null;
      media.onerror = null;
    }

    media.onloadedmetadata = () => {
      cleanup();

      if (!Number.isFinite(media.duration) ||
          media.duration <= 0) {
        URL.revokeObjectURL(url);
        reject(new Error("Invalid video duration."));
        return;
      }

      resolve({ media, url, duration: media.duration });
    };

    media.onerror = () => {
      cleanup();
      URL.revokeObjectURL(url);
      reject(new Error("Cannot decode this video."));
    };

    media.src = url;
    media.load();
  });
}

function seek(media, time) {
  return new Promise((resolve, reject) => {
    if (Math.abs(media.currentTime - time) < 0.03 &&
        media.readyState >= 2) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Frame seek timed out."));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      media.removeEventListener("seeked", done);
      media.removeEventListener("error", fail);
    }

    function done() {
      cleanup();
      resolve();
    }

    function fail() {
      cleanup();
      reject(new Error("Video frame error."));
    }

    media.addEventListener("seeked", done);
    media.addEventListener("error", fail);
    media.currentTime = time;
  });
}

// =============================================
// SCAN VIDEO FRAMES THROUGHOUT THE RECORDING
// =============================================

async function scanFrames(file, from, to) {
  const { media, url, duration } = await loadVideo(file);
  activeMedia = media;
  media.muted = true;

  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 54;

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true
  });

  if (!ctx) {
    URL.revokeObjectURL(url);
    throw new Error("Canvas is unavailable.");
  }

  const results = [];
  let previous = null;

  const baseInterval = settings().frame;

  // Cover the entire video while limiting excessive seeks.
  const interval = Math.max(baseInterval, duration / 600);
  const total = Math.ceil(duration / interval);

  try {
    for (let i = 0; i < total; i++) {
      checkCancel();

      const time = Math.min(
        duration - 0.05,
        i * interval + 0.1
      );

      await seek(media, Math.max(0, time));
      checkCancel();

      ctx.drawImage(media, 0, 0, 96, 54);

      const pixels = ctx.getImageData(
        0, 0, 96, 54
      ).data;

      if (previous) {
        let diff = 0;
        let samples = 0;

        for (let j = 0; j < pixels.length; j += 16) {
          diff += Math.abs(pixels[j] - previous[j]);
          diff += Math.abs(pixels[j + 1] - previous[j + 1]);
          diff += Math.abs(pixels[j + 2] - previous[j + 2]);
          samples += 3;
        }

        results.push({
          moment: time,
          score: diff / Math.max(1, samples)
        });
      }

      previous = new Uint8ClampedArray(pixels);

      const percent = from + (to - from) *
        ((i + 1) / total);

      setProgress(percent, "Scanning video frames...");

      // Give the browser a chance to update its UI.
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return results;

  } finally {
    media.pause();
    media.removeAttribute("src");
    media.load();
    URL.revokeObjectURL(url);
    activeMedia = null;
  }
}

// =============================================
// STREAM AUDIO IN SMALL CHUNKS
// =============================================

// Audio is captured while the recording plays.
// Only one short chunk is retained for transcription.
// This avoids storing hours of raw audio at once.

function combineAudio(chunks) {
  const length = chunks.reduce(
    (sum, chunk) => sum + chunk.length, 0
  );

  const result = new Float32Array(length);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

function resample(audio, sourceRate, targetRate = 16000) {
  if (sourceRate === targetRate) return audio;

  const length = Math.round(
    audio.length * targetRate / sourceRate
  );

  const result = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const position = i * sourceRate / targetRate;
    const left = Math.min(
      audio.length - 1, Math.floor(position)
    );
    const right = Math.min(audio.length - 1, left + 1);
    const fraction = position - left;

    result[i] =
      audio[left] * (1 - fraction) +
      audio[right] * fraction;
  }

  return result;
}

async function scanSpeech(file, onMoment) {
  const recognizer = await loadModel();
  checkCancel();

  const { media, url, duration } = await loadVideo(file);
  activeMedia = media;

  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    URL.revokeObjectURL(url);
    throw new Error("Web Audio is unavailable.");
  }

  const audioContext = new AudioContextClass({
    sampleRate: 16000
  });

  let source;
  let processor;
  let silent;
  let capturing = false;
  let recorded = [];

  try {
    source = audioContext.createMediaElementSource(media);
    processor = audioContext.createScriptProcessor(
      4096, 2, 1
    );

    silent = audioContext.createGain();
    silent.gain.value = 0;

    processor.onaudioprocess = event => {
      if (!capturing) return;

      const buffer = event.inputBuffer;
      const left = buffer.getChannelData(0);
      const right = buffer.numberOfChannels > 1
        ? buffer.getChannelData(1)
        : left;

      const chunk = new Float32Array(left.length);

      for (let i = 0; i < chunk.length; i++) {
        chunk[i] = (left[i] + right[i]) / 2;
      }

      recorded.push(chunk);
    };

    source.connect(processor);
    processor.connect(silent);
    silent.connect(audioContext.destination);

    await audioContext.resume();

    const chunkSize = settings().chunk;
    const keywords = getKeywords();

    for (
      let chunkStart = 0;
      chunkStart < duration;
      chunkStart += chunkSize
    ) {
      checkCancel();

      const chunkEnd = Math.min(
        duration, chunkStart + chunkSize
      );

      recorded = [];

      if (Math.abs(media.currentTime - chunkStart) > 0.15) {
        await seek(media, chunkStart);
      }

      checkCancel();

      capturing = true;

      // Audio capture is real-time, but only the
      // current chunk is stored.
      const playbackDone = new Promise((resolve, reject) => {
        let settled = false;

        const timer = setInterval(() => {
          if (cancelled ||
              media.currentTime >= chunkEnd ||
              media.ended) {
            finish();
          }
        }, 100);

        const timeout = setTimeout(() => {
          finish(new Error("Audio capture timed out."));
        }, (chunkEnd - chunkStart + 15) * 1000);

        function cleanup() {
          clearInterval(timer);
          clearTimeout(timeout);
          media.removeEventListener("ended", ended);
          media.removeEventListener("error", failed);
        }

        function finish(error) {
          if (settled) return;
          settled = true;
          cleanup();
          if (error) reject(error);
          else resolve();
        }

        function ended() { finish(); }
        function failed() {
          finish(new Error("Audio playback failed."));
        }

        media.addEventListener("ended", ended);
        media.addEventListener("error", failed);
      });

      try {
        await media.play();
        await playbackDone;
      } finally {
        capturing = false;
        media.pause();
      }

      checkCancel();

      const rawAudio = combineAudio(recorded);
      recorded = [];

      if (rawAudio.length > 0) {
        const audio = resample(
          rawAudio, audioContext.sampleRate
        );

        setProgress(
          35 + 65 * (chunkStart / duration),
          `Transcribing ${fmt(chunkStart)} – ${fmt(chunkEnd)}...`
        );

        const result = await recognizer(audio, {
          return_timestamps: true
        });

        checkCancel();

        // Whisper timestamps are relative to
        // the current audio chunk.
        const segments = result.chunks?.length
          ? result.chunks
          : [{
              text: result.text || "",
              timestamp: [0, chunkEnd - chunkStart]
            }];

        for (const segment of segments) {
          const found = matchesText(
            segment.text || "", keywords
          );

          if (!found.length) continue;

          const relativeTime = Math.max(
            0, Number(segment.timestamp?.[0]) || 0
          );

          const moment = Math.min(
            duration,
            chunkStart + relativeTime
          );

          onMoment({
            moment,
            score: keywordScore(found),
            type: "Spoken Viral Moment",
            label: `Detected: ${found.join(", ")}`
          });
        }
      }

      setProgress(
        35 + 65 * (chunkEnd / duration),
        `Analyzed ${fmt(chunkEnd)} / ${fmt(duration)}`
      );
    }

  } finally {
    capturing = false;
    media.pause();
    recorded = [];

    if (processor) processor.disconnect();
    if (source) source.disconnect();
    if (silent) silent.disconnect();

    await audioContext.close().catch(() => {});
    media.removeAttribute("src");
    media.load();
    URL.revokeObjectURL(url);
    activeMedia = null;
  }
}

// =============================================
// RANK AND DISPLAY HIGHLIGHTS
// =============================================

function visualSuggestions(frames, duration) {
  const ranked = [...frames].sort(
    (a, b) => b.score - a.score
  );

  // Visual changes have a lower priority than
  // strong spoken reactions.
  return ranked.slice(0, 80).map(frame => ({
    ...clipWindow(frame.moment, duration),
    score: Math.min(8, Math.round(frame.score / 4)),
    type: "Visual Highlight",
    label: "Sudden visual change in gameplay"
  }));
}

function speechSuggestion(item, duration) {
  return {
    ...clipWindow(item.moment, duration),
    score: item.score,
    type: item.type,
    label: item.label
  };
}

// =============================================
// ANALYSIS CONTROLS
// =============================================

cancelBtn.addEventListener("click", () => {
  if (!running) return;

  cancelled = true;
  cancelBtn.disabled = true;
  status.textContent = "Stopping analysis...";

  if (activeMedia) activeMedia.pause();
});

async function runAnalysis(includeSpeech) {
  if (running) return;

  const file = el("file").files[0];

  if (!file) {
    status.textContent = "Upload a video first.";
    return;
  }

  if (!Number.isFinite(player.duration) ||
      player.duration <= 0) {
    status.textContent = "Wait for the video to load.";
    return;
  }

  running = true;
  cancelled = false;

  viralBtn.disabled = true;
  visualBtn.disabled = true;
  cancelBtn.disabled = false;

  suggestions.replaceChildren();
  setProgress(0, "Preparing analysis...");

  const duration = player.duration;
  const candidates = [];

  try {
    if (includeSpeech) {
      // Load the model before scanning frames.
      await loadModel();
      checkCancel();
    }

    const frames = await scanFrames(
      file, 0, includeSpeech ? 35 : 100
    );

    candidates.push(
      ...visualSuggestions(frames, duration)
    );

    if (includeSpeech) {
      await scanSpeech(file, moment => {
        candidates.push(
          speechSuggestion(moment, duration)
        );
      });
    }

    checkCancel();

    const count = showBest(candidates);

    setProgress(
      100,
      count
        ? `Finished! Found ${count} highlight suggestions.`
        : "Analysis finished. No highlights found."
    );

  } catch (error) {
    console.error(error);

    status.textContent = error.message;

  } finally {
    running = false;
    cancelled = false;
    activeMedia = null;

    viralBtn.disabled = false;
    visualBtn.disabled = false;
    cancelBtn.disabled = true;
  }
}

visualBtn.addEventListener("click", () => {
  runAnalysis(false);
});

viralBtn.addEventListener("click", () => {
  runAnalysis(true);
});

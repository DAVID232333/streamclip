
import { pipeline, env } from
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

const viralButton = document.getElementById("findViral");
const keywordsBox = document.getElementById("keywords");
const statusBox = document.getElementById("analyzeStatus");
const suggestions = document.getElementById("suggestions");

const video = document.getElementById("video");
const fileInput = document.getElementById("file");
const startInput = document.getElementById("start");
const endInput = document.getElementById("end");
const clipLengthInput = document.getElementById("clipLength");

env.allowLocalModels = false;

let transcriber = null;
let working = false;

// ==================================================
// STREAMCLIP 2026 SLANG + STREAMER KEYWORD LIBRARY
// ==================================================

const defaultKeywords = [

  // GEN Z + TIKTOK SLANG
  "cooked",
  "I'm cooked",
  "we're cooked",
  "crash out",
  "crashing out",
  "locked in",
  "lock in",
  "aura",
  "aura farming",
  "negative aura",
  "aura points",
  "no cap",
  "that's cap",
  "deadass",
  "fr fr",
  "for real",
  "lowkey",
  "highkey",
  "bet",
  "say less",
  "tuff",
  "that's tuff",
  "valid",
  "mid",
  "washed",
  "chopped",
  "glazing",
  "stop glazing",
  "doing too much",
  "type shi",
  "ts",
  "pmo",
  "sybau",
  "unc",
  "unc status",
  "six seven",
  "six six seven",
  "67",
  "41",
  "brainrot",
  "skibidi",
  "delulu",
  "rizz",
  "rizzler",
  "gyatt",
  "fanum tax",
  "sigma",
  "mogging",
  "looksmaxxing",
  "NPC",
  "main character",
  "side quest",
  "canon event",
  "lore",
  "lore accurate",
  "plot armor",
  "rage bait",
  "engagement farming",
  "let him cook",
  "who let him cook",
  "we're so back",
  "it's over",
  "absolute cinema",
  "peak",
  "cinema",
  "generational",
  "diabolical",
  "insane work",
  "nasty work",
  "elite",
  "goated",
  "goat",
  "big W",
  "big L",

  // STREAMER REACTIONS
  "chat",
  "yo chat",
  "W chat",
  "L chat",
  "chat is this real",
  "chat am I cooked",
  "clip that",
  "somebody clip that",
  "run the clip",
  "ain't no way",
  "no way",
  "bro what",
  "bro is crazy",
  "what the hell",
  "what is happening",
  "nah bro",
  "nah that's crazy",
  "that's wild",
  "that's insane",
  "I'm dead",
  "I'm crying",
  "I'm weak",
  "I'm done",
  "I'm out",
  "I'm not gonna lie",
  "on god",
  "on me",
  "I swear",
  "you can't be serious",
  "are you serious",
  "you're trolling",
  "stop trolling",
  "that's embarrassing",
  "I'm actually losing it",
  "I'm about to crash out",
  "he's crashing out",
  "bro fell off",
  "he fell off",
  "he's finished",
  "it's wraps",
  "pack it up",
  "get out",
  "hold on",
  "wait a minute",
  "wait wait wait",
  "pause",
  "ayo",
  "what did he say",
  "did you see that",
  "did you hear that",
  "that's a clip",
  "that's going viral",
  "put that on TikTok",
  "send me that clip",

  // GTA RP + GAMING
  "GTA",
  "GTA RP",
  "roleplay",
  "RP",
  "RDM",
  "VDM",
  "metagaming",
  "powergaming",
  "no pixel",
  "FiveM",
  "getting robbed",
  "we got robbed",
  "pull up",
  "spin back",
  "run it back",
  "get in the car",
  "get out the car",
  "drive drive drive",
  "police chase",
  "the cops",
  "twelve",
  "I'm getting chased",
  "we're getting chased",
  "he's shooting",
  "shots fired",
  "I'm down",
  "he's down",
  "we got him",
  "one shot",
  "one HP",
  "I'm one shot",
  "he's cheating",
  "he's hacking",
  "aimbot",
  "wall hacks",
  "clutch",
  "1v1",
  "1v2",
  "1v3",
  "1v4",
  "ace",
  "squad wipe",
  "team wipe",
  "third party",
  "camping",
  "camper",
  "spawn kill",
  "headshot",
  "no scope",
  "quick scope",
  "skill issue",
  "get better",
  "get good",
  "GG",
  "GGs",
  "easy",
  "free kill",
  "bot",
  "bot lobby",
  "sweaty",
  "tryhard",
  "rage quit",
  "lagging",
  "my game crashed",
  "server crashed",
  "server restart",
  "banned",
  "perma banned",
  "admin",
  "report him",
  "stream sniper",
  "stream sniping",

  // TIKTOK + INTERNET REACTIONS
  "caught in 4K",
  "receipts",
  "exposed",
  "cancelled",
  "canceled",
  "ratio",
  "ratioed",
  "no context",
  "out of context",
  "bro thought",
  "bro really thought",
  "bro thinks he's him",
  "he's him",
  "I'm him",
  "built different",
  "different breed",
  "understood the assignment",
  "ate",
  "ate that",
  "left no crumbs",
  "it's giving",
  "it's giving nothing",
  "slay",
  "period",
  "periodt",
  "bffr",
  "be so for real",
  "side eye",
  "bombastic side eye",
  "the audacity",
  "not too much",
  "clock it",
  "tea",
  "spill the tea",
  "that's tea",
  "messy",
  "this is messy",
  "I'm screaming",
  "screaming crying",
  "send help",
  "I can't breathe",
  "I'm wheezing",
  "this took me out",
  "you can't make this up",
  "this is crazy work",
  "bro is not real",
  "bro is not a real person",
  "what are we doing",
  "what are we talking about"

];

keywordsBox.value = defaultKeywords.join(", ");

// ==================================================
// TEXT NORMALIZATION + KEYWORD MATCHING
// ==================================================

function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getKeywords() {
  return [...new Set(
    keywordsBox.value
      .split(",")
      .map(normalize)
      .filter(Boolean)
  )];
}

function findMatchingKeywords(spoken, keywords) {
  const normalizedSpeech = ` ${normalize(spoken)} `;

  return keywords.filter(keyword => {
    return normalizedSpeech.includes(` ${keyword} `);
  });
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

// ==================================================
// AUDIO CAPTURE FROM VIDEO
// ==================================================

async function captureAudio(file, maxSeconds = 60) {
  const objectURL = URL.createObjectURL(file);

  const media = document.createElement("video");
  media.src = objectURL;
  media.preload = "auto";

  const context = new AudioContext({
    sampleRate: 16000
  });

  let source;
  let processor;
  let silentOutput;
  let timer;

  try {
    await new Promise((resolve, reject) => {
      media.onloadedmetadata = resolve;
      media.onerror = () =>
        reject(new Error("Unable to load video."));
      media.load();
    });

    const duration = Math.min(
      media.duration,
      maxSeconds
    );

    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Invalid video duration.");
    }

    source = context.createMediaElementSource(media);

    processor = context.createScriptProcessor(
      4096,
      2,
      1
    );

    silentOutput = context.createGain();
    silentOutput.gain.value = 0;

    const recorded = [];

    processor.onaudioprocess = event => {
      const input = event.inputBuffer;
      const left = input.getChannelData(0);

      const right = input.numberOfChannels > 1
        ? input.getChannelData(1)
        : left;

      const mono = new Float32Array(left.length);

      for (let i = 0; i < left.length; i++) {
        mono[i] = (left[i] + right[i]) / 2;
      }

      recorded.push(mono);
    };

    source.connect(processor);
    processor.connect(silentOutput);
    silentOutput.connect(context.destination);

    await context.resume();

    const completed = new Promise((resolve, reject) => {
      let settled = false;

      function finish() {
        if (settled) return;
        settled = true;
        resolve();
      }

      media.onended = finish;

      media.onerror = () => {
        if (settled) return;
        settled = true;
        reject(new Error("Playback failed."));
      };

      timer = setInterval(() => {
        if (media.currentTime >= duration) {
          finish();
        }
      }, 100);
    });

    statusBox.textContent =
      `Capturing the first ${Math.round(duration)} ` +
      "seconds of audio...";

    await media.play();
    await completed;

    media.pause();

    const length = recorded.reduce(
      (sum, chunk) => sum + chunk.length,
      0
    );

    if (!length) {
      throw new Error("No audio captured.");
    }

    const audio = new Float32Array(length);

    let offset = 0;

    for (const chunk of recorded) {
      audio.set(chunk, offset);
      offset += chunk.length;
    }

    return audio;

  } finally {
    clearInterval(timer);
    media.pause();

    if (processor) processor.disconnect();
    if (source) source.disconnect();
    if (silentOutput) silentOutput.disconnect();

    await context.close().catch(() => {});
    URL.revokeObjectURL(objectURL);
  }
}

// ==================================================
// LOAD SPEECH RECOGNITION MODEL
// ==================================================

async function loadModel() {
  if (transcriber) return transcriber;

  statusBox.textContent =
    "Downloading speech recognition model. " +
    "The first download may take several minutes...";

  transcriber = await pipeline(
    "automatic-speech-recognition",
    "onnx-community/whisper-tiny.en",
    {
      device: "wasm",
      dtype: "q8"
    }
  );

  return transcriber;
}

// ==================================================
// VIRAL CLIP PRIORITY
// ==================================================

const highPriority = [
  "clip that",
  "somebody clip that",
  "aint no way",
  "im cooked",
  "crash out",
  "crashing out",
  "chat am i cooked",
  "thats a clip",
  "thats going viral",
  "put that on tiktok",
  "police chase",
  "shots fired",
  "squad wipe",
  "team wipe",
  "rage quit"
].map(normalize);

function scoreKeywords(matches) {
  let score = 0;

  for (const keyword of matches) {
    score += highPriority.includes(keyword) ? 5 : 2;
  }

  return score;
}

// ==================================================
// DISPLAY VIRAL CLIP SUGGESTIONS
// ==================================================

function addSuggestion(start, end, phrases, score) {
  const card = document.createElement("div");
  card.className = "suggestion";

  const title = document.createElement("strong");
  title.textContent =
    `Viral Moment · Score ${score}`;

  const details = document.createElement("p");
  details.textContent =
    `${formatTime(start)} – ${formatTime(end)}`;

  const keywords = document.createElement("p");
  keywords.textContent =
    `Detected: ${phrases.join(", ")}`;

  const selectButton = document.createElement("button");
  selectButton.textContent = "Select This Clip";

  selectButton.addEventListener("click", () => {
    startInput.value = start.toFixed(1);
    endInput.value = end.toFixed(1);

    startInput.dispatchEvent(
      new Event("input", { bubbles: true })
    );

    video.pause();
    video.currentTime = start;
  });

  card.append(
    title,
    details,
    keywords,
    selectButton
  );

  suggestions.appendChild(card);
}

// ==================================================
// FIND VIRAL MOMENTS BUTTON
// ==================================================

viralButton.addEventListener("click", async () => {
  if (working) return;

  const file = fileInput.files[0];

  if (!file) {
    statusBox.textContent = "Upload a video first.";
    return;
  }

  working = true;
  viralButton.disabled = true;

  try {
    const keywords = getKeywords();

    if (!keywords.length) {
      throw new Error("Add at least one keyword.");
    }

    suggestions.replaceChildren();

    const audio = await captureAudio(file, 60);

    const model = await loadModel();

    statusBox.textContent =
      "Recognizing speech and finding viral moments...";

    const result = await model(audio, {
      return_timestamps: true,
      chunk_length_s: 20,
      stride_length_s: 4
    });

    const chunks = result.chunks || [];
    const matches = [];

    for (const chunk of chunks) {
      const matched = findMatchingKeywords(
        chunk.text || "",
        keywords
      );

      if (!matched.length) continue;

      const timestamp = chunk.timestamp || [0, 0];

      const moment = Number(timestamp[0]) || 0;
      const clipLength = Number(clipLengthInput.value);

      const start = Math.max(
        0,
        moment - clipLength / 2
      );

      const end = Math.min(
        video.duration,
        start + clipLength
      );

      if (end <= start) continue;

      matches.push({
        start,
        end,
        phrases: matched,
        score: scoreKeywords(matched)
      });
    }

    // Highest-scoring clips first.
    matches.sort((a, b) => b.score - a.score);

    // Avoid overlapping clips.
    const selected = [];

    for (const match of matches) {
      const overlaps = selected.some(
        item =>
          match.start < item.end &&
          match.end > item.start
      );

      if (!overlaps) {
        selected.push(match);
      }

      if (selected.length >= 10) break;
    }

    for (const match of selected) {
      addSuggestion(
        match.start,
        match.end,
        match.phrases,
        match.score
      );
    }

    statusBox.textContent = selected.length
      ? `Found ${selected.length} viral clip suggestions!`
      : "No matching phrases found in the first minute.";

  } catch (error) {
    console.error(error);

    statusBox.textContent =
      "Viral detection failed: " + error.message;

  } finally {
    working = false;
    viralButton.disabled = false;
  }
});

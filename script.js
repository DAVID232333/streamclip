
"use strict";

const $ = id => document.getElementById(id);

const video = $("video");
const fileInput = $("file");
const startInput = $("start");
const endInput = $("end");

let videoURL = null;
let currentFile = null;
let previewTimer = null;
let previewHandler = null;
let exporting = false;
let platform = "twitch";

function status(id, message) {
  $(id).textContent = message;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function getRange() {
  const start = Number(startInput.value);
  const end = Number(endInput.value);

  if (
    !currentFile ||
    !Number.isFinite(video.duration) ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end <= start ||
    end > video.duration
  ) {
    throw new Error("Choose a valid start and end time.");
  }

  return { start, end };
}

function updateDuration() {
  const start = Number(startInput.value);
  const end = Number(endInput.value);

  if (end > start) {
    status(
      "durationText",
      `Clip length: ${(end - start).toFixed(1)} seconds`
    );
  } else {
    status("durationText", "Choose a valid clip range.");
  }
}

startInput.addEventListener("input", updateDuration);
endInput.addEventListener("input", updateDuration);

function stopPreview() {
  clearInterval(previewTimer);
  previewTimer = null;

  if (previewHandler) {
    video.removeEventListener("timeupdate", previewHandler);
    previewHandler = null;
  }
}

function seekTo(seconds) {
  return new Promise((resolve, reject) => {
    if (!Number.isFinite(video.duration)) {
      reject(new Error("Video metadata is not ready."));
      return;
    }

    const target = Math.max(
      0,
      Math.min(seconds, video.duration)
    );

    if (Math.abs(video.currentTime - target) < 0.05) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Video seek timed out."));
    }, 10000);

    function cleanup() {
      clearTimeout(timeout);
      video.removeEventListener("seeked", finished);
      video.removeEventListener("error", failed);
    }

    function finished() {
      cleanup();
      resolve();
    }

    function failed() {
      cleanup();
      reject(new Error("Could not seek video."));
    }

    video.addEventListener("seeked", finished, { once: true });
    video.addEventListener("error", failed, { once: true });
    video.currentTime = target;
  });
}

// UPLOAD VIDEO

fileInput.addEventListener("change", async event => {
  if (exporting) return;

  const file = event.target.files[0];
  if (!file) return;

  stopPreview();
  video.pause();

  if (videoURL) {
    URL.revokeObjectURL(videoURL);
  }

  currentFile = file;
  videoURL = URL.createObjectURL(file);

  video.src = videoURL;
  video.load();

  status("fileInfo", `Selected: ${file.name}`);
  status("analyzeStatus", "Ready to analyze.");
  status("exportStatus", "");

  $("suggestions").replaceChildren();
});

video.addEventListener("loadedmetadata", () => {
  if (!Number.isFinite(video.duration)) {
    status("fileInfo", "This video has no usable duration.");
    return;
  }

  startInput.value = 0;
  endInput.value = video.duration.toFixed(1);

  updateDuration();

  status(
    "fileInfo",
    `${currentFile.name} · ${formatTime(video.duration)}`
  );
});

// MANUAL CLIPPING

$("setStart").addEventListener("click", () => {
  if (!currentFile || exporting) return;

  startInput.value = video.currentTime.toFixed(1);
  updateDuration();
});

$("setEnd").addEventListener("click", () => {
  if (!currentFile || exporting) return;

  endInput.value = video.currentTime.toFixed(1);
  updateDuration();
});

$("preview").addEventListener("click", async () => {
  if (exporting) return;

  stopPreview();

  try {
    const { start, end } = getRange();

    video.pause();
    await seekTo(start);

    previewHandler = () => {
      if (video.currentTime >= end - 0.05) {
        video.pause();
        stopPreview();
      }
    };

    video.addEventListener("timeupdate", previewHandler);

    previewTimer = setInterval(previewHandler, 100);

    await video.play();
  } catch (error) {
    stopPreview();
    alert(error.message);
  }
});

// AUTOMATIC AUDIO HIGHLIGHT DETECTION

$("analyze").addEventListener("click", async () => {
  if (!currentFile || exporting) {
    status("analyzeStatus", "Upload a video first.");
    return;
  }

  const button = $("analyze");
  button.disabled = true;

  status("analyzeStatus", "Analyzing audio...");
  $("suggestions").replaceChildren();

  let audioContext;

  try {
    audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();

    const buffer = await currentFile.arrayBuffer();

    // Some browsers cannot decode audio directly
    // from MP4 or MOV video containers.
    const audio = await audioContext.decodeAudioData(buffer);

    const samples = audio.getChannelData(0);
    const sampleRate = audio.sampleRate;

    const windowSeconds = 0.5;
    const windowSize = Math.max(
      1,
      Math.floor(sampleRate * windowSeconds)
    );

    const scores = [];

    for (let i = 0; i < samples.length; i += windowSize) {
      let energy = 0;
      let count = 0;

      const limit = Math.min(
        samples.length,
        i + windowSize
      );

      // Sample every fourth audio sample.
      for (let j = i; j < limit; j += 4) {
        energy += samples[j] * samples[j];
        count++;
      }

      const rms = Math.sqrt(energy / Math.max(1, count));

      scores.push({
        time: i / sampleRate,
        score: rms
      });
    }

    scores.sort((a, b) => b.score - a.score);

    const clipLength = Number($("clipLength").value);
    const selected = [];

    for (const item of scores) {
      const start = Math.max(
        0,
        Math.min(
          item.time - clipLength / 2,
          video.duration - clipLength
        )
      );

      const end = Math.min(
        video.duration,
        start + clipLength
      );

      if (
        selected.every(
          clip =>
            end <= clip.start || start >= clip.end
        )
      ) {
        selected.push({
          start,
          end,
          score: item.score
        });
      }

      if (selected.length >= 5) break;
    }

    if (!selected.length) {
      throw new Error("No usable audio highlights found.");
    }

    selected.sort((a, b) => a.start - b.start);

    for (const [index, clip] of selected.entries()) {
      const card = document.createElement("div");
      card.className = "suggestion";

      const heading = document.createElement("strong");
      heading.textContent = `Highlight ${index + 1}`;

      const details = document.createElement("p");
      details.textContent =
        `${formatTime(clip.start)} – ${formatTime(clip.end)}`;

      const button = document.createElement("button");
      button.textContent = "Select This Clip";

      button.addEventListener("click", async () => {
        if (exporting) return;

        stopPreview();
        video.pause();

        startInput.value = clip.start.toFixed(1);
        endInput.value = clip.end.toFixed(1);

        updateDuration();

        try {
          await seekTo(clip.start);
        } catch (error) {
          console.error(error);
        }
      });

      card.append(heading, details, button);
      $("suggestions").appendChild(card);
    }

    status(
      "analyzeStatus",
      `Found ${selected.length} possible highlights.`
    );

  } catch (error) {
    console.error(error);

    status(
      "analyzeStatus",
      "Audio analysis unavailable for this video. " +
      "Try a supported audio file or use manual clipping."
    );
  } finally {
    if (audioContext) {
      await audioContext.close().catch(() => {});
    }

    button.disabled = false;
  }
});

// EXPORT VIDEO AS WEBM

$("export").addEventListener("click", async () => {
  if (exporting) return;

  let range;

  try {
    range = getRange();
  } catch (error) {
    alert(error.message);
    return;
  }

  if (
    typeof video.captureStream !== "function" ||
    typeof MediaRecorder === "undefined"
  ) {
    alert(
      "Your browser does not support this export method. " +
      "Try desktop Chrome or Edge."
    );
    return;
  }

  const mimeTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];

  const mimeType = mimeTypes.find(type =>
    MediaRecorder.isTypeSupported(type)
  );

  if (!mimeType) {
    alert("WebM recording is not supported.");
    return;
  }

  exporting = true;
  $("export").disabled = true;
  $("analyze").disabled = true;

  stopPreview();
  video.pause();

  let recorder;
  let timer;
  let onTimeUpdate;
  let onEnded;
  let stream;

  try {
    await seekTo(range.start);

    stream = video.captureStream();

    const chunks = [];

    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 5000000
    });

    const finished = new Promise((resolve, reject) => {
      recorder.ondataavailable = event => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        reject(new Error("Recording failed."));
      };

      recorder.onstop = () => {
        if (!chunks.length) {
          reject(new Error("No video data was recorded."));
          return;
        }

        resolve(new Blob(chunks, { type: "video/webm" }));
      };
    });

    const stopRecording = () => {
      if (recorder && recorder.state === "recording") {
        recorder.stop();
      }
      video.pause();
    };

    onTimeUpdate = () => {
      if (video.currentTime >= range.end - 0.03) {
        stopRecording();
      }
    };

    onEnded = stopRecording;

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);

    timer = setInterval(onTimeUpdate, 50);

    status(
      "exportStatus",
      "Recording your clip in real time. Keep this tab open."
    );

    recorder.start(250);

    await video.play();

    const blob = await finished;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "StreamClip_Highlight.webm";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 10000);

    status("exportStatus", "Clip downloaded successfully!");

  } catch (error) {
    console.error(error);

    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }

    status("exportStatus", "Export failed: " + error.message);

  } finally {
    clearInterval(timer);

    if (onTimeUpdate) {
      video.removeEventListener("timeupdate", onTimeUpdate);
    }

    if (onEnded) {
      video.removeEventListener("ended", onEnded);
    }

    video.pause();
    exporting = false;

    $("export").disabled = false;
    $("analyze").disabled = false;
  }
});

// TWITCH AND YOUTUBE LIVESTREAM VIEWER

const twitchBtn = $("twitchBtn");
const youtubeBtn = $("youtubeBtn");

function selectPlatform(name) {
  platform = name;

  twitchBtn.className =
    name === "twitch" ? "" : "secondary";

  youtubeBtn.className =
    name === "youtube" ? "" : "secondary";

  status(
    "liveStatus",
    `Selected ${name === "twitch" ? "Twitch" : "YouTube Live"}.`
  );
}

twitchBtn.addEventListener("click", () => {
  selectPlatform("twitch");
});

youtubeBtn.addEventListener("click", () => {
  selectPlatform("youtube");
});

function parseStreamURL(value) {
  const url = new URL(value);

  if (url.protocol !== "https:") {
    throw new Error("Use an HTTPS livestream URL.");
  }

  const host = url.hostname.toLowerCase()
    .replace(/^www\./, "");

  if (platform === "twitch") {
    if (host !== "twitch.tv" && host !== "m.twitch.tv") {
      throw new Error("Enter a valid Twitch URL.");
    }

    const parts = url.pathname.split("/").filter(Boolean);

    if (
      parts.length !== 1 ||
      !/^[a-zA-Z0-9_]{3,25}$/.test(parts[0])
    ) {
      throw new Error("Enter a Twitch channel URL.");
    }

    return {
      type: "twitch",
      id: parts[0]
    };
  }

  if (
    host !== "youtube.com" &&
    host !== "m.youtube.com" &&
    host !== "youtu.be"
  ) {
    throw new Error("Enter a valid YouTube URL.");
  }

  let id = "";

  if (host === "youtu.be") {
    id = url.pathname.split("/").filter(Boolean)[0] || "";
  } else if (url.pathname === "/watch") {
    id = url.searchParams.get("v") || "";
  } else {
    const match = url.pathname.match(
      /^\/(?:live|embed|shorts)\/([a-zA-Z0-9_-]{11})/
    );

    if (match) id = match[1];
  }

  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    throw new Error(
      "Use a YouTube video or live URL with a video ID."
    );
  }

  return {
    type: "youtube",
    id
  };
}

$("loadStream").addEventListener("click", () => {
  const value = $("streamUrl").value.trim();

  if (!value) {
    status("liveStatus", "Paste a livestream URL first.");
    return;
  }

  try {
    const result = parseStreamURL(value);

    const iframe = document.createElement("iframe");

    iframe.title = "StreamClip Livestream Player";
    iframe.allow =
      "autoplay; encrypted-media; picture-in-picture; fullscreen";

    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";

    if (result.type === "twitch") {
      if (
        location.protocol !== "https:" ||
        location.hostname === ""
      ) {
        throw new Error(
          "Twitch embeds require a published HTTPS website."
        );
      }

      const params = new URLSearchParams({
        channel: result.id,
        parent: location.hostname,
        autoplay: "false"
      });

      iframe.src =
        "https://player.twitch.tv/?" + params.toString();

    } else {
      iframe.src =
        `https://www.youtube.com/embed/${result.id}`;
    }

    $("livePlayer").replaceChildren(iframe);

    status(
      "liveStatus",
      "Player loaded. Playback depends on stream availability " +
      "and embedding permissions."
    );

  } catch (error) {
    status("liveStatus", error.message);
  }
});

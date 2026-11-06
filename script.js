
const $ = id => document.getElementById(id);

const video = $("video");
const fileInput = $("file");
const startInput = $("start");
const endInput = $("end");

let videoURL = null;
let previewTimer = null;
let exporting = false;
let platform = "twitch";

// VIDEO UPLOAD
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;

  video.pause();
  clearInterval(previewTimer);

  if (videoURL) URL.revokeObjectURL(videoURL);

  videoURL = URL.createObjectURL(file);
  video.src = videoURL;
  video.load();

  $("fileInfo").textContent =
    `${file.name} · ${(file.size / 1048576).toFixed(1)} MB`;

  $("suggestions").replaceChildren();
  $("analyzeStatus").textContent = "Ready to analyze.";
  $("exportStatus").textContent = "";
  startInput.value = 0;
  endInput.value = 0;
});

video.addEventListener("loadedmetadata", () => {
  endInput.value = Math.min(60, video.duration).toFixed(1);
  updateDuration();
});

function getRange() {
  const start = Number(startInput.value);
  const end = Number(endInput.value);

  if (!Number.isFinite(video.duration)) {
    throw new Error("Upload a playable video first.");
  }

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end <= start ||
    end > video.duration + 0.1
  ) {
    throw new Error("Enter a valid start and end time.");
  }

  return {
    start,
    end: Math.min(end, video.duration)
  };
}

function updateDuration() {
  const duration =
    Number(endInput.value) - Number(startInput.value);

  $("durationText").textContent =
    `Clip length: ${Math.max(0, duration).toFixed(1)} seconds`;
}

startInput.addEventListener("input", updateDuration);
endInput.addEventListener("input", updateDuration);

$("setStart").addEventListener("click", () => {
  startInput.value = video.currentTime.toFixed(1);
  updateDuration();
});

$("setEnd").addEventListener("click", () => {
  endInput.value = video.currentTime.toFixed(1);
  updateDuration();
});

function seekTo(time) {
  return new Promise((resolve, reject) => {
    if (Math.abs(video.currentTime - time) < 0.05) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Video seek timed out."));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", failed);
    }

    function done() {
      cleanup();
      resolve();
    }

    function failed() {
      cleanup();
      reject(new Error("Unable to seek video."));
    }

    video.addEventListener("seeked", done, { once: true });
    video.addEventListener("error", failed, { once: true });
    video.currentTime = time;
  });
}

// PREVIEW
$("preview").addEventListener("click", async () => {
  try {
    const { start, end } = getRange();

    video.pause();
    clearInterval(previewTimer);

    await seekTo(start);
    await video.play();

    previewTimer = setInterval(() => {
      if (video.currentTime >= end) {
        video.pause();
        clearInterval(previewTimer);
      }
    }, 100);

  } catch (error) {
    $("exportStatus").textContent = error.message;
  }
});

// FULLSCREEN
$("fullscreenBtn").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (video.requestFullscreen) {
      await video.requestFullscreen();
    } else if (video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    }
  } catch (error) {
    alert("Fullscreen is unavailable.");
  }
});

// EXPORT WITH MEDIARECORDER
// Recording occurs in real time, including video and audio.
$("export").addEventListener("click", async () => {
  if (exporting) return;

  let recorder;
  let stream;

  try {
    const { start, end } = getRange();

    if (!video.captureStream) {
      throw new Error(
        "Your browser does not support video captureStream."
      );
    }

    if (typeof MediaRecorder === "undefined") {
      throw new Error("MediaRecorder is unsupported.");
    }

    exporting = true;
    $("export").disabled = true;
    $("exportStatus").textContent = "Preparing clip...";

    video.pause();
    clearInterval(previewTimer);

    await seekTo(start);

    stream = video.captureStream();

    const types = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm"
    ];

    const mimeType = types.find(type =>
      MediaRecorder.isTypeSupported(type)
    );

    if (!mimeType) {
      throw new Error("WebM recording is unsupported.");
    }

    recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];

    const finished = new Promise((resolve, reject) => {
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onerror = () =>
        reject(new Error("Recording failed."));

      recorder.onstop = () => resolve();
    });

    recorder.start(1000);
    await video.play();

    $("exportStatus").textContent =
      "Recording clip in real time...";

    await new Promise((resolve, reject) => {
      const timer = setInterval(() => {
        if (video.currentTime >= end || video.ended) {
          clearInterval(timer);
          resolve();
        }

        if (recorder.state === "inactive") {
          clearInterval(timer);
          reject(new Error("Recording stopped early."));
        }
      }, 50);
    });

    video.pause();

    if (recorder.state !== "inactive") recorder.stop();

    await finished;

    const blob = new Blob(chunks, { type: mimeType });

    if (!blob.size) {
      throw new Error("The recorded clip was empty.");
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `streamclip-${Date.now()}.webm`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 60000);

    $("exportStatus").textContent =
      "Clip downloaded successfully!";

  } catch (error) {
    console.error(error);
    $("exportStatus").textContent = error.message;

  } finally {
    video.pause();

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    exporting = false;
    $("export").disabled = false;
  }
});

// LIVESTREAM VIEWER
$("twitchBtn").addEventListener("click", () => {
  platform = "twitch";
  $("twitchBtn").classList.remove("secondary");
  $("youtubeBtn").classList.add("secondary");
});

$("youtubeBtn").addEventListener("click", () => {
  platform = "youtube";
  $("youtubeBtn").classList.remove("secondary");
  $("twitchBtn").classList.add("secondary");
});

$("loadStream").addEventListener("click", () => {
  const input = $("streamUrl").value.trim();
  const container = $("livePlayer");

  container.replaceChildren();

  try {
    const url = new URL(input);

    if (url.protocol !== "https:") {
      throw new Error("Use an HTTPS stream link.");
    }

    const host = url.hostname.toLowerCase();
    let embedURL;

    if (platform === "twitch") {
      if (!["twitch.tv", "www.twitch.tv"].includes(host)) {
        throw new Error("Enter a Twitch channel URL.");
      }

      const channel = url.pathname.split("/").filter(Boolean)[0];

      if (!channel || !/^[a-zA-Z0-9_]+$/.test(channel)) {
        throw new Error("Invalid Twitch channel.");
      }

      embedURL = new URL("https://player.twitch.tv/");
      embedURL.searchParams.set("channel", channel);
      embedURL.searchParams.set("parent", location.hostname);

    } else {
      const validHosts = [
        "youtube.com", "www.youtube.com",
        "m.youtube.com", "youtu.be"
      ];

      if (!validHosts.includes(host)) {
        throw new Error("Enter a YouTube video URL.");
      }

      let id = "";

      if (host === "youtu.be") {
        id = url.pathname.split("/")[1];
      } else if (url.pathname.startsWith("/live/")) {
        id = url.pathname.split("/")[2];
      } else if (url.pathname.startsWith("/shorts/")) {
        id = url.pathname.split("/")[2];
      } else {
        id = url.searchParams.get("v");
      }

      if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) {
        throw new Error("Invalid YouTube video ID.");
      }

      embedURL = new URL(
        `https://www.youtube-nocookie.com/embed/${id}`
      );
    }

    const iframe = document.createElement("iframe");
    iframe.src = embedURL.toString();
    iframe.allow =
      "autoplay; fullscreen; encrypted-media; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.title = "Livestream player";

    container.appendChild(iframe);
    $("liveStatus").textContent = "Stream loaded.";

  } catch (error) {
    $("liveStatus").textContent = error.message;
  }
});

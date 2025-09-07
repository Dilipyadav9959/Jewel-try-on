const API_BASE = "http://localhost:8000"; // adjust if needed

// ---- Tabs
const tabLive = document.getElementById("tab-live");
const tabAvatar = document.getElementById("tab-avatar");
const liveSection = document.getElementById("live-section");
const avatarSection = document.getElementById("avatar-section");

tabLive.onclick = () => {
  tabLive.classList.add("active");
  tabAvatar.classList.remove("active");
  liveSection.classList.remove("hidden");
  avatarSection.classList.add("hidden");
};
tabAvatar.onclick = () => {
  tabAvatar.classList.add("active");
  tabLive.classList.remove("active");
  liveSection.classList.add("hidden");
  avatarSection.classList.remove("hidden");
};

// ---- Live Try-On (MediaPipe)
const videoElement = document.getElementById("videoElement");
const necklaceOverlay = document.getElementById("necklaceOverlay");
const hiddenCanvas = document.getElementById("hiddenCanvas");
let isFullView = false;
let currentNecklace = "jewelry/necklace1.png";

const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});
faceMesh.setOptions({
  maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5
});
faceMesh.onResults(onResults);

const cam = new Camera(videoElement, {
  onFrame: async () => { await faceMesh.send({ image: videoElement }); },
  width: 900, height: 700,
});
cam.start();

function onResults(results) {
  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) return;
  const lms = results.multiFaceLandmarks[0];
  const chin = lms[152], leftJaw = lms[234], rightJaw = lms[454];

  const vw = isFullView ? window.innerWidth : videoElement.offsetWidth;
  const vh = isFullView ? window.innerHeight : videoElement.offsetHeight;

  const chinX = chin.x * vw, chinY = chin.y * vh;
  const jawDist = Math.hypot(rightJaw.x - leftJaw.x, rightJaw.y - leftJaw.y);
  const width = jawDist * vw * 1.5;

  necklaceOverlay.style.top  = `${chinY}px`;
  necklaceOverlay.style.left = `${chinX - width/2}px`;
  necklaceOverlay.style.width = `${width}px`;
}

// Catalog clicks
document.querySelectorAll("#catalog .item img").forEach(imgBtn => {
  imgBtn.addEventListener("click", () => {
    currentNecklace = imgBtn.dataset.src;
    necklaceOverlay.src = currentNecklace;
  });
});

// Capture
document.getElementById("btn-capture").onclick = () => {
  const ctx = hiddenCanvas.getContext("2d");
  const vw = isFullView ? window.innerWidth : videoElement.offsetWidth;
  const vh = isFullView ? window.innerHeight : videoElement.offsetHeight;
  hiddenCanvas.width = vw; hiddenCanvas.height = vh;

  ctx.drawImage(videoElement, 0, 0, vw, vh);

  const img = new Image();
  img.src = currentNecklace;
  img.onload = () => {
    const ratio = img.height / img.width;
    const dw = parseFloat(necklaceOverlay.style.width);
    const dh = dw * ratio;
    ctx.drawImage(
      img,
      parseFloat(necklaceOverlay.style.left),
      parseFloat(necklaceOverlay.style.top),
      dw, dh
    );

    const link = document.createElement("a");
    link.download = "jewelry-tryon.png";
    link.href = hiddenCanvas.toDataURL("image/png");
    link.click();
  };
};

// Full view toggle
document.getElementById("btn-full").onclick = (e) => {
  isFullView = !isFullView;
  if (isFullView) {
    videoElement.style.width = "100vw";
    videoElement.style.height = "100vh";
    e.target.textContent = "↩ Exit Full View";
  } else {
    videoElement.style.width = "900px";
    videoElement.style.height = "700px";
    e.target.textContent = "🔍 Full View";
  }
};

// ---- Avatar Face-Swap Frontend
const avatarSelect = document.getElementById("avatar-select");
const selfieInput = document.getElementById("selfie-input");
const btnSwap = document.getElementById("btn-swap");
const swapOut = document.getElementById("swap-output");

// Populate avatars from backend
fetch(`${API_BASE}/api/avatars`).then(r=>r.json()).then(data=>{
  (data.avatars || []).forEach(name => {
    const opt = document.createElement("option");
    opt.value = name; opt.textContent = name;
    avatarSelect.appendChild(opt);
  });
});

btnSwap.onclick = async () => {
  const file = selfieInput.files && selfieInput.files[0];
  const avatarName = avatarSelect.value;
  if (!file || !avatarName) { alert("Select a selfie and an avatar."); return; }

  const fd = new FormData();
  fd.append("selfie", file);
  fd.append("avatar_name", avatarName);

  btnSwap.disabled = true; btnSwap.textContent = "Processing...";
  try {
    const res = await fetch(`${API_BASE}/api/face-swap`, { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok && data.path) {
      swapOut.src = `${API_BASE}${data.path}?t=${Date.now()}`; // bust cache
    } else {
      alert(data.error || "Failed to swap face.");
    }
  } catch (e) {
    alert("Server not reachable. Start the backend.");
  } finally {
    btnSwap.disabled = false; btnSwap.textContent = "⚡ Face-Swap";
  }
};

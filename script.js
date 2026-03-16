// Client-side logic for FashionList (dashboard)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const imageInput = document.getElementById("imageInput");
const preview = document.getElementById("preview");
const resultText = document.getElementById("resultText");
const loader = document.getElementById("loader");
const webcam = document.getElementById("webcam");
const cameraBtn = document.getElementById("cameraBtn");
const snapBtn = document.getElementById("snapBtn");
const logoutBtn = document.getElementById("logoutBtn");
const missingCard = document.getElementById("missingCard");
const missingMaterial = document.getElementById("missingMaterial");
const missingPrice = document.getElementById("missingPrice");
const saveMaterialBtn = document.getElementById("saveMaterialBtn");

let stream = null;
let pendingLabel = null;
let pendingImage = null;

// ---------- Auth guard ----------
async function ensureAuth() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.href = "/login.html";
  }
}

supabase.auth.onAuthStateChange((_event, session) => {
  if (!session) {
    window.location.href = "/login.html";
  }
});

// ---------- Camera ----------
async function startCamera() {
  if (stream) return;
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  webcam.srcObject = stream;
  webcam.style.display = "block";
}

async function captureFrame() {
  if (!stream) await startCamera();
  const canvas = document.createElement("canvas");
  canvas.width = webcam.videoWidth || 640;
  canvas.height = webcam.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(webcam, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

// ---------- API call ----------
async function sendToScanner(dataUrl) {
  const res = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataUrl })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Scan failed");
  }
  return res.json(); // { label }
}

// ---------- UI flow ----------
async function analyze(dataUrl) {
  loader.classList.add("show");
  resultText.innerText = "Detecting material...";
  hideMissingCard();

  try {
    const scanResult = await sendToScanner(dataUrl);
    pendingLabel = scanResult.label?.toLowerCase().trim();
    pendingImage = dataUrl;

    if (scanResult.price !== undefined) {
      resultText.innerHTML =
        `Material detected: <b>${pendingLabel}</b><br>` +
        `Price: ₦${scanResult.price}<br>` +
        `Saved in database`;
      hideMissingCard();
    } else if (scanResult.status === "not_found") {
      showMissingCard(pendingLabel);
    } else {
      resultText.innerText = "Unexpected response from scanner.";
    }
  } catch (err) {
    console.error(err);
    resultText.innerText = err.message;
  } finally {
    loader.classList.remove("show");
  }
}

async function handleUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const dataUrl = await fileToDataUrl(file);
  preview.src = dataUrl;
  preview.style.display = "block";
  analyze(dataUrl);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function snapAndAnalyze() {
  const dataUrl = await captureFrame();
  preview.src = dataUrl;
  preview.style.display = "block";
  analyze(dataUrl);
}

async function handleLogout() {
  await supabase.auth.signOut();
  window.location.href = "/login.html";
}

function showMissingCard(label) {
  if (!missingCard) return;
  missingMaterial.textContent = `Material not found: ${label || "Unknown"}. Enter price.`;
  missingPrice.value = "";
  missingCard.style.display = "block";
}

function hideMissingCard() {
  if (!missingCard) return;
  missingCard.style.display = "none";
}

async function handleSaveMaterial() {
  const priceValue = parseFloat(missingPrice.value);
  if (!pendingLabel) {
    resultText.innerText = "No material to save.";
    return;
  }
  if (Number.isNaN(priceValue) || priceValue <= 0) {
    resultText.innerText = "Enter a valid price.";
    return;
  }
  const res = await fetch("/api/saveMaterial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: pendingLabel,
      price: priceValue,
      image: pendingImage
    })
  });

  if (!res.ok) {
    const err = await res.text();
    resultText.innerText = err || "Could not save price.";
    return;
  }

  hideMissingCard();
  resultText.innerHTML =
    `Material detected: <b>${pendingLabel}</b><br>` +
    `Price: ₦${priceValue}<br>` +
    `Saved in database`;
}

// ---------- Events ----------
imageInput.addEventListener("change", handleUpload);
cameraBtn.addEventListener("click", startCamera);
snapBtn.addEventListener("click", snapAndAnalyze);
logoutBtn?.addEventListener("click", handleLogout);
saveMaterialBtn?.addEventListener("click", handleSaveMaterial);

// Guard on load
ensureAuth();

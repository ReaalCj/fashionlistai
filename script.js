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

// ---------- Price lookup via Supabase ----------
async function fetchPrice(label) {
  const key = label?.toLowerCase().trim();
  if (!key) return null;
  const { data, error } = await supabase
    .from("materials")
    .select("name, price")
    .eq("name", key)
    .maybeSingle();
  if (error) {
    console.error(error);
    return null;
  }
  return data;
}

// ---------- UI flow ----------
async function analyze(dataUrl) {
  loader.classList.add("show");
  resultText.innerText = "Detecting material...";
  hideMissingCard();

  try {
    const { label } = await sendToScanner(dataUrl);
    pendingLabel = label?.toLowerCase().trim();
    const match = await fetchPrice(label);
    if (match) {
      resultText.innerHTML = `Product: <b>${match.name}</b><br>Price: ₦${match.price}`;
    } else {
      showMissingCard(pendingLabel);
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
  const { error } = await supabase.from("materials").insert({
    name: pendingLabel,
    price: priceValue
  });
  if (error) {
    console.error(error);
    resultText.innerText = "Could not save price.";
    return;
  }
  hideMissingCard();
  resultText.innerHTML = `Product: <b>${pendingLabel}</b><br>Price: ₦${priceValue}`;
}

// ---------- Events ----------
imageInput.addEventListener("change", handleUpload);
cameraBtn.addEventListener("click", startCamera);
snapBtn.addEventListener("click", snapAndAnalyze);
logoutBtn?.addEventListener("click", handleLogout);
saveMaterialBtn?.addEventListener("click", handleSaveMaterial);

// Guard on load
ensureAuth();

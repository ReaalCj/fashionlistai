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

let stream = null;

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
    .from("products")
    .select("name, price")
    .eq("label", key)
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

  try {
    const { label } = await sendToScanner(dataUrl);
    const match = await fetchPrice(label);
    if (match) {
      resultText.innerHTML = `Product: <b>${match.name}</b><br>Price: ₦${match.price}`;
    } else {
      resultText.innerText = "Product not found.";
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

// ---------- Events ----------
imageInput.addEventListener("change", handleUpload);
cameraBtn.addEventListener("click", startCamera);
snapBtn.addEventListener("click", snapAndAnalyze);
logoutBtn?.addEventListener("click", handleLogout);

// Guard on load
ensureAuth();

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const path = window.location.pathname;
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const message = document.getElementById("authMessage");

function showMessage(text, isError = false) {
  if (!message) return;
  message.textContent = text;
  message.style.color = isError ? "#f87171" : "#94a3b8";
}

async function redirectIfLoggedIn() {
  const { data } = await supabase.auth.getSession();
  if (data.session && (path.includes("login") || path.includes("signup") || path === "/")) {
    window.location.href = "/dashboard.html";
  }
}

async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (!data.session && path.includes("dashboard")) {
    window.location.href = "/login.html";
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const email = loginForm.email.value;
  const password = loginForm.password.value;
  showMessage("Signing in...");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    showMessage(error.message, true);
    return;
  }
  window.location.href = "/dashboard.html";
}

function validatePassword(pw, confirmPw) {
  if (!pw || pw.length < 8) return "Password must be at least 8 characters.";
  if (pw !== confirmPw) return "Passwords do not match.";
  return null;
}

async function handleSignup(event) {
  event.preventDefault();
  const email = signupForm.email.value;
  const password = signupForm.password.value;
  const confirm = signupForm.confirm.value;
  const errorText = validatePassword(password, confirm);
  if (errorText) {
    showMessage(errorText, true);
    return;
  }
  showMessage("Creating account...");
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    showMessage(error.message, true);
    return;
  }
  showMessage("Account created! Redirecting...");
  window.location.href = "/dashboard.html";
}

// Wire events
if (loginForm) {
  loginForm.addEventListener("submit", handleLogin);
}
if (signupForm) {
  signupForm.addEventListener("submit", handleSignup);
}

// Session handling
redirectIfLoggedIn();
ensureSession();

supabase.auth.onAuthStateChange((_event, session) => {
  if (!session && path.includes("dashboard")) {
    window.location.href = "/login.html";
  }
});

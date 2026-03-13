import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const form = document.getElementById("loginForm");
const email = document.getElementById("email");
const password = document.getElementById("password");
const message = document.getElementById("loginMessage");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.textContent = "Signing in...";
  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  });
  if (error) {
    message.textContent = error.message;
    return;
  }
  window.location.href = "/dashboard.html";
});

// Redirect if already logged in
supabase.auth.getSession().then(({ data }) => {
  if (data.session) window.location.href = "/dashboard.html";
});

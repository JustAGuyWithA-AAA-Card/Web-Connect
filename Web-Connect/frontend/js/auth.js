const apiBase = "https://your-worker-name.workers.dev/api"; // update if needed

async function registerUser() {
  const username = document.querySelector("#register-username").value.trim();
  const password = document.querySelector("#register-password").value.trim();

  if (!username || !password) return showStatus("Please fill all fields", "error");

  const res = await fetch(`${apiBase}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();
  if (res.ok) {
    showStatus("Registration successful!", "success");
  } else {
    showStatus(data.error || "Error during registration", "error");
  }
}

async function loginUser() {
  const username = document.querySelector("#login-username").value.trim();
  const password = document.querySelector("#login-password").value.trim();

  if (!username || !password) return showStatus("Please fill all fields", "error");

  const res = await fetch(`${apiBase}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();
  if (res.ok) {
    localStorage.setItem("token", data.token);
    showStatus("Login successful!", "success");
  } else {
    showStatus(data.error || "Login failed", "error");
  }
}

async function fetchProfile() {
  const token = localStorage.getItem("token");
  if (!token) return showStatus("You are not logged in", "error");

  const res = await fetch(`${apiBase}/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (res.ok) {
    showStatus(`Welcome ${data.username}`, "success");
  } else {
    showStatus(data.error || "Session expired", "error");
  }
}

// --- Small UI helper ---
function showStatus(msg, type = "info") {
  const el = document.querySelector("#status");
  el.textContent = msg;
  el.className = `status ${type}`;
}

// --- Button bindings ---
document.querySelector("#register-btn")?.addEventListener("click", registerUser);
document.querySelector("#login-btn")?.addEventListener("click", loginUser);
document.querySelector("#profile-btn")?.addEventListener("click", fetchProfile);

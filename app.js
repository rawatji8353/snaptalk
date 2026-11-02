import { initializeApp } from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDdiMDkQPThhYTeb_Mum7kW3Z-AuffC-Zg",
  authDomain: "snaptalk-c4898.firebaseapp.com",
  projectId: "snaptalk-c4898",
  storageBucket: "snaptalk-c4898.firebasestorage.app",
  messagingSenderId: "927301472452",
  appId: "1:927301472452:web:a0772367769794ea557991",
  measurementId: "G-3Z01S5JPPT"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const $ = id => document.getElementById(id);

let currentUser = null;
let unlocked = false;

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(section => {
    section.hidden = section.id !== id;
  });

  $("bottomNav").hidden =
    !unlocked || !currentUser || id === "chat";
}

function showMainScreen() {
  if (!unlocked) return;
  showScreen(currentUser ? "home" : "login");
}

function lockScreen() {
  unlocked = false;
  $("unlockValue").value = "";
  $("lockStatus").textContent = "";
  $("lockSetup").hidden = true;
  $("lockUnlock").hidden = true;

  if (localStorage.getItem("snaptalkLockHash")) {
    $("lockTitle").textContent = "SnapTalk is Locked";
    $("lockInfo").textContent = "Enter your PIN or password";
    $("lockUnlock").hidden = false;
  } else {
    $("lockTitle").textContent = "Create App Lock";
    $("lockInfo").textContent = "Set a separate PIN or password";
    $("lockSetup").hidden = false;
  }

  showScreen("lockScreen");
}

function makeSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

async function hashLock(value, salt) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(value), "PBKDF2", false, ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    salt: encoder.encode(salt),
    iterations: 150000,
    hash: "SHA-256"
  }, key, 256);

  return Array.from(new Uint8Array(bits),
    b => b.toString(16).padStart(2, "0")).join("");
}

$("saveLockBtn").addEventListener("click", async () => {
  const value = $("newLock").value;
  const confirm = $("confirmLock").value;
  const type = $("lockType").value;

  if (value.length < (type === "pin" ? 4 : 6)) {
    $("lockStatus").textContent =
      type === "pin" ? "PIN must be at least 4 digits." :
      "Password must be at least 6 characters.";
    return;
  }

  if (type === "pin" && !/^\d+$/.test(value)) {
    $("lockStatus").textContent = "PIN mein sirf numbers use karein.";
    return;
  }

  if (value !== confirm) {
    $("lockStatus").textContent = "Dono entries match nahi karti.";
    return;
  }

  try {
    const salt = makeSalt();
    const hash = await hashLock(value, salt);
    localStorage.setItem("snaptalkLockSalt", salt);
    localStorage.setItem("snaptalkLockHash", hash);
    localStorage.setItem("snaptalkLockType", type);
    $("newLock").value = "";
    $("confirmLock").value = "";
    unlocked = true;
    showMainScreen();
  } catch {
    $("lockStatus").textContent = "App Lock setup nahi ho paya.";
  }
});

$("unlockBtn").addEventListener("click", async () => {
  const value = $("unlockValue").value;
  const salt = localStorage.getItem("snaptalkLockSalt");
  const savedHash = localStorage.getItem("snaptalkLockHash");

  if (!value || !salt || !savedHash) return;

  try {
    const enteredHash = await hashLock(value, salt);

    if (enteredHash === savedHash) {
      unlocked = true;
      $("unlockValue").value = "";
      showMainScreen();
    } else {
      $("lockStatus").textContent = "PIN ya password galat hai.";
    }
  } catch {
    $("lockStatus").textContent = "Unlock nahi ho paya.";
  }
});

$("unlockValue").addEventListener("keydown", event => {
  if (event.key === "Enter") $("unlockBtn").click();
});

function accountMessage(message) {
  $("status").textContent = message;
}

$("loginBtn").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("accountPassword").value;

  if (!email || !password) {
    accountMessage("Email aur password dono bharein.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    accountMessage(error.message);
  }
});

$("signupBtn").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("accountPassword").value;

  if (!email || !password) {
    accountMessage("Signup ke liye email aur password bharein.");
    return;
  }

  if (password.length < 6) {
    accountMessage("Account password kam se kam 6 characters ka ho.");
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    accountMessage(error.message);
  }
});

onAuthStateChanged(auth, user => {
  currentUser = user;

  if (unlocked) showMainScreen();
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    accountMessage(error.message);
  }
});

document.querySelectorAll("[data-tab]").forEach(button => {
  button.addEventListener("click", () => {
    if (!unlocked || !currentUser) return;
    showScreen(button.dataset.tab);
  });
});

$("shareBtn").addEventListener("click", async () => {
  const shareData = {
    title: "SnapTalk",
    text: "Open SnapTalk",
    url: location.href
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch {}
  } else {
    await navigator.clipboard.writeText(location.href);
    alert("SnapTalk link copied!");
  }
});

$("backBtn").addEventListener("click", () => showScreen("home"));

$("messageForm").addEventListener("submit", event => {
  event.preventDefault();
  alert("Chat messaging ka Firebase setup agle step mein hoga.");
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && unlocked) {
    lockScreen();
  }
});

// Every fresh page opening starts at App Lock.
lockScreen();

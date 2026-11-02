import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// =====================================
// 1. FIREBASE CONFIGURATION
// =====================================

const firebaseConfig = {
  apiKey: "AIzaSyDdiMDkQPThhYTeb_Mum7kW3Z-AuffC-Zg",
  authDomain: "snaptalk-c4898.firebaseapp.com",
  projectId: "snaptalk-c4898",
  storageBucket: "snaptalk-c4898.firebasestorage.app",
  messagingSenderId: "927301472452",
  appId: "1:927301472452:web:a0772367769794ea557991",
  measurementId: "G-3Z01S5JPPT"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);


// =====================================
// 2. HTML ELEMENTS
// =====================================

const $ = (id) => document.getElementById(id);

const lockScreen = $("lockScreen");
const lockSetup = $("lockSetup");
const lockUnlock = $("lockUnlock");

const loginScreen = $("login");
const homeScreen = $("home");

const lockMessage = $("lockMessage");
const authStatus = $("authStatus");
const chatStatus = $("chatStatus");
const messageStatus = $("messageStatus");

let currentUser = null;
let currentChatId = null;
let currentFriendUid = null;
let unsubscribeMessages = null;
let appUnlocked = false;


// =====================================
// 3. APP LOCK - LOCAL DEVICE LOCK
// =====================================

const LOCK_KEY = "snaptalk_lock_data";

function getLockData() {
  try {
    return JSON.parse(localStorage.getItem(LOCK_KEY));
  } catch {
    return null;
  }
}

function showLockScreen() {
  appUnlocked = false;
  lockScreen.hidden = false;
  loginScreen.hidden = true;
  homeScreen.hidden = true;
  $("callScreen").hidden = true;

  const lockData = getLockData();

  lockSetup.hidden = !!lockData;
  lockUnlock.hidden = !lockData;

  $("newPin").value = "";
  $("confirmPin").value = "";
  $("unlockPin").value = "";
  lockMessage.textContent = "";
}

async function hashPin(pin, salt) {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const result = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 150000,
      hash: "SHA-256"
    },
    key,
    256
  );

  return Array.from(new Uint8Array(result))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

$("savePinBtn").addEventListener("click", async () => {
  const pin = $("newPin").value.trim();
  const confirmPin = $("confirmPin").value.trim();

  if (!/^\d{4,8}$/.test(pin)) {
    lockMessage.textContent = "PIN must contain 4–8 digits.";
    return;
  }

  if (pin !== confirmPin) {
    lockMessage.textContent = "PIN does not match.";
    return;
  }

  try {
    const salt = crypto.randomUUID();
    const hash = await hashPin(pin, salt);

    localStorage.setItem(
      LOCK_KEY,
      JSON.stringify({ salt, hash })
    );

    lockMessage.textContent = "App Lock created!";
    enterAfterUnlock();
  } catch (error) {
    lockMessage.textContent = "Could not create lock. Use HTTPS browser.";
  }
});

$("unlockBtn").addEventListener("click", async () => {
  const pin = $("unlockPin").value.trim();
  const lockData = getLockData();

  if (!lockData) {
    showLockScreen();
    return;
  }

  try {
    const hash = await hashPin(pin, lockData.salt);

    if (hash !== lockData.hash) {
      lockMessage.textContent = "Incorrect PIN.";
      return;
    }

    enterAfterUnlock();
  } catch (error) {
    lockMessage.textContent = "Unable to unlock. Try again.";
  }
});

function enterAfterUnlock() {
  appUnlocked = true;
  lockScreen.hidden = true;
  checkLoginState();
}


// =====================================
// 4. LOGIN AND SIGNUP
// =====================================

$("loginBtn").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("accountPassword").value;

  if (!email || !password) {
    authStatus.textContent = "Enter email and password.";
    return;
  }

  try {
    authStatus.textContent = "Logging in...";

    await signInWithEmailAndPassword(auth, email, password);

    authStatus.textContent = "";
  } catch (error) {
    authStatus.textContent = error.message;
  }
});

$("signupBtn").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("accountPassword").value;

  if (!email || !password) {
    authStatus.textContent = "Enter email and password.";
    return;
  }

  if (password.length < 6) {
    authStatus.textContent = "Password must be at least 6 characters.";
    return;
  }

  try {
    authStatus.textContent = "Creating account...";

    await createUserWithEmailAndPassword(auth, email, password);

    authStatus.textContent = "";
  } catch (error) {
    authStatus.textContent = error.message;
  }
});

function checkLoginState() {
  onAuthStateChanged(auth, (user) => {
    if (!appUnlocked) return;

    currentUser = user;

    if (user) {
      showHome();
    } else {
      loginScreen.hidden = false;
      homeScreen.hidden = true;
    }
  });
}


// =====================================
// 5. SHOW HOME
// =====================================

function showHome() {
  loginScreen.hidden = true;
  homeScreen.hidden = false;

  $("profileEmail").textContent = currentUser.email || "";
  $("myUid").textContent = "User ID: " + currentUser.uid;
  $("profileName").textContent =
    currentUser.email?.split("@")[0] || "My Profile";

  $("profileAvatar").textContent =
    (currentUser.email?.[0] || "S").toUpperCase();

  loadProfile();
  loadChats();
}


// =====================================
// 6. BOTTOM NAVIGATION
// =====================================

const navButtons = document.querySelectorAll(".nav-btn");

navButtons.forEach(button => {
  button.addEventListener("click", () => {
    const target = button.dataset.tab;

    document.querySelectorAll(".tab-page").forEach(tab => {
      tab.hidden = true;
    });

    $(target).hidden = false;

    navButtons.forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");

    $("chatRoom").hidden = true;
  });
});


// =====================================
// 7. START ONE-TO-ONE CHAT
// =====================================

$("startChatBtn").addEventListener("click", async () => {
  if (!currentUser) return;

  const friendUid = $("friendUid").value.trim();

  if (!friendUid) {
    chatStatus.textContent = "Enter your friend's User ID.";
    return;
  }

  if (friendUid === currentUser.uid) {
    chatStatus.textContent = "You cannot chat with yourself.";
    return;
  }

  try {
    chatStatus.textContent = "Checking user...";

    const chatsQuery = query(
      collection(db, "chats"),
      where("members", "array-contains", currentUser.uid)
    );

    const result = await getDocs(chatsQuery);

    let foundChat = null;

    result.forEach(docSnap => {
      const data = docSnap.data();

      if (data.members.includes(friendUid)) {
        foundChat = {
          id: docSnap.id,
          ...data
        };
      }
    });

    if (foundChat) {
      openChat(foundChat.id, friendUid);
    } else {
      const newChat = await addDoc(
        collection(db, "chats"),
        {
          members: [currentUser.uid, friendUid],
          createdAt: serverTimestamp()
        }
      );

      openChat(newChat.id, friendUid);
    }

    chatStatus.textContent = "";
    $("friendUid").value = "";

  } catch (error) {
    chatStatus.textContent =
      "Chat error: " + error.message;
  }
});


// =====================================
// 8. LOAD CHAT LIST
// =====================================

async function loadChats() {
  if (!currentUser) return;

  const list = $("chatList");
  list.innerHTML = "";

  try {
    const chatsQuery = query(
      collection(db, "chats"),
      where("members", "array-contains", currentUser.uid)
    );

    const result = await getDocs(chatsQuery);

    if (result.empty) {
      list.innerHTML =
        '<p class="empty-state">No chats yet. Start a conversation!</p>';
      return;
    }

    result.forEach(docSnap => {
      const data = docSnap.data();

      const friendUid = data.members.find(
        uid => uid !== currentUser.uid
      );

      const item = document.createElement("div");
      item.className = "chat-item";

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.textContent = "S";

      const info = document.createElement("div");
      info.style.flex = "1";

      const title = document.createElement("strong");
      title.textContent = "SnapTalk Friend";

      const subtitle = document.createElement("p");
      subtitle.textContent = friendUid;

      info.append(title, subtitle);
      item.append(avatar, info);

      item.addEventListener("click", () => {
        openChat(docSnap.id, friendUid);
      });

      list.appendChild(item);
    });

  } catch (error) {
    list.textContent = "Unable to load chats: " + error.message;
  }
}


// =====================================
// 9. OPEN CHAT
// =====================================

function openChat(chatId, friendUid) {
  currentChatId = chatId;
  currentFriendUid = friendUid;

  $("chatRoom").hidden = false;
  $("chatTitle").textContent = "SnapTalk Friend";
  $("chatSubtitle").textContent = friendUid;

  $("messages").innerHTML =
    '<p class="empty-state">Loading messages...</p>';

  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }

  const messagesRef = collection(
    db,
    "chats",
    chatId,
    "messages"
  );

  const messagesQuery = query(
    messagesRef,
    orderBy("createdAt", "asc")
  );

  unsubscribeMessages = onSnapshot(
    messagesQuery,
    (snapshot) => {
      const messages = $("messages");
      messages.innerHTML = "";

      if (snapshot.empty) {
        messages.innerHTML =
          '<p class="empty-state">Say hello! Send your first message.</p>';
        return;
      }

      snapshot.forEach(docSnap => {
        const data = docSnap.data();

        const bubble = document.createElement("div");
        bubble.className =
          "message " +
          (data.senderId === currentUser.uid ? "mine" : "");

        const text = document.createElement("div");
        text.textContent = data.text || "";

        const copyButton = document.createElement("button");
        copyButton.textContent = "Copy";
        copyButton.className = "secondary";
        copyButton.style.padding = "5px 9px";
        copyButton.style.marginTop = "8px";
        copyButton.style.fontSize = "11px";

        copyButton.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(data.text || "");
            messageStatus.textContent = "Message copied.";
          } catch {
            messageStatus.textContent = "Copy not available in this browser.";
          }
        });

        bubble.append(text, copyButton);
        messages.appendChild(bubble);
      });

      messages.scrollTop = messages.scrollHeight;
    },
    (error) => {
      $("messages").textContent =
        "Message error: " + error.message;
    }
  );
}


// =====================================
// 10. SEND MESSAGE
// =====================================

$("messageForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser || !currentChatId) {
    messageStatus.textContent = "Open a chat first.";
    return;
  }

  const input = $("messageInput");
  const text = input.value.trim();

  if (!text) return;

  try {
    $("sendBtn").disabled = true;
    messageStatus.textContent = "Sending...";

    await addDoc(
      collection(
        db,
        "chats",
        currentChatId,
        "messages"
      ),
      {
        text: text,
        senderId: currentUser.uid,
        createdAt: serverTimestamp()
      }
    );

    input.value = "";
    messageStatus.textContent = "";

  } catch (error) {
    messageStatus.textContent =
      "Message not sent: " + error.message;
  } finally {
    $("sendBtn").disabled = false;
  }
});


// =====================================
// 11. BACK TO CHAT LIST
// =====================================

$("backToChats").addEventListener("click", () => {
  $("chatRoom").hidden = true;

  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }

  currentChatId = null;
  loadChats();
});


// =====================================
// 12. EMOJI BUTTON
// =====================================

$("emojiBtn").addEventListener("click", () => {
  const input = $("messageInput");
  input.value += " 😊";
  input.focus();
});


// =====================================
// 13. MEDIA ATTACHMENT PLACEHOLDER
// =====================================

$("attachBtn").addEventListener("click", () => {
  messageStatus.textContent =
    "Photo/video upload needs a separate storage service.";
});

$("mediaInput").addEventListener("change", () => {
  messageStatus.textContent =
    "Media upload is not configured yet.";
});


// =====================================
// 14. SEARCH CHATS
// =====================================

$("searchChats").addEventListener("input", (event) => {
  const search = event.target.value.toLowerCase();

  document.querySelectorAll(".chat-item").forEach(item => {
    item.hidden = !item.textContent.toLowerCase().includes(search);
  });
});


// =====================================
// 15. PROFILE
// =====================================

function loadProfile() {
  const saved = JSON.parse(
    localStorage.getItem("snaptalk_profile") || "{}"
  );

  $("displayName").value = saved.name || "";
  $("bio").value = saved.bio || "";

  if (saved.name) {
    $("profileName").textContent = saved.name;
  }
}

$("saveProfileBtn").addEventListener("click", () => {
  const name = $("displayName").value.trim();
  const bio = $("bio").value.trim();

  localStorage.setItem(
    "snaptalk_profile",
    JSON.stringify({ name, bio })
  );

  $("profileName").textContent = name || "My Profile";
  $("profileStatus").textContent = "Profile saved on this device.";
});

$("copyUidBtn").addEventListener("click", async () => {
  if (!currentUser) return;

  try {
    await navigator.clipboard.writeText(currentUser.uid);
    $("profileStatus").textContent = "User ID copied.";
  } catch {
    $("profileStatus").textContent =
      "Copy unavailable. Select and copy your User ID.";
  }
});


// =====================================
// 16. STORY PLACEHOLDER
// =====================================

$("createStoryBtn").addEventListener("click", () => {
  alert("Story creation needs media storage and expiry setup.");
});


// =====================================
// 17. CALL SCREEN PLACEHOLDER
// =====================================

function showCallScreen() {
  $("callScreen").hidden = false;
  $("callName").textContent = "SnapTalk Friend";
  $("callStatus").textContent =
    "Real calls are not connected yet. WebRTC setup is required.";
}

$("voiceCallBtn").addEventListener("click", showCallScreen);
$("videoCallBtn").addEventListener("click", showCallScreen);

$("endCallBtn").addEventListener("click", () => {
  $("callScreen").hidden = true;
});

$("muteCallBtn").addEventListener("click", () => {
  $("callStatus").textContent =
    "Mute will work after real calling is configured.";
});

$("switchCameraBtn").addEventListener("click", () => {
  $("callStatus").textContent =
    "Camera switching will work after real video calling is configured.";
});


// =====================================
// 18. APP LOCK BUTTON
// =====================================

$("lockNowBtn").addEventListener("click", () => {
  showLockScreen();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && currentUser) {
    showLockScreen();
  }
});


// =====================================
// 19. CHANGE APP LOCK PIN
// =====================================

$("changePinBtn").addEventListener("click", async () => {
  const oldPin = prompt("Enter your current App Lock PIN:");

  if (oldPin === null) return;

  const lockData = getLockData();

  if (!lockData) {
    alert("No App Lock PIN found.");
    return;
  }

  try {
    const oldHash = await hashPin(oldPin, lockData.salt);

    if (oldHash !== lockData.hash) {
      alert("Incorrect current PIN.");
      return;
    }

    const newPin = prompt("Enter your new 4–8 digit PIN:");

    if (!newPin || !/^\d{4,8}$/.test(newPin)) {
      alert("PIN must contain 4–8 digits.");
      return;
    }

    const salt = crypto.randomUUID();
    const hash = await hashPin(newPin, salt);

    localStorage.setItem(
      LOCK_KEY,
      JSON.stringify({ salt, hash })
    );

    alert("App Lock PIN changed.");

  } catch {
    alert("Could not change PIN.");
  }
});


// =====================================
// 20. LOGOUT
// =====================================

$("logoutBtn").addEventListener("click", async () => {
  try {
    if (unsubscribeMessages) {
      unsubscribeMessages();
      unsubscribeMessages = null;
    }

    await signOut(auth);
    currentChatId = null;
    currentFriendUid = null;

  } catch (error) {
    alert("Logout error: " + error.message);
  }
});


// =====================================
// 21. START APPLICATION
// =====================================

showLockScreen();
      

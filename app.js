
/*
  SnapTalk Firebase connection
  Firebase Console se apna Web App config
  neeche firebaseConfig mein add karna hoga.
*/

import { initializeApp } from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


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
const db = getFirestore(app);

const status = document.getElementById("status");

onAuthStateChanged(auth, (user) => {
  if (user) {
    status.textContent = "Connected to SnapTalk!";
  } else {
    status.textContent =
      "Firebase connected. Login setup is next.";
  }
});

// Example real-time message listener.
// A secure chat ID and Firestore rules are required
// before using this listener in a real conversation.

window.startSnapTalkChat = function(chatId) {
  const messages = collection(
    db, "chats", chatId, "messages"
  );

  const q = query(
    messages,
    orderBy("createdAt", "asc")
  );

  return onSnapshot(q, (snapshot) => {
    const area = document.getElementById("messages");
    if (!area) return;

    area.innerHTML = "";

    snapshot.forEach((item) => {
      const data = item.data();
      const bubble = document.createElement("p");
      bubble.textContent = data.text || "";
      area.appendChild(bubble);
    });
  });
};

window.sendSnapTalkMessage = async function(chatId, text) {
  const user = auth.currentUser;

  if (!user || !text.trim()) {
    throw new Error("Login required or message is empty.");
  }

  await addDoc(
    collection(db, "chats", chatId, "messages"),
    {
      text: text.trim(),
      senderId: user.uid,
      createdAt: serverTimestamp()
    }
  );
};

console.log("SnapTalk Firebase module loaded.");

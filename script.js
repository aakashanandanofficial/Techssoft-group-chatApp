
/*
  CHATAPP - SUPABASE CONNECTION
const SUPABASE_URL = "https://islqlozermvbxvndxhll.supabase.co";
const SUPABASE_KEY = "sb_publishable_VPnpn1gyreQ9DNvOfwp5mA_w-yaRQZ-"
 
*/

const SUPABASE_URL = "https://islqlozermvbxvndxhll.supabase.co";
const SUPABASE_KEY = "sb_publishable_VPnpn1gyreQ9DNvOfwp5mA_w-yaRQZ-";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const authPanel = document.getElementById("authPanel");
const chatPanel = document.getElementById("chatPanel");
const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authButton = document.getElementById("authButton");
const authMessage = document.getElementById("authMessage");
const switchText = document.getElementById("switchText");
const switchAuth = document.getElementById("switchAuth");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const messagesBox = document.getElementById("messages");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const statusBox = document.getElementById("status");
const signOutButton = document.getElementById("signOutButton");

let currentUser = null;
let realtimeChannel = null;
let signupMode = false;
let loadedMessageIds = new Set();

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
}

function showAuthMessage(message, isError = true) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#a33a2b" : "#087f5b";
}

function setAuthMode(isSignup) {
  signupMode = isSignup;

  authTitle.textContent = signupMode
    ? "Create your account"
    : "Welcome back";

  authButton.textContent = signupMode
    ? "Sign up"
    : "Sign in";

  switchText.textContent = signupMode
    ? "Already have an account?"
    : "Don't have an account?";

  switchAuth.textContent = signupMode
    ? "Sign in"
    : "Sign up";

  passwordInput.autocomplete = signupMode
    ? "new-password"
    : "current-password";

  showAuthMessage("", false);
}

switchAuth.addEventListener("click", () => {
  setAuthMode(!signupMode);
});

function showChat() {
  authPanel.hidden = true;
  chatPanel.hidden = false;
}

function showLogin() {
  chatPanel.hidden = true;
  authPanel.hidden = false;
  messagesBox.replaceChildren();
  loadedMessageIds.clear();
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderMessage(message) {
  // Avoid duplicates when loading and receiving realtime events.
  if (loadedMessageIds.has(message.id)) return;

  loadedMessageIds.add(message.id);

  const bubble = document.createElement("article");
  bubble.className = "message" +
    (message.sender_id === currentUser.id ? " mine" : "");

  const sender = document.createElement("div");
  sender.className = "sender";

  sender.textContent =
    message.sender_id === currentUser.id
      ? "You"
      : "User " + message.sender_id.slice(0, 8);

  const body = document.createElement("div");
  body.className = "message-body";
  body.textContent = message.body;

  const time = document.createElement("div");
  time.className = "message-time";
  time.textContent = formatTime(message.created_at);

  bubble.append(sender, body, time);
  messagesBox.appendChild(bubble);

  messagesBox.scrollTop = messagesBox.scrollHeight;
}

async function loadMessages() {
  setStatus("Loading messages…");

  const { data, error } = await db
    .from("messages")
    .select("id, sender_id, body, created_at")
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    setStatus("Could not load messages: " + error.message, true);
    return;
  }

  messagesBox.replaceChildren();
  loadedMessageIds.clear();

  data.forEach(renderMessage);
  setStatus("Connected. New messages appear automatically.");
}

function subscribeToMessages() {
  if (realtimeChannel) {
    db.removeChannel(realtimeChannel);
  }

  realtimeChannel = db
    .channel("community-chat-live")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages"
      },
      payload => {
        if (currentUser) {
          renderMessage(payload.new);
        }
      }
    )
    .subscribe((state, error) => {
      if (state === "SUBSCRIBED") {
        setStatus("Connected. New messages appear automatically.");
      } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
        setStatus(
          "Live updates are unavailable. Check Supabase Realtime settings.",
          true
        );
      }

      if (error) console.error("Realtime error:", error);
    });
}

async function startChat(user) {
  currentUser = user;
  showChat();
  await loadMessages();
  subscribeToMessages();
}

authForm.addEventListener("submit", async event => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  authButton.disabled = true;
  showAuthMessage(
    signupMode ? "Creating your account…" : "Signing in…",
    false
  );

  try {
    if (signupMode) {
      const { data, error } = await db.auth.signUp({
        email,
        password
      });

      if (error) throw error;

      if (data.session) {
        await startChat(data.user);
      } else {
        showAuthMessage(
          "Account created. Check your email to confirm it, then sign in.",
          false
        );
        setAuthMode(false);
      }
    } else {
      const { data, error } = await db.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      await startChat(data.user);
    }
  } catch (error) {
    showAuthMessage(error.message);
  } finally {
    authButton.disabled = false;
  }
});

messageForm.addEventListener("submit", async event => {
  event.preventDefault();

  const body = messageInput.value.trim();

  if (!body || !currentUser) return;

  sendButton.disabled = true;

  try {
    const { data, error } = await db
      .from("messages")
      .insert({
        sender_id: currentUser.id,
        body: body
      })
      .select("id, sender_id, body, created_at")
      .single();

    if (error) throw error;

    // Render immediately. The realtime event won't duplicate it.
    renderMessage(data);
    messageInput.value = "";
    messageInput.focus();
    setStatus("Message sent.");
  } catch (error) {
    setStatus("Could not send message: " + error.message, true);
  } finally {
    sendButton.disabled = false;
  }
});

signOutButton.addEventListener("click", async () => {
  signOutButton.disabled = true;

  try {
    if (realtimeChannel) {
      await db.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }

    const { error } = await db.auth.signOut();
    if (error) throw error;

    currentUser = null;
    showLogin();
    setAuthMode(false);
    showAuthMessage("You have signed out.", false);
  } catch (error) {
    setStatus("Could not sign out: " + error.message, true);
  } finally {
    signOutButton.disabled = false;
  }
});

async function initializeApp() {
  if (
    SUPABASE_URL === "YOUR_SUPABASE_PROJECT_URL" ||
    SUPABASE_KEY === "YOUR_SUPABASE_PUBLISHABLE_KEY"
  ) {
    showLogin();
    showAuthMessage(
      "First add your Supabase project URL and publishable key in script.js."
    );
    return;
  }

  const { data, error } = await db.auth.getSession();

  if (error) {
    showLogin();
    showAuthMessage(error.message);
    return;
  }

  if (data.session) {
    await startChat(data.session.user);
  } else {
    showLogin();
  }

  db.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      currentUser = null;

      if (realtimeChannel) {
        db.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }

      showLogin();
    }
  });
}

initializeApp();

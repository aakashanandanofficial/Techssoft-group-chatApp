// ==========================================
// TECHSSOFT GROUP CHAT - SUPABASE CONNECTION
// ==========================================

const SUPABASE_URL = "https://islqlozermvbxvndxhll.supabase.co";
const SUPABASE_KEY = "sb_publishable_VPnpn1gyreQ9DNvOfwp5mA_w-yaRQZ-";

// IMPORTANT: Replace this with your real GitHub Pages website URL.
// Example: https://YOUR-USERNAME.github.io/Techssoft-group-chatApp/
const GITHUB_PAGES_URL = "YOUR_GITHUB_PAGES_URL";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// HTML elements
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

document.getElementById("year").textContent =
  new Date().getFullYear();

let currentUser = null;
let realtimeChannel = null;
let signupMode = false;
let loadedMessageIds = new Set();
let authBusy = false;

// ------------------------------------------
// STATUS AND AUTH MESSAGES
// ------------------------------------------

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
}

function showAuthMessage(message, isError = true) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#b42318" : "#087f5b";
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
  if (!authBusy) {
    setAuthMode(!signupMode);
  }
});

// ------------------------------------------
// SHOW AND HIDE PANELS
// ------------------------------------------

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
  if (!timestamp) return "";

  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

// ------------------------------------------
// RENDER A CHAT MESSAGE
// ------------------------------------------

function renderMessage(message) {
  if (!message || message.id == null) return;
  if (loadedMessageIds.has(message.id)) return;

  loadedMessageIds.add(message.id);

  // Remove the empty-state message when the first message arrives.
  const emptyState = messagesBox.querySelector(".empty-state");
  if (emptyState) emptyState.remove();

  const bubble = document.createElement("article");

  bubble.className =
    "message" +
    (
      currentUser && message.sender_id === currentUser.id
        ? " mine"
        : ""
    );

  const sender = document.createElement("div");
  sender.className = "sender";

  sender.textContent =
    currentUser && message.sender_id === currentUser.id
      ? "You"
      : "Group member";

  const body = document.createElement("div");
  body.className = "message-body";
  body.textContent = message.body ?? "";

  const time = document.createElement("div");
  time.className = "message-time";
  time.textContent = formatTime(message.created_at);

  bubble.append(sender, body, time);
  messagesBox.appendChild(bubble);

  messagesBox.scrollTop = messagesBox.scrollHeight;
}

// ------------------------------------------
// LOAD EXISTING MESSAGES
// ------------------------------------------

async function loadMessages() {
  setStatus("Loading messages...");

  const { data, error } = await db
    .from("messages")
    .select("id, sender_id, body, created_at")
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    setStatus(
      "Could not load messages: " + error.message,
      true
    );
    return;
  }

  messagesBox.replaceChildren();
  loadedMessageIds.clear();

  if (!data || data.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No messages yet. Start the conversation!";
    messagesBox.appendChild(empty);
  } else {
    data.forEach(renderMessage);
  }

  setStatus("Connected. New messages appear automatically.");
}

// ------------------------------------------
// REALTIME MESSAGE UPDATES
// ------------------------------------------

function subscribeToMessages() {
  if (realtimeChannel) {
    db.removeChannel(realtimeChannel);
    realtimeChannel = null;
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
      } else if (
        state === "CHANNEL_ERROR" ||
        state === "TIMED_OUT"
      ) {
        setStatus(
          "Live updates failed. Check Supabase Realtime settings.",
          true
        );
      }

      if (error) {
        console.error("Realtime error:", error);
      }
    });
}

// ------------------------------------------
// START CHAT AFTER AUTHENTICATION
// ------------------------------------------

async function startChat(user) {
  if (!user) return;

  currentUser = user;
  showChat();

  await loadMessages();
  subscribeToMessages();
}

// ------------------------------------------
// SIGN UP AND SIGN IN
// ------------------------------------------

authForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (authBusy) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showAuthMessage("Enter your email address and password.");
    return;
  }

  if (signupMode && password.length < 6) {
    showAuthMessage("Your password must contain at least 6 characters.");
    return;
  }

  if (
    GITHUB_PAGES_URL === "YOUR_GITHUB_PAGES_URL" ||
    !GITHUB_PAGES_URL.startsWith("https://")
  ) {
    showAuthMessage(
      "Please add your real GitHub Pages URL in script.js first."
    );
    return;
  }

  authBusy = true;
  authButton.disabled = true;
  switchAuth.disabled = true;

  showAuthMessage(
    signupMode ? "Creating your account..." : "Signing in...",
    false
  );

  try {
    if (signupMode) {
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: GITHUB_PAGES_URL
        }
      });

      if (error) throw error;

      if (data.session && data.user) {
        await startChat(data.user);

        showAuthMessage("", false);
      } else {
        setAuthMode(false);

        showAuthMessage(
          "Account request received. Check your email for the confirmation link. After confirming, return to this website and sign in.",
          false
        );
      }
    } else {
      const { data, error } = await db.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error("Sign in did not return a user account.");
      }

      await startChat(data.user);
      showAuthMessage("", false);
    }
  } catch (error) {
    console.error("Authentication error:", error);

    showAuthMessage(
      error.message || "Authentication failed. Please try again."
    );
  } finally {
    authBusy = false;
    authButton.disabled = false;
    switchAuth.disabled = false;
  }
});

// ------------------------------------------
// SEND A MESSAGE
// ------------------------------------------

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

    renderMessage(data);

    messageInput.value = "";
    messageInput.focus();

    setStatus("Message sent.");
  } catch (error) {
    console.error("Send message error:", error);

    setStatus(
      "Could not send message: " + error.message,
      true
    );
  } finally {
    sendButton.disabled = false;
  }
});

// ------------------------------------------
// SIGN OUT
// ------------------------------------------

signOutButton.addEventListener("click", async () => {
  signOutButton.disabled = true;

  try {
    const { error } = await db.auth.signOut();

    if (error) throw error;

    if (realtimeChannel) {
      await db.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }

    currentUser = null;
    showLogin();
    setAuthMode(false);

    showAuthMessage("You have signed out.", false);
  } catch (error) {
    console.error("Sign out error:", error);

    setStatus(
      "Could not sign out: " + error.message,
      true
    );
  } finally {
    signOutButton.disabled = false;
  }
});

// ------------------------------------------
// INITIALIZE APP AND RESTORE SESSION
// ------------------------------------------

async function initializeApp() {
  try {
    if (
      !window.supabase ||
      typeof window.supabase.createClient !== "function"
    ) {
      showLogin();
      showAuthMessage(
        "Supabase did not load. Check your internet connection and HTML script tags."
      );
      return;
    }

    if (
      SUPABASE_URL === "YOUR_SUPABASE_PROJECT_URL" ||
      SUPABASE_KEY === "YOUR_SUPABASE_PUBLISHABLE_KEY"
    ) {
      showLogin();
      showAuthMessage(
        "Add your Supabase project URL and publishable key in script.js."
      );
      return;
    }

    if (GITHUB_PAGES_URL === "https://github.com/aakashanandanofficial/Techssoft-group-chatApp/edit/main/script.js") {
      showLogin();
      showAuthMessage(
        "Add your GitHub Pages URL in script.js before signing up."
      );
      return;
    }

    const { data, error } = await db.auth.getSession();

    if (error) throw error;

    if (data.session && data.session.user) {
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

      // Supabase processes the email-confirmation redirect.
      // Restore the session when a session becomes available.
      if (event === "SIGNED_IN" && session && !currentUser) {
        startChat(session.user);
      }
    });
  } catch (error) {
    console.error("App initialization error:", error);

    showLogin();
    showAuthMessage(
      "Could not connect to Supabase: " + error.message
    );
  }
}

initializeApp();

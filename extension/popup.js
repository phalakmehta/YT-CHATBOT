const API = "http://127.0.0.1:5000";

const urlInput   = document.getElementById("urlInput");
const loadBtn    = document.getElementById("loadBtn");
const urlMeta    = document.getElementById("urlMeta");
const statusDot  = document.getElementById("statusDot");
const messages   = document.getElementById("messages");
const chatInput  = document.getElementById("chatInput");
const sendBtn    = document.getElementById("sendBtn");

let videoId = null;
let waiting = false;

// auto-resize textarea
chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 90) + "px";
});

// send on Enter (shift+enter = newline)
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) handleSend();
  }
});

// Load video
loadBtn.addEventListener("click", loadVideo);
urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") loadVideo(); });

async function loadVideo() {
  const url = urlInput.value.trim();
  if (!url) return;

  setLoading(true);
  urlMeta.textContent = "Fetching transcript & building index...";
  urlMeta.className = "url-meta";
  statusDot.className = "status-dot loading";

  try {
    const res  = await fetch(`${API}/load`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Failed to load video");

    videoId = data.video_id;
    urlMeta.textContent = `Ready  ·  ID: ${videoId}`;
    urlMeta.className   = "url-meta ok";
    statusDot.className = "status-dot ready";

    chatInput.disabled = false;
    sendBtn.disabled   = false;
    chatInput.focus();
    clearMessages();
    addSystemMsg("Video loaded. Ask me anything about it!");

  } catch (err) {
    urlMeta.textContent = `Error: ${err.message}`;
    urlMeta.className   = "url-meta err";
    statusDot.className = "status-dot";
  } finally {
    setLoading(false);
  }
}

// Send message
sendBtn.addEventListener("click", handleSend);

async function handleSend() {
  const question = chatInput.value.trim();
  if (!question || waiting || !videoId) return;

  waiting = true;
  sendBtn.disabled = true;
  chatInput.value  = "";
  chatInput.style.height = "auto";

  addMsg("user", question);
  const typingEl = addTyping();

  try {
    const res  = await fetch(`${API}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: videoId, question }),
    });
    const data = await res.json();
    typingEl.remove();

    if (!res.ok) throw new Error(data.error || "Server error");
    addMsg("bot", data.answer);

  } catch (err) {
    typingEl.remove();
    addMsg("bot", `Error: ${err.message}`);
  } finally {
    waiting = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

// Helpers
function setLoading(on) {
  loadBtn.disabled = on;
  loadBtn.textContent = on ? "Loading..." : "Load";
}

function clearMessages() {
  messages.innerHTML = "";
}

function addSystemMsg(text) {
  const div = document.createElement("div");
  div.style.cssText = "text-align:center;font-size:11px;color:var(--muted);padding:4px 0;";
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function addMsg(role, text) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;

  const label = document.createElement("div");
  label.className = "msg-label";
  label.textContent = role === "user" ? "You" : "Assistant";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.textContent = text;

  wrap.appendChild(label);
  wrap.appendChild(bubble);
  messages.appendChild(wrap);
  messages.scrollTop = messages.scrollHeight;
  return wrap;
}

function addTyping() {
  const wrap = document.createElement("div");
  wrap.className = "msg bot";

  const label = document.createElement("div");
  label.className = "msg-label";
  label.textContent = "Assistant";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble typing";
  bubble.innerHTML = "<span></span><span></span><span></span>";

  wrap.appendChild(label);
  wrap.appendChild(bubble);
  messages.appendChild(wrap);
  messages.scrollTop = messages.scrollHeight;
  return wrap;
}

// Pre-fill URL if on YouTube
try {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0]?.url || "";
    if (url.includes("youtube.com/watch") || url.includes("youtu.be")) {
      urlInput.value = url;
    }
  });
} catch (_) {}

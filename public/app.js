import { AgentClient } from "https://esm.sh/agents/client";

const statusEl = document.getElementById("connectionStatus");
const statusDot = statusEl.querySelector(".status-dot");

const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const displayNameInput = document.getElementById("displayName");
const toneInput = document.getElementById("tone");
const voiceBtn = document.getElementById("voiceBtn");
const sendBtn = document.querySelector("#chatForm button.primary");

const profileView = document.getElementById("profileView");
const updatedView = document.getElementById("updatedView");
const historyView = document.getElementById("historyView");
const workflowStatus = document.getElementById("workflowStatus");
const briefInput = document.getElementById("briefInput");
const briefGoal = document.getElementById("briefGoal");
const briefBtn = document.getElementById("briefBtn");
const briefOutput = document.getElementById("briefOutput");

const sessionId = (() => {
  const existing = localStorage.getItem("cf_ai_session");
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  localStorage.setItem("cf_ai_session", fresh);
  return fresh;
})();

let isConnected = false;
let voiceSupported = false;

function setStatus(text, connected) {
  statusEl.querySelector("span:last-child").textContent = text;
  statusDot.style.background = connected ? "#2fbf71" : "#f29f3f";
  statusDot.style.boxShadow = connected
    ? "0 0 0 6px rgba(47, 191, 113, 0.25)"
    : "0 0 0 6px rgba(242, 159, 63, 0.25)";
}

function setControlsEnabled(enabled) {
  if (sendBtn) sendBtn.disabled = !enabled;
  if (briefBtn) briefBtn.disabled = !enabled;
  if (voiceSupported && voiceBtn) voiceBtn.disabled = !enabled;
}

function addMessage(role, text) {
  const wrapper = document.createElement("div");
  wrapper.className = `chat-message ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  wrapper.appendChild(bubble);
  chatLog.appendChild(wrapper);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function renderState(state) {
  if (!state) return;
  const profile = state.profile || {};
  profileView.textContent = `${profile.displayName ?? "Guest"} - ${profile.tone ?? "concise"} - ${
    profile.locale ?? "en-GB"
  }`;

  updatedView.textContent = state.lastUpdatedAt
    ? new Date(state.lastUpdatedAt).toLocaleString()
    : "-";

  const recent = (state.history || []).slice(-3).map((item) => item.content).join(" / ");
  historyView.textContent = recent || "-";

  if (state.workflow) {
    const wf = state.workflow;
    workflowStatus.textContent = `${wf.status ?? "idle"}${wf.message ? ` - ${wf.message}` : ""}`;
  }

  if (state.lastBrief) {
    const brief = state.lastBrief;
    briefOutput.textContent = [
      `Topic: ${brief.topic}`,
      brief.goal ? `Goal: ${brief.goal}` : null,
      "",
      "Outline:",
      brief.outline,
      "",
      "Brief:",
      brief.brief
    ]
      .filter(Boolean)
      .join("\n");
  }
}

const client = new AgentClient({
  agent: "CompassAgent",
  name: sessionId,
  host: window.location.host,
  onStateUpdate: (state) => renderState(state)
});

setControlsEnabled(false);

client.addEventListener("open", () => {
  isConnected = true;
  setStatus("Connected", true);
  setControlsEnabled(true);
});
client.addEventListener("close", () => {
  isConnected = false;
  setStatus("Disconnected", false);
  setControlsEnabled(false);
});
client.addEventListener("error", (event) => {
  isConnected = false;
  console.error("Agent connection error:", event);
  setStatus("Connection error", false);
  setControlsEnabled(false);
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message) return;

  addMessage("user", message);
  messageInput.value = "";

  if (!isConnected) {
    addMessage("assistant", "Not connected yet. Please wait a moment and try again.");
    return;
  }

  try {
    const response = await client.call("chat", [
      message,
      {
        displayName: displayNameInput.value || "Guest",
        tone: toneInput.value,
        locale: navigator.language
      }
    ]);

    if (response?.reply) {
      addMessage("assistant", response.reply);
    }
  } catch (error) {
    console.error("Chat RPC failed:", error);
    const errorMessage = error?.message ?? String(error);
    addMessage("assistant", `Chat error: ${errorMessage}`);
  }
});

briefBtn.addEventListener("click", async (event) => {
  event.preventDefault();
  const topic = briefInput.value.trim();
  if (!topic) return;
  const goal = briefGoal.value.trim();

  workflowStatus.textContent = "Starting workflow...";

  if (!isConnected) {
    workflowStatus.textContent = "Not connected yet. Please wait and try again.";
    return;
  }

  try {
    await client.call("startBriefWorkflow", [
      {
        topic,
        goal: goal || undefined,
        tone: toneInput.value
      }
    ]);
  } catch (error) {
    console.error("Workflow RPC failed:", error);
    const errorMessage = error?.message ?? String(error);
    workflowStatus.textContent = `Workflow error: ${errorMessage}`;
  }
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
  voiceBtn.textContent = "Voice unsupported";
  voiceBtn.disabled = true;
} else {
  voiceSupported = true;
  const recognizer = new SpeechRecognition();
  recognizer.lang = navigator.language || "en-GB";
  recognizer.interimResults = true;

  recognizer.addEventListener("result", (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0]?.transcript ?? "")
      .join("");
    messageInput.value = transcript;
  });

  const startRecording = () => {
    voiceBtn.classList.add("recording");
    recognizer.start();
  };

  const stopRecording = () => {
    voiceBtn.classList.remove("recording");
    recognizer.stop();
  };

  voiceBtn.addEventListener("mousedown", startRecording);
  voiceBtn.addEventListener("touchstart", startRecording);
  voiceBtn.addEventListener("mouseup", stopRecording);
  voiceBtn.addEventListener("mouseleave", stopRecording);
  voiceBtn.addEventListener("touchend", stopRecording);

  setControlsEnabled(isConnected);
}

setStatus("Connecting to agent...", false);


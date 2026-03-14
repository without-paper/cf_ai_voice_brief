import { Agent, callable } from "agents";
import type { AgentState, Brief, ChatMessage, Env, Profile, Tone, WorkflowStatus } from "./types";

const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const HISTORY_LIMIT = 12;

function nowIso() {
  return new Date().toISOString();
}

function trimHistory(history: ChatMessage[]) {
  if (history.length <= HISTORY_LIMIT) return history;
  return history.slice(history.length - HISTORY_LIMIT);
}

function buildSystemPrompt(profile: Profile, lastBrief?: Brief) {
  const briefHint = lastBrief
    ? `Last brief topic: ${lastBrief.topic}. Goal: ${lastBrief.goal ?? "unspecified"}.`
    : "No briefs yet.";
  return [
    "You are Compass, a calm, practical AI assistant.",
    "Always respond in English, regardless of the user's input language.",
    `Tone: ${profile.tone}.`,
    `User display name: ${profile.displayName}.`,
    `Locale: ${profile.locale}.`,
    briefHint,
    "Be concise, ask one clarifying question if needed, and end with a short next step."
  ].join(" ");
}

function extractText(result: unknown): string {
  if (!result) return "";
  if (typeof result === "string") return result;
  if (typeof result === "object") {
    const anyResult = result as Record<string, any>;
    if (typeof anyResult.response === "string") return anyResult.response;
    if (typeof anyResult.result?.response === "string") return anyResult.result.response;
    if (typeof anyResult.result?.text === "string") return anyResult.result.text;
    if (typeof anyResult.message?.content === "string") return anyResult.message.content;
    const outputText = anyResult.output?.[0]?.content?.[0]?.text;
    if (typeof outputText === "string") return outputText;
  }
  return JSON.stringify(result);
}

function mergeProfile(current: Profile, update?: Partial<Profile>) {
  if (!update) return current;
  return {
    displayName: update.displayName ?? current.displayName,
    tone: (update.tone as Tone) ?? current.tone,
    locale: update.locale ?? current.locale
  };
}

export class CompassAgent extends Agent<Env, AgentState> {
  initialState: AgentState = {
    profile: {
      displayName: "Guest",
      tone: "concise",
      locale: "en-US"
    },
    history: [],
    workflow: {
      status: "idle"
    },
    lastUpdatedAt: nowIso()
  };

  @callable()
  async chat(message: string, profileUpdate?: Partial<Profile>) {
    const updatedProfile = mergeProfile(this.state.profile, profileUpdate);

    const history: ChatMessage[] = trimHistory([
      ...this.state.history,
      { role: "user", content: message, timestamp: nowIso() }
    ]);

    const systemPrompt = buildSystemPrompt(updatedProfile, this.state.lastBrief);

    const response = await this.env.AI.run(MODEL_ID, {
      messages: [
        { role: "system", content: systemPrompt },
        ...history.map((entry) => ({ role: entry.role, content: entry.content }))
      ],
      temperature: 0.6,
      max_tokens: 512
    });

    const assistantText = extractText(response).trim();

    const updatedHistory = trimHistory([
      ...history,
      { role: "assistant", content: assistantText, timestamp: nowIso() }
    ]);

    this.setState({
      ...this.state,
      profile: updatedProfile,
      history: updatedHistory,
      lastUpdatedAt: nowIso()
    });

    return {
      reply: assistantText,
      profile: updatedProfile
    };
  }

  @callable()
  async startBriefWorkflow(input: { topic: string; goal?: string; tone?: Tone }) {
    const instanceId = await this.runWorkflow("BRIEF_WORKFLOW", {
      ...input,
      profile: this.state.profile,
      history: this.state.history
    });

    const workflow: WorkflowStatus = {
      id: instanceId,
      status: "running",
      step: "queued",
      message: "Workflow queued"
    };

    this.setState({
      ...this.state,
      workflow,
      lastUpdatedAt: nowIso()
    });

    return { instanceId };
  }

  @callable()
  getState() {
    return this.state;
  }

  async onWorkflowProgress(_workflowName: string, instanceId: string, progress: WorkflowStatus) {
    this.setState({
      ...this.state,
      workflow: {
        ...progress,
        id: instanceId,
        status: "running"
      },
      lastUpdatedAt: nowIso()
    });
  }

  async onWorkflowEvent(_workflowName: string, _instanceId: string, event: { type: string; payload?: Brief }) {
    if (event.type === "brief-complete" && event.payload) {
      this.setState({
        ...this.state,
        lastBrief: event.payload,
        workflow: {
          ...this.state.workflow,
          status: "complete",
          message: "Brief ready"
        },
        lastUpdatedAt: nowIso()
      });
    }
  }

  async onWorkflowComplete(_workflowName: string, instanceId: string) {
    this.setState({
      ...this.state,
      workflow: {
        ...this.state.workflow,
        id: instanceId,
        status: "complete",
        message: this.state.workflow.message ?? "Workflow complete"
      },
      lastUpdatedAt: nowIso()
    });
  }

  async onWorkflowError(_workflowName: string, instanceId: string, error: Error) {
    this.setState({
      ...this.state,
      workflow: {
        id: instanceId,
        status: "error",
        message: error.message
      },
      lastUpdatedAt: nowIso()
    });
  }
}



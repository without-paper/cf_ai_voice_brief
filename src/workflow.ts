import { AgentWorkflow } from "agents/workflows";
import type { Brief, ChatMessage, Env, Profile, Tone, WorkflowStatus } from "./types";
import type { CompassAgent } from "./agent";

const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

type BriefInput = {
  topic: string;
  goal?: string;
  tone?: Tone;
  profile: Profile;
  history: ChatMessage[];
};

function nowIso() {
  return new Date().toISOString();
}

export class BriefWorkflow extends AgentWorkflow<CompassAgent, BriefInput, WorkflowStatus, Env> {
  async run(event: { payload: BriefInput }, step: WorkflowStep) {
    const { topic, goal, tone, profile, history } = event.payload;

    await this.reportProgress({
      status: "running",
      step: "outline",
      message: "Drafting an outline",
      percent: 25
    });

    const outline = await step.do("outline", async () => {
      const response = await this.env.AI.run(MODEL_ID, {
        messages: [
          {
            role: "system",
            content:
              "You create compact outlines for action briefs. Return 4-6 bullets, no extra prose."
          },
          {
            role: "user",
            content: `Topic: ${topic}. Goal: ${goal ?? "none"}. Tone: ${tone ?? profile.tone}.`
          }
        ],
        temperature: 0.4,
        max_tokens: 256
      });
      return response;
    });

    await this.reportProgress({
      status: "running",
      step: "brief",
      message: "Composing the brief",
      percent: 70
    });

    const brief = await step.do("brief", async () => {
      const response = await this.env.AI.run(MODEL_ID, {
        messages: [
          {
            role: "system",
            content:
              "You write a short, structured action brief with sections: Summary, Key Moves, Risks, Next Step."
          },
          {
            role: "user",
            content: [
              `Topic: ${topic}.`,
              `Goal: ${goal ?? "none"}.`,
              `Preferred tone: ${tone ?? profile.tone}.`,
              `Recent user context: ${history.map((item) => item.content).slice(-3).join(" | ")}`,
              `Outline: ${extractText(outline)}`
            ].join(" ")
          }
        ],
        temperature: 0.5,
        max_tokens: 512
      });
      return response;
    });

    await this.reportProgress({
      status: "running",
      step: "finalize",
      message: "Finalizing and syncing memory",
      percent: 95
    });

    const briefPayload: Brief = {
      topic,
      goal,
      outline: extractText(outline).trim(),
      brief: extractText(brief).trim(),
      createdAt: nowIso()
    };

    await step.sendEvent({
      type: "brief-complete",
      payload: briefPayload
    });

    await step.reportComplete({
      status: "complete",
      step: "complete",
      message: "Brief ready",
      percent: 100
    });

    return briefPayload;
  }
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

type WorkflowStep = {
  do: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
  reportComplete: (progress: WorkflowStatus) => Promise<void>;
  sendEvent: (event: { type: string; payload?: Brief }) => Promise<void>;
};



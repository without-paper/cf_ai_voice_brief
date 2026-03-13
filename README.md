# Compass Voice Brief

An AI-powered Cloudflare Agents app that turns chat or voice notes into structured action briefs. It uses Llama 3.3 on Workers AI, a Workflow for multi-step brief generation, and Durable Object-backed Agent state for memory.

## Overview

- **LLM**: Uses Llama 3.3 on Workers AI via `env.AI.run()`.
- **Workflow / coordination**: A `BriefWorkflow` (Cloudflare Workflows) orchestrates a multi-step outline + brief pipeline.
- **User input**: Browser UI supports chat plus voice dictation (Web Speech API) and connects over the Agents Client SDK.
- **Memory / state**: The Agent persists profile, history, and last brief in durable state and syncs it to clients.

## Key files

- `src\agent.ts`: Agent logic, LLM calls, memory/state, workflow hooks.
- `src\workflow.ts`: Workflow steps that generate the outline and brief.
- `public\app.js`: Voice + chat UI and AgentClient wiring.

## Running locally

### 1) Install dependencies

```
npm install
```

### 2) Start local dev

```
npm run dev
```

Wrangler will start the Worker locally (http://127.0.0.1:8787). Workers AI runs remotely via the `ai.remote: true` binding in `wrangler.jsonc`. Workflows require local dev and are **not** supported with `wrangler dev --remote`, so keep the default local mode (Wrangler v3.89.0+ recommended).

### 3) Try the app

- Open the URL from Wrangler (usually http://127.0.0.1:8787).
- Type a message or hold the mic button to dictate.
- Click **Generate brief** to start a Workflow and watch the memory panel update.

## Deploy

```
npm run deploy
```

import { routeAgentRequest } from "agents";
import type { Env } from "./types";

export { CompassAgent } from "./agent";
export { BriefWorkflow } from "./workflow";

const handler: ExportedHandler<Env> = {
  async fetch(request, env) {
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) {
      return agentResponse;
    }

    return env.ASSETS.fetch(request);
  }
};

export default handler;

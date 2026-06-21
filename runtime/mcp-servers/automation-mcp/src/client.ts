export interface Workflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  nodes: unknown[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
  tags?: Array<{ id: string; name: string }>;
}

export interface CreateWorkflowPayload {
  name: string;
  nodes: unknown[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface Execution {
  id: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  workflowId: string;
  status?: string;
}

export interface ExecutionDetail extends Execution {
  data?: {
    resultData: {
      runData: Record<string, unknown[]>;
      error?: { message: string; lastNodeExecuted?: string };
    };
  };
}

export interface N8nConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
}

type CollectionResponse<T> = {
  data: T[];
  nextCursor?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizeCollectionResponse<T>(value: unknown): CollectionResponse<T> {
  if (Array.isArray(value)) {
    return { data: value as T[] };
  }

  if (!isRecord(value)) {
    throw new Error(`Unexpected list response shape: ${JSON.stringify(value)}`);
  }

  if (Array.isArray(value.data)) {
    return {
      data: value.data as T[],
      nextCursor: asString(value.nextCursor)
    };
  }

  if (Array.isArray(value.items)) {
    return {
      data: value.items as T[],
      nextCursor: asString(value.nextCursor)
    };
  }

  throw new Error(`Unexpected list response shape: ${JSON.stringify(value)}`);
}

export class N8nClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor(config: N8nConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.timeout = config.timeout;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.apiKey) {
      throw new Error("Missing n8n API key. Set --api-key or APEX_N8N_API_KEY.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-N8N-API-KEY": this.apiKey
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      });

      const responseText = await response.text();

      if (!response.ok) {
        const message = responseText.trim() || "<empty response body>";
        throw new Error(
          `n8n API ${method} ${path} failed with ${response.status} ${response.statusText}: ${message}`
        );
      }

      if (!responseText.trim()) {
        return undefined as T;
      }

      try {
        return JSON.parse(responseText) as T;
      } catch (error) {
        throw new Error(
          `n8n API ${method} ${path} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`n8n API ${method} ${path} timed out after ${this.timeout}ms`);
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async listWorkflows(limit = 25, cursor?: string): Promise<CollectionResponse<Workflow>> {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (cursor) {
      params.set("cursor", cursor);
    }

    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    const response = await this.request<unknown>("GET", `/workflows${suffix}`);
    return normalizeCollectionResponse<Workflow>(response);
  }

  async getWorkflow(id: string): Promise<Workflow> {
    return this.request<Workflow>("GET", `/workflows/${encodeURIComponent(id)}`);
  }

  async createWorkflow(payload: CreateWorkflowPayload): Promise<Workflow> {
    return this.request<Workflow>("POST", "/workflows", payload);
  }

  async updateWorkflow(id: string, payload: Partial<CreateWorkflowPayload>): Promise<Workflow> {
    return this.request<Workflow>("PUT", `/workflows/${encodeURIComponent(id)}`, payload);
  }

  async activateWorkflow(id: string): Promise<Workflow> {
    return this.request<Workflow>("POST", `/workflows/${encodeURIComponent(id)}/activate`);
  }

  async deactivateWorkflow(id: string): Promise<Workflow> {
    return this.request<Workflow>("POST", `/workflows/${encodeURIComponent(id)}/deactivate`);
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.request("DELETE", `/workflows/${encodeURIComponent(id)}`);
  }

  async executeWorkflow(id: string, data?: Record<string, unknown>): Promise<Execution> {
    return this.request<Execution>("POST", `/workflows/${encodeURIComponent(id)}/execute`, data ?? {});
  }

  async listExecutions(
    workflowId?: string,
    status?: string,
    limit = 25,
    cursor?: string
  ): Promise<CollectionResponse<Execution>> {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (workflowId) {
      params.set("workflowId", workflowId);
    }
    if (status) {
      params.set("status", status);
    }
    if (cursor) {
      params.set("cursor", cursor);
    }

    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    const response = await this.request<unknown>("GET", `/executions${suffix}`);
    return normalizeCollectionResponse<Execution>(response);
  }

  async getExecution(id: string): Promise<ExecutionDetail> {
    return this.request<ExecutionDetail>(
      "GET",
      `/executions/${encodeURIComponent(id)}?includeData=true`
    );
  }
}

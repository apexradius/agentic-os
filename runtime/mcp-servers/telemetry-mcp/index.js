const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.APEX_TELEMETRY_DB_PATH || path.join(require('os').homedir(), '.apex-telemetry', 'os.db');
if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new sqlite3.Database(dbPath);

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function ensureColumn(table, column, definition) {
  const columns = await dbAll(`PRAGMA table_info(${table})`);
  if (!columns.some(row => row.name === column)) {
    await dbRun(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

async function initializeSchema() {
  await dbRun(`CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    agent TEXT,
    action_type TEXT,
    description TEXT,
    revenue_stream TEXT,
    actor TEXT,
    action TEXT,
    subject TEXT,
    status TEXT DEFAULT 'ok',
    details_json TEXT DEFAULT '{}',
    source TEXT DEFAULT 'mcp'
  )`);

  await ensureColumn('actions', 'actor', "actor TEXT");
  await ensureColumn('actions', 'action', "action TEXT");
  await ensureColumn('actions', 'subject', "subject TEXT");
  await ensureColumn('actions', 'status', "status TEXT DEFAULT 'ok'");
  await ensureColumn('actions', 'details_json', "details_json TEXT DEFAULT '{}'");
  await ensureColumn('actions', 'source', "source TEXT DEFAULT 'mcp'");

  await dbRun(`CREATE TABLE IF NOT EXISTS errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    actor TEXT,
    error_type TEXT,
    message TEXT NOT NULL,
    stack TEXT,
    severity TEXT DEFAULT 'error',
    context_json TEXT DEFAULT '{}',
    resolved INTEGER DEFAULT 0
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS revenue_attribution (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    revenue_stream TEXT NOT NULL,
    subject TEXT,
    event_type TEXT NOT NULL,
    amount_cents INTEGER,
    currency TEXT DEFAULT 'CAD',
    details_json TEXT DEFAULT '{}'
  )`);
}

const schemaReady = initializeSchema();

function stringify(value) {
  return JSON.stringify(value || {});
}

function text(content, isError = false) {
  return {
    content: [{ type: "text", text: content }],
    isError,
  };
}

const server = new Server({
  name: "apex-telemetry-mcp",
  version: "1.0.0",
}, {
  capabilities: {
    tools: {},
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "telemetry_log_action",
        description: "Log a significant agent action, decision, or completion to the OS telemetry database.",
        inputSchema: {
          type: "object",
          properties: {
            agent: { type: "string", description: "Name of the agent or role (e.g., 'Architect', 'generalist')" },
            action_type: { type: "string", description: "Type of action: 'plan', 'implement', 'verify', 'error'" },
            description: { type: "string", description: "Brief description of the action" },
            revenue_stream: { type: "string", description: "The business line or project this impacts (e.g., 'consulting', 'products', 'services')" },
            actor: { type: "string", description: "Actor that performed the action" },
            action: { type: "string", description: "Short verb-noun action name" },
            subject: { type: "string", description: "System, task, or artifact acted on" },
            status: { type: "string", enum: ["ok", "failed", "partial"], description: "Outcome status" },
            details: { type: "object", description: "Structured action metadata" },
            source: { type: "string", description: "Source of the telemetry event" }
          }
        }
      },
      {
        name: "telemetry_log_error",
        description: "Log an error, exception, or failed automation outcome to the telemetry database.",
        inputSchema: {
          type: "object",
          properties: {
            actor: { type: "string", description: "Actor or service that observed the error" },
            error_type: { type: "string", description: "Short error category" },
            message: { type: "string", description: "Human-readable error message" },
            stack: { type: "string", description: "Optional stack trace or command context" },
            severity: { type: "string", enum: ["info", "warning", "error", "critical"], description: "Error severity" },
            context: { type: "object", description: "Structured error context" }
          },
          required: ["message"]
        }
      },
      {
        name: "telemetry_log_revenue_attribution",
        description: "Log a revenue-attribution event tied to a Q2 revenue stream.",
        inputSchema: {
          type: "object",
          properties: {
            revenue_stream: { type: "string", description: "Q2 revenue stream or business line" },
            subject: { type: "string", description: "Campaign, customer, product, or task being attributed" },
            event_type: { type: "string", description: "Attribution event type" },
            amount_cents: { type: "integer", description: "Optional amount in cents" },
            currency: { type: "string", description: "ISO currency code, default CAD" },
            details: { type: "object", description: "Structured attribution metadata" }
          },
          required: ["revenue_stream", "event_type"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "telemetry_log_action") {
    const args = request.params.arguments || {};
    const actor = args.actor || args.agent || "unknown";
    const action = args.action || args.action_type;
    const subject = args.subject || args.description || action;
    const status = args.status || "ok";
    const description = args.description || subject || "";

    if (!action && !description) {
      return text("Error logging telemetry: action or description is required.", true);
    }

    try {
      await schemaReady;
      const result = await dbRun(
        `INSERT INTO actions (
          agent, action_type, description, revenue_stream,
          actor, action, subject, status, details_json, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          args.agent || actor,
          args.action_type || action || "action",
          description,
          args.revenue_stream || null,
          actor,
          action || args.action_type || "action",
          subject,
          status,
          stringify(args.details),
          args.source || "mcp",
        ],
      );
      return text(`Telemetry action logged successfully with ID ${result.lastID}.`);
    } catch (err) {
      return text(`Error logging telemetry action: ${err.message}`, true);
    }
  }

  if (request.params.name === "telemetry_log_error") {
    const args = request.params.arguments || {};
    if (!args.message) {
      return text("Error logging telemetry error: message is required.", true);
    }

    try {
      await schemaReady;
      const result = await dbRun(
        `INSERT INTO errors (actor, error_type, message, stack, severity, context_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          args.actor || "unknown",
          args.error_type || "error",
          args.message,
          args.stack || null,
          args.severity || "error",
          stringify(args.context),
        ],
      );
      return text(`Telemetry error logged successfully with ID ${result.lastID}.`);
    } catch (err) {
      return text(`Error logging telemetry error: ${err.message}`, true);
    }
  }

  if (request.params.name === "telemetry_log_revenue_attribution") {
    const args = request.params.arguments || {};
    if (!args.revenue_stream || !args.event_type) {
      return text("Error logging revenue attribution: revenue_stream and event_type are required.", true);
    }

    try {
      await schemaReady;
      const result = await dbRun(
        `INSERT INTO revenue_attribution (
          revenue_stream, subject, event_type, amount_cents, currency, details_json
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          args.revenue_stream,
          args.subject || null,
          args.event_type,
          args.amount_cents ?? null,
          args.currency || "CAD",
          stringify(args.details),
        ],
      );
      return text(`Telemetry revenue attribution logged successfully with ID ${result.lastID}.`);
    } catch (err) {
      return text(`Error logging revenue attribution: ${err.message}`, true);
    }
  }
  
  return text("Unknown tool", true);
});

async function main() {
  await schemaReady;
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Apex Telemetry MCP Server running on stdio");
}

main().catch(console.error);

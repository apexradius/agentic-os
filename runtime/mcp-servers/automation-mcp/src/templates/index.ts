import type { CreateWorkflowPayload } from "../client.js";

type TemplateCategory = "email" | "shopify" | "crm" | "webhook" | "social";

interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  continueOnFail?: boolean;
}

type ConnectionTarget = {
  node: string;
  type: string;
  index: number;
};

type WorkflowConnections = Record<
  string,
  {
    main: ConnectionTarget[][];
  }
>;

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  workflow: CreateWorkflowPayload;
}

function node(
  id: string,
  name: string,
  type: string,
  position: [number, number],
  parameters: Record<string, unknown> = {},
  extras: Partial<WorkflowNode> = {}
): WorkflowNode {
  return {
    id,
    name,
    type,
    typeVersion: 1,
    position,
    parameters,
    ...extras
  };
}

function workflow(
  name: string,
  nodes: WorkflowNode[],
  connections: WorkflowConnections,
  settings?: Record<string, unknown>
): CreateWorkflowPayload {
  return {
    name,
    nodes,
    connections,
    settings: settings ?? {
      executionOrder: "v1",
      saveManualExecutions: true
    }
  };
}

export const EMAIL_WELCOME_SEQUENCE: Template = {
  id: "email-welcome-sequence",
  name: "Email Welcome Sequence",
  description: "Three-email onboarding series spaced across the first 48 hours.",
  category: "email",
  workflow: workflow(
    "Email Welcome Sequence",
    [
      node("1", "Start", "n8n-nodes-base.manualTrigger", [220, 300]),
      node("2", "Wait Immediately", "n8n-nodes-base.wait", [440, 300], {
        amount: 0,
        unit: "hours"
      }),
      node("3", "Send Welcome Email", "n8n-nodes-base.emailSend", [680, 300], {
        fromEmail: "automation@example.com",
        toEmail: "={{$json.email}}",
        subject: "Welcome",
        emailFormat: "text",
        text: "Welcome aboard. Here is what happens next and how to get value immediately."
      }),
      node("4", "Wait 24 Hours", "n8n-nodes-base.wait", [920, 300], {
        amount: 24,
        unit: "hours"
      }),
      node("5", "Send Value Email", "n8n-nodes-base.emailSend", [1160, 300], {
        fromEmail: "automation@example.com",
        toEmail: "={{$json.email}}",
        subject: "3 ways to get your first result",
        emailFormat: "text",
        text: "Here are the fastest wins, the core workflow, and the first metric to watch."
      }),
      node("6", "Wait 48 Hours", "n8n-nodes-base.wait", [1400, 300], {
        amount: 48,
        unit: "hours"
      }),
      node("7", "Send Conversion Email", "n8n-nodes-base.emailSend", [1640, 300], {
        fromEmail: "automation@example.com",
        toEmail: "={{$json.email}}",
        subject: "Ready for the next step?",
        emailFormat: "text",
        text: "Book your setup, activate your account, or reply with your top priority."
      })
    ],
    {
      Start: { main: [[{ node: "Wait Immediately", type: "main", index: 0 }]] },
      "Wait Immediately": { main: [[{ node: "Send Welcome Email", type: "main", index: 0 }]] },
      "Send Welcome Email": { main: [[{ node: "Wait 24 Hours", type: "main", index: 0 }]] },
      "Wait 24 Hours": { main: [[{ node: "Send Value Email", type: "main", index: 0 }]] },
      "Send Value Email": { main: [[{ node: "Wait 48 Hours", type: "main", index: 0 }]] },
      "Wait 48 Hours": { main: [[{ node: "Send Conversion Email", type: "main", index: 0 }]] }
    }
  )
};

export const LEAD_NURTURE_DRIP: Template = {
  id: "lead-nurture-drip",
  name: "Lead Nurture Drip",
  description: "Seven-day nurture sequence with branching for opens and clicks.",
  category: "email",
  workflow: workflow(
    "Lead Nurture Drip",
    [
      node("1", "Start", "n8n-nodes-base.manualTrigger", [180, 320]),
      node("2", "Send Day 1 Email", "n8n-nodes-base.emailSend", [420, 320], {
        fromEmail: "automation@example.com",
        toEmail: "={{$json.email}}",
        subject: "Your roadmap starts here",
        emailFormat: "text",
        text: "This is the first step of a seven-day nurture designed to move qualified leads to action."
      }),
      node("3", "Wait 2 Days", "n8n-nodes-base.wait", [660, 320], {
        amount: 48,
        unit: "hours"
      }),
      node("4", "If Email Opened", "n8n-nodes-base.if", [900, 320], {
        conditions: {
          boolean: [
            {
              value1: "={{$json.opened}}",
              operation: "isTrue"
            }
          ]
        }
      }),
      node("5", "If Link Clicked", "n8n-nodes-base.if", [1140, 220], {
        conditions: {
          boolean: [
            {
              value1: "={{$json.clicked}}",
              operation: "isTrue"
            }
          ]
        }
      }),
      node("6", "Send Engaged Offer", "n8n-nodes-base.emailSend", [1380, 120], {
        fromEmail: "automation@example.com",
        toEmail: "={{$json.email}}",
        subject: "You looked interested. Here is the direct path.",
        emailFormat: "text",
        text: "Since you clicked through, here is the tailored next step and a direct offer."
      }),
      node("7", "Send Education Email", "n8n-nodes-base.emailSend", [1380, 320], {
        fromEmail: "automation@example.com",
        toEmail: "={{$json.email}}",
        subject: "Case study and proof",
        emailFormat: "text",
        text: "You opened but did not click. Here is the proof, process, and example result."
      }),
      node("8", "Send Re-Engagement Email", "n8n-nodes-base.emailSend", [1140, 480], {
        fromEmail: "automation@example.com",
        toEmail: "={{$json.email}}",
        subject: "Still relevant?",
        emailFormat: "text",
        text: "A quick reminder that the opportunity is still open if this is still a priority."
      }),
      node("9", "Wait Until Day 7", "n8n-nodes-base.wait", [1620, 320], {
        amount: 120,
        unit: "hours"
      }),
      node("10", "Send Final CTA", "n8n-nodes-base.emailSend", [1860, 320], {
        fromEmail: "automation@example.com",
        toEmail: "={{$json.email}}",
        subject: "Final call to move forward",
        emailFormat: "text",
        text: "This closes the seven-day sequence with a clear CTA and simple reply path."
      })
    ],
    {
      Start: { main: [[{ node: "Send Day 1 Email", type: "main", index: 0 }]] },
      "Send Day 1 Email": { main: [[{ node: "Wait 2 Days", type: "main", index: 0 }]] },
      "Wait 2 Days": { main: [[{ node: "If Email Opened", type: "main", index: 0 }]] },
      "If Email Opened": {
        main: [
          [{ node: "If Link Clicked", type: "main", index: 0 }],
          [{ node: "Send Re-Engagement Email", type: "main", index: 0 }]
        ]
      },
      "If Link Clicked": {
        main: [
          [{ node: "Send Engaged Offer", type: "main", index: 0 }],
          [{ node: "Send Education Email", type: "main", index: 0 }]
        ]
      },
      "Send Engaged Offer": { main: [[{ node: "Wait Until Day 7", type: "main", index: 0 }]] },
      "Send Education Email": { main: [[{ node: "Wait Until Day 7", type: "main", index: 0 }]] },
      "Send Re-Engagement Email": { main: [[{ node: "Wait Until Day 7", type: "main", index: 0 }]] },
      "Wait Until Day 7": { main: [[{ node: "Send Final CTA", type: "main", index: 0 }]] }
    }
  )
};

export const SHOPIFY_ABANDONED_CART: Template = {
  id: "shopify-abandoned-cart",
  name: "Shopify Abandoned Cart Recovery",
  description: "Recover abandoned carts one hour after a Shopify webhook fires.",
  category: "shopify",
  workflow: workflow(
    "Shopify Abandoned Cart Recovery",
    [
      node("1", "Cart Webhook", "n8n-nodes-base.webhook", [220, 300], {
        path: "shopify-abandoned-cart",
        httpMethod: "POST",
        responseMode: "lastNode"
      }),
      node("2", "Wait 1 Hour", "n8n-nodes-base.wait", [460, 300], {
        amount: 1,
        unit: "hours"
      }),
      node("3", "Send Recovery Email", "n8n-nodes-base.emailSend", [700, 300], {
        fromEmail: "store@example.com",
        toEmail: "={{$json.customer.email}}",
        subject: "Your cart is still waiting",
        emailFormat: "text",
        text: "You left items in your cart. Complete checkout and pick up where you left off."
      })
    ],
    {
      "Cart Webhook": { main: [[{ node: "Wait 1 Hour", type: "main", index: 0 }]] },
      "Wait 1 Hour": { main: [[{ node: "Send Recovery Email", type: "main", index: 0 }]] }
    }
  )
};

export const SOCIAL_POST_SCHEDULER: Template = {
  id: "social-post-scheduler",
  name: "Social Post Scheduler",
  description: "Schedules outbound posts and dispatches them to a social publishing API.",
  category: "social",
  workflow: workflow(
    "Social Post Scheduler",
    [
      node("1", "Schedule Trigger", "n8n-nodes-base.scheduleTrigger", [220, 300], {
        rule: {
          interval: [
            {
              field: "cronExpression",
              expression: "0 9 * * 1-5"
            }
          ]
        }
      }),
      node("2", "Publish Social Post", "n8n-nodes-base.httpRequest", [500, 300], {
        method: "POST",
        url: "={{$env.SOCIAL_API_URL || 'https://api.bufferapp.com/1/updates/create.json'}}",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            {
              name: "Content-Type",
              value: "application/json"
            }
          ]
        },
        sendBody: true,
        bodyContentType: "json",
        jsonBody: "={{ { text: $json.text, channel: $json.channel || 'linkedin' } }}"
      })
    ],
    {
      "Schedule Trigger": { main: [[{ node: "Publish Social Post", type: "main", index: 0 }]] }
    }
  )
};

export const WEBHOOK_TO_SLACK: Template = {
  id: "webhook-to-slack",
  name: "Webhook To Slack",
  description: "Receives inbound webhook data, formats it, and posts to Slack.",
  category: "webhook",
  workflow: workflow(
    "Webhook To Slack",
    [
      node("1", "Inbound Webhook", "n8n-nodes-base.webhook", [220, 300], {
        path: "notify-slack",
        httpMethod: "POST",
        responseMode: "lastNode"
      }),
      node("2", "Format Message", "n8n-nodes-base.code", [500, 300], {
        jsCode:
          "const payload = $json.body ?? $json;\nreturn [{ json: { text: `[${payload.level ?? 'info'}] ${payload.message ?? 'Webhook event received'}` } }];"
      }),
      node("3", "Post To Slack", "n8n-nodes-base.slack", [780, 300], {
        resource: "message",
        operation: "post",
        channel: "#automation",
        text: "={{$json.text}}"
      })
    ],
    {
      "Inbound Webhook": { main: [[{ node: "Format Message", type: "main", index: 0 }]] },
      "Format Message": { main: [[{ node: "Post To Slack", type: "main", index: 0 }]] }
    }
  )
};

export const CRM_LEAD_CAPTURE: Template = {
  id: "crm-lead-capture",
  name: "CRM Lead Capture",
  description: "Captures inbound leads, pushes them into the active CRM, and sends a welcome email.",
  category: "crm",
  workflow: workflow(
    "CRM Lead Capture",
    [
      node("1", "Lead Webhook", "n8n-nodes-base.webhook", [220, 300], {
        path: "crm-lead",
        httpMethod: "POST",
        responseMode: "lastNode"
      }),
      node("2", "Create Lead In CRM", "n8n-nodes-base.httpRequest", [520, 300], {
        method: "POST",
        url: "={{($env.CRM_API_URL || 'https://api.example.com') + '/leads'}}",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            {
              name: "Content-Type",
              value: "application/json"
            }
          ]
        },
        sendBody: true,
        bodyContentType: "json",
        jsonBody: "={{ { name: $json.name, email: $json.email, source: $json.source || 'webhook' } }}"
      }),
      node("3", "Send Welcome Email", "n8n-nodes-base.emailSend", [820, 300], {
        fromEmail: "growth@example.com",
        toEmail: "={{$json.email}}",
        subject: "We received your request",
        emailFormat: "text",
        text: "Your lead is in the CRM and the welcome sequence has started."
      })
    ],
    {
      "Lead Webhook": { main: [[{ node: "Create Lead In CRM", type: "main", index: 0 }]] },
      "Create Lead In CRM": {
        main: [[{ node: "Send Welcome Email", type: "main", index: 0 }]]
      }
    }
  )
};

export const CUSTOMER_ONBOARD: Template = {
  id: "customer-onboard",
  name: "Customer Onboard",
  description: "Creates a customer record and delivers setup guidance to the customer contact.",
  category: "crm",
  workflow: workflow(
    "Customer Onboard",
    [
      node("1", "Customer Webhook", "n8n-nodes-base.webhook", [220, 300], {
        path: "customer-onboard",
        httpMethod: "POST",
        responseMode: "lastNode"
      }),
      node("2", "Create Customer", "n8n-nodes-base.httpRequest", [520, 300], {
        method: "POST",
        url: "={{($env.CRM_API_URL || 'https://api.example.com') + '/customers'}}",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            {
              name: "Content-Type",
              value: "application/json"
            }
          ]
        },
        sendBody: true,
        bodyContentType: "json",
        jsonBody:
          "={{ { businessName: $json.businessName, ownerName: $json.ownerName, email: $json.email, plan: $json.plan || 'standard' } }}"
      }),
      node("3", "Send Setup Guide", "n8n-nodes-base.emailSend", [820, 300], {
        fromEmail: "ops@example.com",
        toEmail: "={{$json.email}}",
        subject: "Your customer setup guide",
        emailFormat: "text",
        text: "Your customer record is active. Here is the launch checklist and setup guide."
      })
    ],
    {
      "Customer Webhook": { main: [[{ node: "Create Customer", type: "main", index: 0 }]] },
      "Create Customer": { main: [[{ node: "Send Setup Guide", type: "main", index: 0 }]] }
    }
  )
};

export const TEMPLATES: Template[] = [
  EMAIL_WELCOME_SEQUENCE,
  LEAD_NURTURE_DRIP,
  SHOPIFY_ABANDONED_CART,
  SOCIAL_POST_SCHEDULER,
  WEBHOOK_TO_SLACK,
  CRM_LEAD_CAPTURE,
  CUSTOMER_ONBOARD
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

export function listTemplates(): Array<{
  id: string;
  name: string;
  description: string;
  category: string;
}> {
  return TEMPLATES.map(({ id, name, description, category }) => ({
    id,
    name,
    description,
    category
  }));
}

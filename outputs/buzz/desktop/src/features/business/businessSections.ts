import {
  Banknote,
  TrendingUp,
  Megaphone,
  LifeBuoy,
  ChartNoAxesCombined,
  Wallet,
  Flame,
} from "lucide-react";
export const businessSections = [
  {
    id: "revenue",
    title: "Revenue",
    icon: Banknote,
    description:
      "Understand recurring revenue and the money customers pay you.",
    source: "Billing",
    provider: "Stripe",
    metrics: [
      [
        "Monthly recurring revenue",
        "Monthly value of active recurring subscriptions.",
      ],
      [
        "Cash collected",
        "Successful payments received in the reporting period.",
      ],
      ["Cancellations", "Subscriptions cancelled in the reporting period."],
    ],
    detail: "Subscription movements",
    columns: ["Customer", "Plan", "Amount", "Status"],
  },
  {
    id: "sales-pipeline",
    title: "Sales pipeline",
    icon: TrendingUp,
    description:
      "Track opportunities from first conversation to a paying customer.",
    source: "CRM",
    provider: "HubSpot or your CRM",
    metrics: [
      ["Open pipeline", "Total value of open opportunities."],
      [
        "Deals won",
        "Opportunities closed successfully in the reporting period.",
      ],
      ["Follow-ups due", "Open opportunities with a next action due."],
    ],
    detail: "Open opportunities",
    columns: ["Company", "Stage", "Value", "Next action"],
  },
  {
    id: "marketing-pipeline",
    title: "Marketing pipeline",
    icon: Megaphone,
    description:
      "See which channels bring people in and turn interest into demand.",
    source: "Marketing analytics",
    provider: "Your analytics and campaign tools",
    metrics: [
      ["Visitors", "Unique visitors in the reporting period."],
      ["Leads generated", "New leads attributed to your acquisition channels."],
      ["Visitor-to-lead conversion", "Share of visitors who become leads."],
    ],
    detail: "Acquisition channels",
    columns: ["Source", "Visitors", "Leads", "Conversion"],
  },
  {
    id: "customer-support",
    title: "Customer support",
    icon: LifeBuoy,
    description: "Keep customer requests, fixes, and replies moving.",
    source: "Customer feedback",
    provider: "Gmail",
    metrics: [
      ["Tracked requests", "All requests imported by the customer email rule."],
      ["Awaiting approval", "Requests waiting for your approval to build."],
      [
        "Reply drafts ready",
        "Tested changes with a reply draft. These have not been sent.",
      ],
    ],
    detail: "Customer requests",
    columns: ["Request", "Customer", "Status", "Conversation"],
  },
  {
    id: "usage-metrics",
    title: "Usage metrics",
    icon: ChartNoAxesCombined,
    description:
      "Understand activation, meaningful usage, and whether customers return.",
    source: "Product analytics",
    provider: "Product events from your app",
    metrics: [
      ["Active accounts", "Accounts that performed your defined core action."],
      [
        "Activation rate",
        "Share of new accounts reaching your activation milestone.",
      ],
      ["Retention", "Share of an account cohort returning in a later period."],
    ],
    detail: "Product activity",
    columns: ["Event", "Accounts", "Count", "Trend"],
  },
  {
    id: "cash-balance",
    title: "Cash balance",
    icon: Wallet,
    description: "Know what is available and which payments are coming up.",
    source: "Accounting",
    provider: "Xero or your accounting system",
    metrics: [
      [
        "Cash balance",
        "Cash across connected accounts, as of the latest sync.",
      ],
      ["Receivables overdue", "Unpaid customer invoices past their due date."],
      ["Bills due", "Outstanding bills due in the reporting period."],
    ],
    detail: "Accounts and obligations",
    columns: ["Account or obligation", "Type", "Amount", "As of / due"],
  },
  {
    id: "burn",
    title: "Burn",
    icon: Flame,
    description:
      "Track cash spending, net burn, and how long your cash could last.",
    source: "Accounting",
    provider: "Xero or your accounting system",
    metrics: [
      ["Gross monthly burn", "Operating cash outflows for the selected month."],
      [
        "Net monthly burn",
        "Operating cash outflows less operating cash inflows.",
      ],
      [
        "Runway",
        "Available cash divided by positive monthly net burn; an estimate.",
      ],
    ],
    detail: "Operating expenses",
    columns: ["Category", "Cash outflow", "Period", "Change"],
  },
] as const;

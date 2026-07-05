/**
 * Central help content — the "?" assistant on every screen reads from here.
 * No AI: preset questions with short, step-by-step answers in plain English.
 */
export type HelpCategory = "Getting started" | "Selling" | "Stock" | "Money" | "Records" | "Investors & team";

export const HELP_CATEGORIES: HelpCategory[] = [
  "Getting started",
  "Selling",
  "Stock",
  "Money",
  "Records",
  "Investors & team",
];

export interface HelpTopic {
  id: string;
  category: HelpCategory;
  question: string;
  answer: string[]; // each string is one short step/paragraph
  related: string[]; // ids of follow-up questions to offer
  roles?: ("super_admin" | "owner" | "manager")[]; // omit = everyone
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "record-sale",
    category: "Selling",
    question: "How do I record a sale?",
    answer: [
      "1. On the home screen, tap the green “Record a Sale” button.",
      "2. Choose “Whole boxes” if a customer bought full boxes (wholesale), or “Single pieces” for one-by-one sales.",
      "3. Tap + next to each product for how many were bought. Tap the number to type a big quantity.",
      "4. Check the list, change a price if you agreed something different, then tap “Save Sale”.",
      "Stock goes down automatically — nothing else to do.",
    ],
    related: ["fix-mistake", "stock-check", "wholesale-vs-retail"],
  },
  {
    id: "wholesale-vs-retail",
    category: "Selling",
    question: "What is wholesale vs retail here?",
    answer: [
      "Wholesale = selling whole boxes (e.g. a full box of ice pops at KSh 350).",
      "Retail = selling single pieces (e.g. one ice pop at KSh 10).",
      "Both come from the same stock — the app does the box-to-pieces maths for you.",
    ],
    related: ["record-sale"],
  },
  {
    id: "money-spent",
    category: "Money",
    question: "How do I record money spent?",
    answer: [
      "1. Tap “Money Spent” on the home screen.",
      "2. Pick what it was for: Rent, Salary, Electricity or Other.",
      "3. Type the amount and save. Rent fills in automatically if it is set for your shop.",
      "Spoiled stock is NOT recorded here — use “Spoiled / Lost” so the stock count also goes down.",
    ],
    related: ["spoiled-stock", "record-sale"],
  },
  {
    id: "spoiled-stock",
    category: "Stock",
    question: "Ice pops melted / stock got spoiled — what do I do?",
    answer: [
      "1. Tap “Spoiled / Lost” on the home screen.",
      "2. Choose the product, whether whole boxes or single pieces, and how many.",
      "3. Pick what happened (Melted, Expired, Broken…) and save.",
      "You record it once: the stock count drops AND the loss is counted in the profit maths.",
    ],
    related: ["money-spent", "stock-check"],
  },
  {
    id: "stock-arrived",
    category: "Stock",
    question: "The supplier brought stock — how do I record it?",
    answer: [
      "1. Tap “Stock Arrived” on the home screen.",
      "2. Choose the supplier and add each product with how many boxes and the price paid per box THIS time (prices can change with big orders).",
      "3. Check the total the supplier charged.",
      "4. Enter how much was paid now — the app shows what is still owed.",
      "Owners can also choose “Main store” to receive centrally and send stock to shops later.",
    ],
    related: ["supplier-owed", "send-stock", "finished-batch"],
  },
  {
    id: "supplier-owed",
    category: "Money",
    question: "What does “Owed to supplier” mean?",
    answer: [
      "When stock arrives and it isn't fully paid, the rest is a debt to the supplier.",
      "Every delivery shows it clearly: “Paid KSh 20,000 of 30,000 — still owed 10,000”.",
      "To pay some of it later: open Suppliers → tap the supplier → “Record a Payment”.",
    ],
    related: ["stock-arrived"],
    roles: ["super_admin", "owner"],
  },
  {
    id: "send-stock",
    category: "Stock",
    question: "How do I send stock from the Main store to a shop?",
    answer: [
      "1. From the dashboard tap “Send Stock”.",
      "2. Choose the shop, then tap + for how many boxes of each product to send.",
      "3. Confirm — the Main store count goes down and the shop's count goes up together.",
    ],
    related: ["stock-arrived", "stock-check"],
    roles: ["super_admin", "owner"],
  },
  {
    id: "stock-check",
    category: "Stock",
    question: "How do I see what's in stock?",
    answer: [
      "Tap “What's in Stock” on the home screen (or “Stock” links on the dashboard).",
      "Each product shows boxes + loose pieces left, e.g. “43 boxes + 20 pieces”.",
      "A red “Low” badge means it is time to order more.",
    ],
    related: ["order-soon", "spoiled-stock"],
  },
  {
    id: "order-soon",
    category: "Stock",
    question: "What is the “Order soon” notice?",
    answer: [
      "The app watches how fast each product sells and how much is left.",
      "When stock will run out in about 3 days (or is below the warning level), a yellow notice appears at the start of the day.",
      "It also suggests how much to order, based on the last order and how fast it sold.",
    ],
    related: ["stock-arrived", "stock-check"],
  },
  {
    id: "finished-batch",
    category: "Money",
    question: "What does “Finished” mean on a supply, and when is profit counted?",
    answer: [
      "Each delivery from a supplier is a batch. While it is selling you see “profit so far”.",
      "When every piece of that batch is sold (or recorded as spoiled), it becomes “Finished ✓” and its profit is BANKED — that is the family rule.",
      "One batch can take a whole month to finish, or two or three batches can finish in the same month — both are fine.",
    ],
    related: ["stock-arrived", "profit-numbers"],
  },
  {
    id: "profit-numbers",
    category: "Money",
    question: "Why are there different profit numbers?",
    answer: [
      "“Profit today” on the home screen = today's sales minus their cost, expenses and spoilage — a quick daily picture.",
      "“Profit banked” on the dashboard = profit from batches that FINISHED selling — the number the family counts.",
      "Both are correct; they answer different questions.",
    ],
    related: ["finished-batch"],
    roles: ["super_admin", "owner"],
  },
  {
    id: "fix-mistake",
    category: "Records",
    question: "I made a mistake — how do I fix it?",
    answer: [
      "Open “Today's Records” from the home screen.",
      "Find the wrong entry and tap the bin icon to remove it, then record it again correctly.",
      "Shop managers can only remove their own entries on the same day. Owners can remove any entry — and everything is kept in the Activity Log.",
    ],
    related: ["record-sale", "activity-log"],
  },
  {
    id: "activity-log",
    category: "Records",
    question: "What is the Activity Log?",
    answer: [
      "A permanent record of every action: who recorded what and when.",
      "Nothing in it can be changed or deleted — that is what keeps the records trustworthy.",
      "Owners open it from the dashboard.",
    ],
    related: ["fix-mistake"],
    roles: ["super_admin", "owner"],
  },
  {
    id: "investors",
    category: "Investors & team",
    question: "How does investing and profit sharing work?",
    answer: [
      "Family members put money in — into all of Kibali or one business. That is their capital.",
      "When profit is distributed, each person's share is their capital divided by everyone's capital.",
      "Each investor then chooses: be SENT the money (Disburse) or RETURN it to the business — returned profit is added to their capital, so their future share grows.",
      "Every investor has a private link showing their own money — no login needed.",
    ],
    related: ["investor-link"],
    roles: ["super_admin", "owner"],
  },
  {
    id: "investor-link",
    category: "Investors & team",
    question: "How do I share an investor's summary link?",
    answer: [
      "Open Investors, find the person, tap “Copy link” and send it to them (WhatsApp, SMS…).",
      "If a link leaks, tap “New link” — the old one stops working immediately.",
    ],
    related: ["investors"],
    roles: ["super_admin", "owner"],
  },
  {
    id: "new-account",
    category: "Investors & team",
    question: "How does someone get a login?",
    answer: [
      "Shops: every new shop gets its own login automatically — a shop code (like “tala-shop”) and a password shown once. That's all the person running the shop needs.",
      "Owners and extra accounts: the super admin creates them (Team screen → “Create an account”). The app shows a temporary password ONCE — copy and share it.",
      "Everyone is asked to choose their own password the first time they sign in.",
    ],
    related: ["shop-login"],
    roles: ["super_admin", "owner"],
  },
  {
    id: "shop-login",
    category: "Investors & team",
    question: "What is a shop login?",
    answer: [
      "Each shop has ONE login of its own — a shop code (like “tala-shop”) plus a password — instead of a personal email.",
      "On the sign-in screen, type the shop code where it asks for “Email or shop code”. No email needed.",
      "Whoever runs the shop uses it. If the person changes, just reset the password from the Team screen.",
      "Missing one? Owners can create it in Businesses & Shops — tap the key icon next to the shop.",
    ],
    related: ["new-account"],
    roles: ["super_admin", "owner"],
  },
  {
    id: "day-start",
    category: "Getting started",
    question: "What should I check when the day starts?",
    answer: [
      "The home screen greets you with “How the day is starting”:",
      "• Yesterday's sales and profit — how the previous day went.",
      "• Stock available — what you are opening with.",
      "• Any “Order soon” notices — what needs restocking before it runs out.",
    ],
    related: ["order-soon", "stock-check"],
  },
  {
    id: "working-in",
    category: "Getting started",
    question: "What does “Working in” at the top mean?",
    answer: [
      "It shows which part of Kibali you are working in right now — everything you see and record follows it.",
      "“All of Kibali” = the big picture: dashboard, suppliers, investors.",
      "A shop name (e.g. “Tala Shop”) = you are working that shop: recording sales, checking its stock, just like its manager.",
      "Tap it and choose “Change” to switch at any time. Picking a shop anywhere in the app also switches you there.",
    ],
    related: ["record-sale", "day-start"],
    roles: ["super_admin", "owner"],
  },
  {
    id: "offline-mode",
    category: "Getting started",
    question: "What happens when there is no internet?",
    answer: [
      "The app tells you when the connection drops — a small “Offline mode” note appears above the bottom buttons.",
      "You can still RECORD: sales, money spent, and spoiled/lost stock. They are saved safely on the phone.",
      "The moment the connection returns, they send themselves — you'll see “Sent X saved records”. Nothing is lost and nothing is counted twice.",
      "Dashboards and reports need a connection — the numbers shown offline may be from the last time you were online.",
    ],
    related: ["record-sale", "money-spent", "spoiled-stock"],
  },
  {
    id: "notifications",
    category: "Getting started",
    question: "How do notifications work?",
    answer: [
      "Owners and the super admin can get alerts on their phone even when the app is closed.",
      "Turn them on under More → Notifications (on iPhone, first install the app: Share button → “Add to Home Screen”).",
      "You'll be alerted when a product runs low (“Order soon”), and every evening you get a check: did every shop record today, and what needs reordering.",
    ],
    related: ["order-soon", "day-start"],
    roles: ["super_admin", "owner"],
  },
];

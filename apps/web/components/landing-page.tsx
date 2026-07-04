import Link from "next/link";
import {
  Banknote,
  BarChart3,
  Boxes,
  Handshake,
  ShoppingCart,
  Smartphone,
  Store,
  Truck,
  Users,
} from "lucide-react";

const FEATURES = [
  {
    icon: ShoppingCart,
    title: "Record a sale in seconds",
    body: "Whole boxes or single pieces, at the agreed price or a bargained one — a few taps and it's done.",
    tone: "from-emerald-500 to-teal-600",
  },
  {
    icon: Boxes,
    title: "Always know what's in stock",
    body: "Every shop's stock updates itself as sales, deliveries and losses are recorded — no manual counting.",
    tone: "from-sky-500 to-blue-600",
  },
  {
    icon: Truck,
    title: "Suppliers & what you owe",
    body: "Every delivery shows exactly what's paid and what's still owed — never lose track of a debt again.",
    tone: "from-amber-400 to-orange-500",
  },
  {
    icon: BarChart3,
    title: "Real profit, automatically",
    body: "Profit is banked once a supply finishes selling — the same way the business actually thinks about money.",
    tone: "from-indigo-500 to-violet-600",
  },
  {
    icon: Handshake,
    title: "Investors & profit sharing",
    body: "Track who invested what, split profit fairly, and let each investor check their own returns any time.",
    tone: "from-rose-500 to-pink-600",
  },
  {
    icon: Users,
    title: "One shop or many, one view",
    body: "Owners see every business and every shop from a single dashboard; managers see just their own shop.",
    tone: "from-slate-500 to-slate-700",
  },
];

export function LandingPage() {
  return (
    <main className="min-h-dvh bg-background">
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 text-white">
        {/* subtle dot-grid texture — pure CSS, no image asset to load */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.35) 1.5px, transparent 1.5px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-emerald-300/20 blur-3xl" />

        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-16 text-center sm:py-24">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 shadow-lg ring-1 ring-white/25">
            <Store className="h-8 w-8" />
          </span>
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-bold sm:text-4xl">Kibali Enterprise</h1>
            <p className="mx-auto max-w-xl text-lg text-white/90">
              Simple business records for busy shops — sales, stock, supplier
              money and profit, all in one place, on your phone.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="rounded bg-white px-6 py-3 text-base font-semibold text-emerald-700 shadow-md active:scale-[0.98]"
            >
              Sign in to your business
            </Link>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/80">
            <Smartphone className="h-4 w-4" /> Built for phones — no training needed
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="mx-auto w-full max-w-4xl px-4 py-14">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold">Everything a small business needs to track</h2>
          <p className="mt-2 text-muted-foreground">
            Plain English, big buttons, and no accounting jargon.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body, tone }) => (
            <div
              key={title}
              className="flex flex-col gap-3 rounded border bg-card p-5 shadow-sm"
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${tone} text-white`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Who it's for ---------- */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-8 px-4 py-14 sm:grid-cols-3">
          <div>
            <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">Shop managers</div>
            <p className="text-sm text-muted-foreground">
              Record a sale, an expense, or spoiled stock in a few taps —
              nothing to learn, nothing to write down.
            </p>
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">Owners</div>
            <p className="text-sm text-muted-foreground">
              See every business and every shop from one dashboard, place
              supplier orders, and know your real profit at a glance.
            </p>
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">Investors</div>
            <p className="text-sm text-muted-foreground">
              Check your capital, your share of the profit, and your returns
              any time — with a private link, no login needed.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center">
        <Banknote className="h-8 w-8 text-primary" />
        <h2 className="text-2xl font-bold">Ready to leave the paper behind?</h2>
        <p className="max-w-md text-muted-foreground">
          Sign in with the account you were given to get started.
        </p>
        <Link
          href="/login"
          className="rounded bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-md active:scale-[0.98]"
        >
          Sign in
        </Link>
      </section>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Kibali Enterprise — a Brightex Solutions product.
      </footer>
    </main>
  );
}

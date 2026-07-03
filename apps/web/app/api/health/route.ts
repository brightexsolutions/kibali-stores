import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const VERSION = "0.1.0";

/**
 * Brightex standard health endpoint.
 * Performs a real Supabase query so every ping keeps the free-tier DB awake.
 * Pinged on schedule by cron-job.com; registered on the Brightex health dashboard.
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json(
      { status: "degraded", timestamp, version: VERSION, database: "unconfigured" },
      { status: 200 }
    );
  }

  try {
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false },
    });
    // Real query = DB keep-alive. Table may not exist before M1; a "relation
    // does not exist" error still proves the database answered.
    const { error } = await supabase.from("profiles").select("id").limit(1);
    const dbOk = !error || error.code === "42P01";

    return NextResponse.json(
      {
        status: dbOk ? "ok" : "degraded",
        timestamp,
        version: VERSION,
        database: dbOk ? "ok" : error?.message,
      },
      { status: dbOk ? 200 : 503 }
    );
  } catch (err) {
    console.error("[/api/health] database ping failed", err);
    return NextResponse.json(
      { status: "degraded", timestamp, version: VERSION, database: "unreachable" },
      { status: 503 }
    );
  }
}

/**
 * The live-mode switch. URL and anon key are public by design — every
 * visitor's browser receives them; row-level security in the database is
 * what actually guards the data.
 *
 * Demo mode remains reachable at /app/?demo — the seeded walkthrough,
 * untouched, for showing the product without touching real records.
 */
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://gqgqnognxdcwgkwtxknf.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxZ3Fub2dueGRjd2drd3R4a25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MjYyMjYsImV4cCI6MjEwMTQwMjIyNn0.J4YjmJw4EDFRGkB8eHlROGEO3s_4op-eV6-gPTajVGU";

export const IS_LIVE =
  typeof window !== "undefined" && !window.location.search.includes("demo");

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

import {noCache} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function GET(){return noCache({enabled:process.env.PAPER_MODE_ENABLED==="true"})}

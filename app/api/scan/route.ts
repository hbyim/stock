import { getScanStatus, startScan } from "@/lib/universe";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const status = await getScanStatus();
  return Response.json(status);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { refresh?: boolean };
  const status = await startScan(Boolean(body.refresh));
  return Response.json(status);
}

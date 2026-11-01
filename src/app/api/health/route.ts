import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "UP",
    service: "G-TECH Serviços Automotivos",
    timestamp: new Date().toISOString(),
  });
}


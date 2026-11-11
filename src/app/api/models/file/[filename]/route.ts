import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await context.params;
    const safeName = path.basename(filename);
    const filePath = path.join(process.cwd(), "public", "models", "vehicles", safeName);

    if (!fs.existsSync(filePath)) {
      return new NextResponse("Arquivo GLB não encontrado.", { status: 404 });
    }

    const buf = fs.readFileSync(filePath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "model/gltf-binary",
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store"
      }
    });
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }
}


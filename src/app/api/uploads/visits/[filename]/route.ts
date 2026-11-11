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
    const filePath = path.join(process.cwd(), "public", "uploads", "visits", safeName);

    if (!fs.existsSync(filePath)) {
      return new NextResponse("Arquivo de foto não encontrado.", { status: 404 });
    }

    const buf = fs.readFileSync(filePath);
    const ext = path.extname(safeName).toLowerCase();
    const mime =
      ext === ".png" ? "image/png" :
      ext === ".webp" ? "image/webp" : "image/jpeg";

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(buf.length),
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }
}


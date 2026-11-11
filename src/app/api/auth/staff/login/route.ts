import { NextRequest, NextResponse } from "next/server";
import { authenticateStaff } from "@/lib/auth-service";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "E-mail e senha são obrigatórios." },
        { status: 400 }
      );
    }

    const session = authenticateStaff(email, password);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Credenciais inválidas. Verifique seu usuário e senha da oficina." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: `Bem-vindo, ${session.user.name} (${session.user.role}).`,
      session: {
        session_token: session.session_token,
        user: session.user,
        expires_at: session.expires_at
      }
    });

    // Define cookie HTTP-only para a sessão da oficina
    response.cookies.set("gtech_staff_session", session.session_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 86400
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


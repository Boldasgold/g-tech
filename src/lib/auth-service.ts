import { getDb, generateHash } from "@/lib/db";
import crypto from "node:crypto";

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: "mecanico" | "adm" | "gestor";
  phone?: string;
}

export interface StaffSession {
  session_token: string;
  user_id: string;
  user_name: string;
  role: "mecanico" | "adm" | "gestor";
  expires_at: string;
  user: {
    id: string;
    name: string;
    role: "mecanico" | "adm" | "gestor";
  };
}

const DEFAULT_USERS: Record<string, { id: string; name: string; role: "mecanico" | "adm" | "gestor"; pass: string }> = {
  "giovane@gtech.pgua.br": { id: "user-giovane", name: "Giovane Ribeiro", role: "gestor", pass: "giovane123" },
  "giovane": { id: "user-giovane", name: "Giovane Ribeiro", role: "gestor", pass: "giovane123" },
  "giovane@gtech.com.br": { id: "user-giovane", name: "Giovane Ribeiro", role: "gestor", pass: "gtech2026" },
  "carlos@gtech.pgua.br": { id: "user-mecanico", name: "Carlos Mecânico", role: "mecanico", pass: "carlos123" },
  "carlos": { id: "user-mecanico", name: "Carlos Mecânico", role: "mecanico", pass: "carlos123" },
  "atendimento@gtech.pgua.br": { id: "user-adm", name: "Recepção / Atendimento", role: "adm", pass: "adm123" },
  "atendimento": { id: "user-adm", name: "Recepção / Atendimento", role: "adm", pass: "adm123" }
};

export function authenticateStaff(login: string, pass: string): StaffSession | null {
  const cleanLogin = login.trim().toLowerCase();
  const entry = DEFAULT_USERS[cleanLogin];
  if (!entry || entry.pass !== pass.trim()) {
    return null;
  }

  const db = getDb();
  const token = "stf_" + crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO user_sessions (session_token, user_id, user_name, role, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(token, entry.id, entry.name, entry.role, expiresAt);

  return {
    session_token: token,
    user_id: entry.id,
    user_name: entry.name,
    role: entry.role,
    expires_at: expiresAt,
    user: {
      id: entry.id,
      name: entry.name,
      role: entry.role
    }
  };
}

export function getStaffSession(token: string | null | undefined): StaffSession | null {
  if (!token) return null;
  const db = getDb();

  // Master demo session token check
  if (token === "session-giovane-director-token-2026") {
    return {
      session_token: token,
      user_id: "user-giovane",
      user_name: "Giovane Ribeiro",
      role: "gestor",
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      user: {
        id: "user-giovane",
        name: "Giovane Ribeiro",
        role: "gestor"
      }
    };
  }

  const session = db.prepare(`
    SELECT session_token, user_id, user_name, role, expires_at
    FROM user_sessions
    WHERE session_token = ? AND datetime(expires_at) > datetime('now', 'localtime')
  `).get(token) as any;

  if (!session) return null;

  return {
    ...session,
    user: {
      id: session.user_id,
      name: session.user_name,
      role: session.role
    }
  };
}

export function checkPermission(
  session: StaffSession | null,
  required: Array<"mecanico" | "adm" | "gestor"> | string
): boolean {
  if (!session) return false;
  if (session.role === "gestor") return true; // Gestor has full access

  if (Array.isArray(required)) {
    return required.includes(session.role);
  }

  if (required === "view_work_orders") return true;
  if (required === "edit_work_order") return ["gestor", "mecanico"].includes(session.role);

  return session.role === required;
}

// Token Individual do Cliente para Acesso ao Prontuário / Portal
export function getOrCreateCustomerPortalToken(
  workOrderId: string,
  customerId?: string,
  phone: string = ""
): { token: string; portal_token: string } {
  const db = getDb();

  let effectiveCustId = customerId;
  if (!effectiveCustId) {
    const wo = db.prepare(`SELECT customer_id FROM work_orders WHERE id = ?`).get(workOrderId) as any;
    effectiveCustId = wo?.customer_id || "cust-unknown";
  }

  const existing = db.prepare(`
    SELECT token FROM customer_portal_tokens WHERE work_order_id = ?
  `).get(workOrderId) as { token: string } | undefined;

  if (existing?.token) {
    return { token: existing.token, portal_token: existing.token };
  }

  const token = crypto.createHash("sha256").update(`gtech-portal-${workOrderId}-${Date.now()}`).digest("hex").slice(0, 32);
  const phoneHash = crypto.createHash("sha256").update(phone).digest("hex").slice(0, 16);

  db.prepare(`
    INSERT INTO customer_portal_tokens (token, work_order_id, customer_id, phone_hash)
    VALUES (?, ?, ?, ?)
  `).run(token, workOrderId, effectiveCustId, phoneHash);

  return { token, portal_token: token };
}

export function verifyCustomerPortalToken(token: string) {
  if (!token || token.length < 16) return null;
  const db = getDb();

  const record = db.prepare(`
    SELECT cpt.token, cpt.work_order_id, cpt.customer_id, cpt.access_count,
           wo.os_number, wo.status as wo_status, wo.created_at, wo.updated_at,
           c.name as customer_name, c.phone as customer_phone,
           v.brand, v.model, v.plate, v.year, v.color
     FROM customer_portal_tokens cpt
     JOIN work_orders wo ON cpt.work_order_id = wo.id
     JOIN customers c ON cpt.customer_id = c.id
     JOIN vehicles v ON wo.vehicle_id = v.id
    WHERE cpt.token = ?
  `).get(token) as any;

  if (!record) return null;

  // Track access count
  db.prepare(`
    UPDATE customer_portal_tokens
    SET access_count = access_count + 1, last_accessed_at = datetime('now', 'localtime')
    WHERE token = ?
  `).run(token);

  return record;
}

/**
 * Diagnostic endpoint — visit /api/booking-automations/diag in a logged-in
 * browser tab to see step-by-step what's working and what isn't. Each
 * stage is independently caught so a failure at one step still surfaces
 * results from the previous steps. Strictly for debugging the test-send
 * 502 — delete once the underlying issue is fixed.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

interface DiagResult {
  ok: boolean;
  stage: string;
  detail?: string;
  data?: unknown;
}

async function safeStage<T>(
  stage: string,
  fn: () => Promise<T>,
): Promise<DiagResult & { result?: T }> {
  try {
    const result = await fn();
    return { ok: true, stage, result };
  } catch (err: unknown) {
    return {
      ok: false,
      stage,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET() {
  const out: DiagResult[] = [];

  // 1. Auth
  const authStep = await safeStage("auth", () => auth());
  out.push({
    ok: authStep.ok,
    stage: "auth",
    detail: authStep.detail,
    data: authStep.result
      ? {
          email: authStep.result.user?.email,
          role: authStep.result.user?.role,
          name: authStep.result.user?.name,
        }
      : null,
  });
  if (!authStep.ok) return NextResponse.json({ steps: out });

  // 2. Prisma — find the confirmation automation
  const findStep = await safeStage("prisma-find", async () =>
    prisma.bookingAutomation.findUnique({ where: { key: "confirmation" } }),
  );
  out.push({
    ok: findStep.ok,
    stage: "prisma-find",
    detail: findStep.detail,
    data: findStep.result
      ? { id: findStep.result.id, key: findStep.result.key }
      : null,
  });
  if (!findStep.ok || !findStep.result) return NextResponse.json({ steps: out });

  // 3. EmailSettings
  const settingsStep = await safeStage("email-settings", async () =>
    prisma.emailSettings.findUnique({ where: { id: "default" } }),
  );
  out.push({
    ok: settingsStep.ok,
    stage: "email-settings",
    detail: settingsStep.detail,
    data: settingsStep.result
      ? {
          enabled: settingsStep.result.enabled,
          hasApiKey: Boolean(settingsStep.result.apiKey),
          senderEmail: settingsStep.result.senderEmail,
          provider: settingsStep.result.provider,
        }
      : null,
  });

  // 4. Direct Mailcub fetch (bypass our wrapper) so we know if it's an
  //    issue with the wrapper or the network/provider.
  if (settingsStep.result?.apiKey && settingsStep.result.senderEmail) {
    const apiKey = settingsStep.result.apiKey ?? "";
    const senderEmail = settingsStep.result.senderEmail ?? "";
    const recipient = authStep.result?.user?.email ?? "";
    const mailcubStep = await safeStage("mailcub-direct", async () => {
      const res = await fetch("https://api.mail.mailcub.com/api/send_email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sh-key": apiKey,
        },
        body: JSON.stringify({
          receiver: recipient,
          email_from: senderEmail,
          subject: "[DIAG] Mailcub round-trip test",
          html: "<p>Diagnostic ping — if you see this, the pipeline is healthy.</p>",
          text: "Diagnostic ping",
        }),
      });
      const text = await res.text();
      return { status: res.status, body: text };
    });
    out.push({
      ok: mailcubStep.ok,
      stage: "mailcub-direct",
      detail: mailcubStep.detail,
      data: mailcubStep.result,
    });
  }

  return NextResponse.json({ steps: out });
}

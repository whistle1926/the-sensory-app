import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
const p = new PrismaClient();
try {
  const s = await p.aiSettings.findFirst({ select: { apiKey: true } });
  const anthropic = new Anthropic({ apiKey: s?.apiKey || process.env.ANTHROPIC_API_KEY });
  let rep = await p.report.findFirst({
    where: { client: { is: { name: { contains: "Doherty", mode: "insensitive" } } } },
    select: { id: true, content: true }, orderBy: { updatedAt: "desc" },
  }).catch(()=>null);
  if (!rep) rep = await p.report.findFirst({ select: { id: true, content: true }, orderBy: { updatedAt: "desc" } });
  const contentStr = JSON.stringify(rep.content);
  console.log(`Report ${rep.id} content length: ${contentStr.length} chars`);
  const t0 = Date.now();
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6", thinking: { type: "disabled" }, output_config: { effort: "low" }, max_tokens: 8192,
      system: "You are a paediatric OT editor. Fix grammar/tone only. Return ONLY the JSON object, same shape, no code fences.",
      messages: [{ role: "user", content: `Tidy this report. Return the JSON with the same shape:\n\n${contentStr}` }],
    });
    const ms = Date.now() - t0;
    const txt = msg.content.find(b=>b.type==="text")?.text ?? "";
    let parseOk=false, perr=""; try{let t=txt.trim(); if(t.startsWith("```"))t=t.replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/i,""); JSON.parse(t); parseOk=true;}catch(e){perr=e.message;}
    console.log(`RESULT: ${ms}ms | stop=${msg.stop_reason} | out ${txt.length} chars | in=${msg.usage?.input_tokens} out=${msg.usage?.output_tokens} | parse ${parseOk?"OK":"FAIL: "+perr}`);
  } catch(e){ console.log(`API ERROR ${Date.now()-t0}ms: status=${e?.status} ${(e?.message||"").slice(0,220)}`); }
} catch(e){ console.error("ERR", e.message);} finally { await p.$disconnect(); }

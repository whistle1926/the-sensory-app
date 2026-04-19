const fs = require("fs");
const { spawnSync } = require("child_process");
const txt = fs.readFileSync(".env.local", "utf8");
for (const line of txt.split(/\r?\n/)) {
  const eq = line.indexOf("=");
  if (eq === -1) continue;
  const key = line.slice(0, eq).trim();
  let val = line.slice(eq + 1).trim();
  if (val.startsWith('"') && val.endsWith('"')) {
    val = val.slice(1, -1).replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\"/g, '"');
  }
  val = val.replace(/[\r\n]+$/g, "");
  process.env[key] = val;
}
const [cmd, ...rest] = process.argv.slice(2);
const res = spawnSync(cmd, rest, { stdio: "inherit", env: process.env });
process.exit(res.status ?? 1);

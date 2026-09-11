import {consumeDownloadTicket} from "./slack/download-ticket.mjs";
import {migrateSlack} from './slack/store.mjs';
import {slackApi} from './slack/api.mjs';
import {callback as slackCallback} from './slack/oauth.mjs';
import {startSlackSync} from './slack/sync.mjs';
import {migrateProjectData,authenticateDataAgent,projectDataRequest,dataPermissions} from './project-data.mjs';
import {pollBusinessEdits} from './business-chat.mjs';
import { agentCommand, startConfiguredAgents } from "./agents.mjs";
import { migrateBusinessPages, businessPages } from "./business-pages.mjs";
import { approveFeedbackFromChat } from "./feedback-chat.mjs";
import { feedbackTick, recoverFeedback } from "./feedback-worker.mjs";
import { approveFeedback } from "./feedback.mjs";
import {
  gmailStatus,
  gmailConnect,
  gmailCallback,
  configureGmail,
  feedbackConfig,
} from "./gmail.mjs";
import http from "node:http";
import { isBuildCommand } from "./commands.mjs";
import { randomUUID } from "node:crypto";
import { verifyEvent } from "nostr-tools";
import { db, migrate } from "./db.mjs";
import { state, humans, builder, origin } from "./config.mjs";
import { verifyRequest } from "./auth.mjs";
import {
  history,
  provision,
  flushOutbox,
  connect,
  threadOf,
} from "./relay.mjs";
import {
  saveBrief,
  approve,
  queueBuild,
  draft,
  recover,
  tick,
  fail,
} from "./workflow.mjs";
await migrate();
await migrateBusinessPages();
await migrateProjectData();
await migrateSlack();
void startSlackSync();
setInterval(()=>void pollBusinessEdits().catch(()=>console.error("Business edit status check failed")),5000).unref();
void startConfiguredAgents().catch(()=>console.error("Could not restore configured agents"));
await db.query(
  "ALTER TABLE cofounder.jobs ADD COLUMN IF NOT EXISTS remote_thread_id text",
);
const lock = await db.connect();
if (
  !(await lock.query("SELECT pg_try_advisory_lock(98217411) AS locked")).rows[0]
    .locked
)
  throw Error("Another Co-founder backend is already running");
lock.on("error", () => process.exit(1));
await recover();
await recoverFeedback();
await provision();
const allowedOrigins = ["http://127.0.0.1:5174", "http://127.0.0.1:5175"];
const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const browserOrigin = req.headers.origin;
  if (browserOrigin && allowedOrigins.includes(browserOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", browserOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  try {
    if (
      req.headers.host !== "127.0.0.1:5180" ||
      (browserOrigin && !allowedOrigins.includes(browserOrigin))
    )
      throw fail("Local access only", 403);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/gmail/callback?")) {
      try {
        await gmailCallback(new URL(origin + req.url));
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(
          "<h1>Gmail connected</h1><p>You can return to Customer feedback in Mission Control. Email monitoring is now enabled while the local service runs.</p>",
        );
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
    if(req.method==='GET'&&req.url.startsWith('/slack/callback?')){
      const destination=await slackCallback(new URL(origin+req.url));
      res.writeHead(302,{Location:destination});res.end();return;
    }
    if(req.method==='GET' && req.url.startsWith('/slack/file/')) {
      const file=consumeDownloadTicket(req.url.slice('/slack/file/'.length));
      if(!file) throw fail('Download expired. Please download the file again.',404);
      const bytes=Buffer.from(file.base64,'base64');
      res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(file.name).replaceAll("'",'%27'),'Content-Length':bytes.length,'X-Content-Type-Options':'nosniff'});
      res.end(bytes); return;
    }
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (Buffer.byteLength(raw) > (req.url.startsWith('/slack/')?15000000:50000)) throw fail("Request too large", 413);
    }
    if(req.method==='POST'&&req.url==='/project-data/agent'){
      const agent=await authenticateDataAgent(req.headers.authorization);
      const result=await projectDataRequest(agent,JSON.parse(raw||'{}'));
      res.end(JSON.stringify(result));return;
    }
    const auth = verifyRequest({
      authorization: req.headers.authorization,
      url: origin + req.url,
      method: req.method,
      body: raw,
      allowed: humans.map((u) => u.pubkey),
    });
    const nonce = await db.query(
      "INSERT INTO cofounder.nonces(id) VALUES($1) ON CONFLICT DO NOTHING RETURNING id",
      [auth.id],
    );
    if (!nonce.rowCount) throw fail("Request already used", 401);
    const b = raw ? JSON.parse(raw) : {};
    let result;
    if(req.url.startsWith('/slack/')){
      result=await slackApi(auth.pubkey,req.url.slice(7).split('?')[0],b,req.method,browserOrigin||allowedOrigins[0]);
    } else if(req.url==='/project-data/permissions'){
      result=await dataPermissions(req.method==='POST'?b:null,auth.pubkey);
    } else if (req.method === "POST" && req.url === "/agents/command") {
      result = await agentCommand(b, auth.pubkey);
    } else if (req.url.startsWith("/business/")) {
      result = await businessPages(req, b, auth.pubkey);
    } else if (req.method === "GET" && req.url === "/feedback") {
      result = {
        items: (
          await db.query(
            "SELECT * FROM cofounder.feedback ORDER BY created_at DESC LIMIT 100",
          )
        ).rows,
        gmail: gmailStatus(),
        room: feedbackConfig()?.room,
      };
    } else if (req.method === "POST" && req.url === "/feedback/retry-tests") {
      if (auth.pubkey !== humans[0].pubkey)
        throw fail("Only Noel can resume this test browser.", 403);
      const queued = await db.query(
        "UPDATE cofounder.feedback SET status='awaiting_tests',error=NULL,test_evidence=NULL,updated_at=now() WHERE id=$1 AND status IN ('test_access_required','tests_failed') AND approved_by IS NOT NULL AND remote_message_id IS NOT NULL AND reply_draft_id IS NULL RETURNING id",
        [b.id],
      );
      if (!queued.rowCount)
        throw fail("This change is not waiting for a test retry.", 409);
      result = { ok: true };
    } else if (req.method === "POST" && req.url === "/feedback/approve") {
      try {
        result = {
          scope: await approveFeedback(
            b.id,
            auth.pubkey,
            b.scope,
            b.testProfile,
          ),
        };
      } catch (e) {
        throw fail(e.message, 409);
      }
    } else if (
      req.method === "POST" &&
      req.url === "/feedback/retry-recommendation"
    ) {
      result = {
        ok: !!(
          await db.query(
            "UPDATE cofounder.feedback SET status='received',error=NULL WHERE id=$1 AND status='recommendation_failed' RETURNING id",
            [b.id],
          )
        ).rowCount,
      };
    } else if (
      req.method === "POST" &&
      ["/gmail/configure", "/gmail/connect"].includes(req.url)
    ) {
      if (auth.pubkey !== humans[0].pubkey)
        throw fail("Only Noel can connect this mailbox.", 403);
      try {
        result =
          req.url === "/gmail/configure" ? configureGmail(b) : gmailConnect();
      } catch (e) {
        throw fail(e.message, 400);
      }
    } else if (req.method === "GET" && req.url === "/workspace") {
      const [briefs, jobs, priorities] = await Promise.all([
        db.query(
          "SELECT * FROM cofounder.briefs WHERE room=$1 ORDER BY updated_at DESC",
          [state.room],
        ),
        db.query(
          "SELECT j.*,b.title FROM cofounder.jobs j JOIN cofounder.briefs b ON b.id=j.brief_id WHERE b.room=$1 ORDER BY j.created_at DESC",
          [state.room],
        ),
        db.query("SELECT * FROM cofounder.priorities ORDER BY created_at"),
      ]);
      result = {
        room: state.room,
        briefs: briefs.rows,
        jobs: jobs.rows,
        priorities: priorities.rows,
        user: humans.find((u) => u.pubkey === auth.pubkey).name,
        builder: builder.pubkey,
      };
    } else if (req.method === "GET" && req.url === "/conversations") {
      const events = await history();
      result = events
        .filter(
          (e) =>
            threadOf(e) === e.id && humans.some((u) => u.pubkey === e.pubkey),
        )
        .reverse()
        .map((e) => ({
          id: e.id,
          content: e.content,
          author: humans.find((u) => u.pubkey === e.pubkey)?.name,
        }));
    } else if (req.method === "POST" && req.url === "/brief")
      result = await saveBrief(auth.pubkey, b);
    else if (req.method === "POST" && req.url === "/draft")
      result = await draft(auth.pubkey, b);
    else if (req.method === "POST" && req.url === "/approve")
      result = await approve(auth.pubkey, b);
    else if (req.method === "POST" && req.url === "/build")
      result = await queueBuild(auth.pubkey, b);
    else if (req.method === "POST" && req.url === "/priority") {
      if (
        typeof b.title !== "string" ||
        !b.title.trim() ||
        b.title.length > 300 ||
        !["Noel", "Alex"].includes(b.owner)
      )
        throw fail("Add a priority and select its owner.");
      const id = b.id || randomUUID();
      if (b.id)
        await db.query(
          "UPDATE cofounder.priorities SET title=$2,owner=$3,done=$4 WHERE id=$1",
          [id, b.title, b.owner, b.done === true],
        );
      else
        await db.query(
          "INSERT INTO cofounder.priorities(id,title,owner) VALUES($1,$2,$3)",
          [id, b.title, b.owner],
        );
      result = { ok: true };
    } else throw fail("Not found", 404);
    res.end(JSON.stringify(result));
  } catch (e) {
    res.statusCode = e.status || 500;
    res.end(
      JSON.stringify({
        error: e.status
          ? e.message
          : "The backend could not complete that request. Please try again.",
      }),
    );
    if (!e.status) console.error("Request failed:", e.code || e.name);
  }
});
server.listen(5180, "127.0.0.1", () =>
  console.log("Co-founder backend ready on localhost:5180"),
);
let busy = false;
setInterval(async () => {
  if (busy) return;
  busy = true;
  try {
    await tick();
    await feedbackTick();
    await flushOutbox();
    await db.query(
      "DELETE FROM cofounder.nonces WHERE created_at<now()-interval '5 minutes'",
    );
  } catch (e) {
    console.error("Worker will retry:", e.code || e.name);
  } finally {
    busy = false;
  }
}, 5000);
async function listen() {
  for (;;) {
    try {
      const { socket, listeners } = await connect();
      let chain = Promise.resolve();
      listeners.add((m) => {
        if (m[0] !== "EVENT") return;
        const e = m[2];
        if (
          e.tags?.some((t) => t[0] === "h" && t[1] === feedbackConfig()?.room)
        ) {
          chain = chain
            .then(() => approveFeedbackFromChat(e))
            .catch(() => {
              console.error("Feedback approval needs replay");
              socket.close();
            });
          return;
        }
        if (
          !verifyEvent(e) ||
          e.kind !== 9 ||
          !e.tags.some((t) => t[0] === "h" && t[1] === state.room) ||
          !e.tags.some((t) => t[0] === "p" && t[1] === builder.pubkey) ||
          !humans.some((u) => u.pubkey === e.pubkey) ||
          !isBuildCommand(e.content)
        )
          return;
        chain = chain
          .then(() => queueBuild(e.pubkey, { thread: threadOf(e) }, e.id))
          .catch(() => {
            console.error("Build command needs replay");
            socket.close();
          });
      });
      socket.send(
        JSON.stringify([
          "REQ",
          "build-commands",
          { kinds: [9], "#h": [feedbackConfig().room], limit: 100 },
          {
            kinds: [9],
            "#h": [state.room],
            "#p": [builder.pubkey],
            limit: 100,
          },
        ]),
      );
      await new Promise((r) => socket.addEventListener("close", r));
    } catch {
      console.error("Chat subscription reconnecting");
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}
void listen();

http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'||!req.url.startsWith('/slack/callback?')){res.writeHead(404);res.end();return;}
 try{const destination=await slackCallback(new URL('http://localhost'+req.url));res.writeHead(302,{Location:destination});res.end();}
 catch{res.writeHead(400,{'Content-Type':'text/plain'});res.end('Slack connection failed or expired. Return to Co-founder and connect again.');}
}).listen(5191,'127.0.0.1');

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import knowledgeBase from "@/data/intelligence-knowledge.json";

type Message = { role: "user" | "assistant"; content: string };

function answerLocal(question: string, mode: string, context: Message[], label: string) {
  const clean = (value: string) => value.replace(/\s+/g, " ").trim();
  const lines = [...new Set(context.flatMap(m => m.content.split(/(?<=[.!?])\s+|\n+/).map(clean).filter(x => x.length > 10)))];
  const q = clean(question).toLowerCase();
  const stop = new Set(["the","and","for","that","this","with","from","what","when","where","who","why","how","are","was","were","you","your","our","their","have","has","had","does","did","can","could","would","should","about","into","there","here","tell","me","please","chat","conversation","current"]);
  const terms = q.split(/[^a-z0-9]+/).filter(x => x.length > 2 && !stop.has(x));
  const task = /\b(todo|task|need to|must|should|will|remind|complete|finish|submit|send|prepare|create|update|fix|check|deadline|action item)\b/i;
  const decision = /\b(decided|decision|agreed|finalized|confirmed|selected|approved|choose|chosen)\b/i;
  const dates = /\b(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|this week|next week|by \w+|\d{1,2}[/-]\d{1,2}|\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b)/i;
  const blockers = /\b(blocked|blocker|stuck|issue|problem|failed|error|waiting|delay|cannot|can't|unable|risk|pending)\b/i;
  const unique = (values: string[]) => [...new Set(values)];
  const pick = (pattern: RegExp, limit = 12) => unique(lines.filter(x => pattern.test(x))).slice(-limit);
  const rank = (source: string[]) => source.map((line,index) => {
    const lower=line.toLowerCase();
    const hits=terms.filter(term=>lower.includes(term)).length;
    const phrase=q.length>5&&lower.includes(q)?8:0;
    const coverage=terms.length?hits/terms.length:0;
    return {line,score:hits*3+coverage*4+phrase+Math.min(line.length,220)/100+index/1000};
  }).filter(x=>x.score>1).sort((a,b)=>b.score-a.score);
  const bullets = (items:string[]) => items.length?items.map((x,i)=>(i+1)+". "+x).join("\n"):"Nothing clear was found in the available messages.";
  const normalize = (value: string) => value.toLowerCase()
    .replace(/\(example\s+\d+\)/g, " ")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ").trim();
  const questionTerms = normalize(question).split(" ").filter(x => x.length > 2 && !stop.has(x));
  const entries = (knowledgeBase as { entries: Array<{category:string;intent:string;question:string;keywords:string[];answer:string}> }).entries;
  const knowledgeMatches = entries.map(entry => {
    const candidate = normalize(entry.question);
    const words = new Set(candidate.split(" ").filter(x => x.length > 2 && !stop.has(x)));
    const keywordSet = new Set((entry.keywords || []).map(normalize).filter(Boolean));
    const hits = questionTerms.filter(term => words.has(term) || [...keywordSet].some(k => k === term || (k.length > 4 && term.startsWith(k)))).length;
    const exact = candidate === normalize(question);
    const phrase = candidate.length > 5 && normalize(question).includes(candidate) ? 5 : 0;
    const coverage = questionTerms.length ? hits / questionTerms.length : 0;
    return {entry, score: (exact ? 20 : 0) + phrase + hits * 2.5 + coverage * 5};
  }).sort((a,b) => b.score-a.score);
  const bestKnowledge = knowledgeMatches[0];
  if (bestKnowledge && (bestKnowledge.score >= 8 || bestKnowledge.score >= 6 && questionTerms.length <= 2)) {
    return bestKnowledge.entry.answer + "\n\n<small>ConnectX Help · " + bestKnowledge.entry.category + "</small>";
  }

  if (!context.length) {
    if (mode === "draft" || /draft|reply|respond/.test(q)) return "Tell me what the reply is about, or open a chat and turn on conversation context. I can prepare a draft, but I won't send it.";
    return "I can work with messages from the selected chat or group. Open one and enable “Use current conversation context”. Without a chat, I don't have conversation facts to answer from.";
  }
  if (mode === "summarize" || /summary|summarize|recap/.test(q)) {
    const key=rank(lines).slice(0,8).map(x=>x.line);
    return "Conversation brief — "+label+"\n\nKey points\n"+bullets((key.length?key:lines.slice(-8)))+"\n\nDecisions\n"+bullets(pick(decision,8))+"\n\nNext steps\n"+bullets(pick(task,8))+"\n\nDates and timing\n"+bullets(pick(dates,8))+"\n\nOpen issues\n"+bullets(pick(blockers,8))+"\n\nBased only on the recent messages provided; inferred items may need confirmation.";
  }
  if (mode === "tasks" || /task|action item|deadline|todo|next step/.test(q)) {
    const a=pick(task,20); return "Possible action items\n"+bullets(a)+"\n\nI won't invent owners or deadlines that aren't stated.";
  }
  if (mode === "decisions" || /decision|decided|agreed|confirmed/.test(q)) return "Decisions mentioned\n"+bullets(pick(decision,20));
  if (mode === "timeline" || /timeline|date|when|schedule/.test(q)) return "Timing mentioned in the chat\n"+bullets(pick(dates,20))+"\n\nThese are message references, not verified calendar events.";
  if (mode === "insights" || /blocker|risk|issue|problem|stuck|unresolved/.test(q)) return "Potential blockers and unresolved issues\n"+bullets(pick(blockers,20));
  if (mode === "draft" || /draft|reply|respond/.test(q)) {
    const relevant=rank(lines).slice(0,3).map(x=>x.line);
    return "Suggested reply — edit before sending:\n\n"+(relevant.length?"Thanks for sharing this. I understand that "+relevant[0].replace(/^[^:]{1,35}:\s*/,"").replace(/[.!?]+$/,"")+". I'll review the details"+(relevant[1]?" and follow up on "+relevant[1].replace(/^[^:]{1,35}:\s*/,"").replace(/[.!?]+$/,""):"")+" and get back to you with the next steps.":"Thanks for the update. I've understood the points and will review them before getting back to you.")+"\n\nThis is a draft only; it has not been sent.";
  }
  if (/how many|count|number of/.test(q)) {
    const matches=rank(lines).slice(0,10);
    if(matches.length) return "I found "+matches.length+" relevant message excerpt(s):\n"+bullets(matches.map(x=>x.line))+"\n\nThis counts matching excerpts, not necessarily unique real-world items.";
  }
  const matches=rank(lines).slice(0,7);
  if(matches.length) return "Here is what the recent chat says about that:\n\n"+bullets(matches.map(x=>x.line))+"\n\nI ranked these by keyword overlap. If the answer isn't here, the chat may not contain it.";
  return "I couldn't find a reliable answer in the recent messages. Try using a specific name or keyword, or ask me to summarize the chat, list tasks, decisions, dates or blockers.";
}
export async function POST(request: Request) {
  try {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer /, "");
    if (!token) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return NextResponse.json({ error: "ConnectX authentication is not configured." }, { status: 503 });
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await client.auth.getUser(token);
    if(error || !data.user) return NextResponse.json({error:"Your session has expired. Sign in again."},{status:401});
    const body=await request.json();
    const question=typeof body.question==="string"?body.question.trim().slice(0,3000):"";
    if(!question) return NextResponse.json({error:"Type a question first."},{status:400});
    const context=Array.isArray(body.context)?(body.context as Message[]).slice(-35).map(m=>({role:m?.role==="assistant"?"assistant" as const:"user" as const,content:typeof m?.content==="string"?m.content.slice(0,900):""})).filter(m=>m.content):[];
    const mode=typeof body.mode==="string"?body.mode.slice(0,40):"assistant";
    const label=typeof body.contextLabel==="string"?body.contextLabel.slice(0,100):"Current conversation";
    return NextResponse.json({answer:answerLocal(question,mode,context,label),engine:"local-rules",apiRequired:false});
  } catch { return NextResponse.json({error:"Could not process this request. Please try again."},{status:500}); }
}

"use client";

import { useMemo, useState } from "react";

type Message = { id: number; body: string; mine: boolean; time: string };
type Chat = { id: number; name: string; initials: string; color: string; status: string; preview: string; time: string; unread: number; messages: Message[] };

const seed: Chat[] = [
  { id: 1, name: "Aarav Sharma", initials: "AS", color: "#7668e8", status: "Online", preview: "Hey! How's your day going?", time: "9:41", unread: 2, messages: [
    { id: 1, body: "Hey! 👋", mine: false, time: "9:38" },
    { id: 2, body: "How's your day going?", mine: false, time: "9:41" },
  ]},
  { id: 2, name: "Priya Patel", initials: "PP", color: "#cf789e", status: "Last seen recently", preview: "That sounds great!", time: "Yesterday", unread: 0, messages: [
    { id: 1, body: "Want to catch up this weekend?", mine: true, time: "Yesterday" },
    { id: 2, body: "That sounds great!", mine: false, time: "Yesterday" },
  ]},
  { id: 3, name: "Dev Team", initials: "DT", color: "#399d85", status: "3 members", preview: "You: pushed the latest update", time: "Tue", unread: 0, messages: [
    { id: 1, body: "The new dashboard layout is ready for review.", mine: false, time: "Tuesday" },
    { id: 2, body: "Pushed the latest update.", mine: true, time: "Tuesday" },
  ]},
];

export default function ChatPreview() {
  const [chats, setChats] = useState(seed);
  const [selected, setSelected] = useState(1);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState("Messages");
  const [showMobileChat, setShowMobileChat] = useState(false);
  const active = chats.find((c) => c.id === selected) ?? chats[0];
  const visible = useMemo(() => chats.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())), [chats, search]);

  function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !active) return;
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setChats((old) => old.map((c) => c.id === active.id
      ? { ...c, preview: body, time, messages: [...c.messages, { id: Date.now(), body, mine: true, time }] }
      : c));
    setDraft("");
  }

  return (
    <main className="cx-shell">
      <aside className="cx-rail">
        <div className="cx-mark">✦</div>
        {["▤", "♙", "⚙"].map((item, i) => <button key={item} className={i === 0 ? "rail-btn selected" : "rail-btn"} onClick={() => setTab(["Messages", "Friends", "Settings"][i])} aria-label={["Messages", "Friends", "Settings"][i]}>{item}</button>)}
        <div className="rail-spacer" /><div className="cx-user">S</div>
      </aside>
      <section className={`cx-list ${showMobileChat ? "hide-mobile" : ""}`}>
        <header className="list-head"><div><div className="cx-brand"><span>✦</span> ConnectX</div><p>Your space to connect</p></div><button className="icon-btn" aria-label="New chat" onClick={() => alert("New conversations will be connected to your friends list in a future update.")}>＋</button></header>
        <div className="search-box"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations" /></div>
        <div className="list-label">{tab.toUpperCase()} <span>{visible.length}</span></div>
        <div className="cx-chats">{visible.map((chat) => <button key={chat.id} className={`chat-row ${selected === chat.id ? "active" : ""}`} onClick={() => { setSelected(chat.id); setShowMobileChat(true); }}><span className="avatar" style={{ background: chat.color }}>{chat.initials}</span><span className="chat-info"><strong>{chat.name}</strong><small>{chat.preview}</small></span><span className="chat-time">{chat.time}{chat.unread > 0 && <b>{chat.unread}</b>}</span></button>)}{visible.length === 0 && <p className="empty">No matching conversations.</p>}</div>
        <div className="profile-row"><span className="profile-avatar">S</span><span><strong>Samarth</strong><small>Preview account</small></span><span className="online-dot">●</span></div>
      </section>
      <section className={`cx-conversation ${showMobileChat ? "show-mobile" : ""}`}>
        {active ? <>
          <header className="conversation-head"><button className="back-btn" onClick={() => setShowMobileChat(false)}>‹</button><span className="avatar" style={{ background: active.color }}>{active.initials}</span><div className="person"><strong>{active.name}</strong><small>{active.status}</small></div><button className="icon-btn" aria-label="Search">⌕</button><button className="icon-btn" aria-label="More">⋯</button></header>
          <div className="messages-area"><div className="today">TODAY</div>{active.messages.map((m) => <div key={m.id} className={m.mine ? "message-line mine" : "message-line"}><div className={m.mine ? "bubble mine-bubble" : "bubble"}><p>{m.body}</p><small>{m.time} {m.mine ? "✓" : ""}</small></div></div>)}<div className="preview-note">Preview only · Messages are not saved to a server yet</div></div>
          <form className="composer" onSubmit={send}><button type="button" className="attach" aria-label="Attach">＋</button><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message…" /><button className="send" disabled={!draft.trim()} aria-label="Send message">➤</button></form>
        </> : <div className="empty-state">Choose a conversation</div>}
      </section>
      <style jsx>{`
        * { box-sizing: border-box; }
        .cx-shell { height: 100dvh; min-height: 540px; display:flex; overflow:hidden; background:#0b1020; color:#f5f6fc; font-family:Inter,system-ui,Arial,sans-serif; }
        .cx-rail { width:68px; flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:16px; padding:20px 0; background:#101727; border-right:1px solid #232d42; }
        .cx-mark { width:40px;height:40px;border-radius:13px;display:grid;place-items:center;background:#7868eb;font-size:23px;margin-bottom:16px; }
        .rail-btn { width:40px;height:40px;border:0;border-radius:12px;background:transparent;color:#8994ad;font-size:20px;cursor:pointer; }
        .rail-btn.selected { background:#29264a;color:#c8beff; }
        .rail-spacer { flex:1; }.cx-user,.profile-avatar { display:grid;place-items:center;border-radius:50%;background:#554b9b;font-weight:800; }
        .cx-user { width:36px;height:36px; }
        .cx-list { width:340px;min-width:290px;display:flex;flex-direction:column;background:#121a2b;border-right:1px solid #232d42; }
        .list-head { padding:24px 20px 18px;display:flex;align-items:center;justify-content:space-between; }
        .cx-brand { font-size:22px;font-weight:850;letter-spacing:-.8px; }.cx-brand span { color:#a99aff; }
        .list-head p { margin:5px 0 0;color:#8490a9;font-size:12px; }
        .icon-btn { width:36px;height:36px;border:1px solid #39445d;border-radius:11px;background:#1b2540;color:#c9bfff;font-size:22px;cursor:pointer; }
        .search-box { margin:0 17px 20px;padding:11px 12px;display:flex;gap:9px;border-radius:10px;background:#0c1424;color:#8b96ad; }
        .search-box input,.composer input { width:100%;min-width:0;border:0;outline:0;background:transparent;color:#fff;font-size:12px; }
        .list-label { display:flex;justify-content:space-between;padding:0 21px 10px;color:#7e89a2;font-size:10px;font-weight:800;letter-spacing:1.5px; }
        .cx-chats { flex:1;overflow:auto;padding:0 9px; }
        .chat-row { width:100%;display:flex;align-items:center;gap:11px;padding:12px;border:0;border-radius:13px;background:transparent;color:inherit;text-align:left;cursor:pointer;margin-bottom:4px; }
        .chat-row.active { background:#202a40; }.avatar { width:43px;height:43px;flex-shrink:0;display:grid;place-items:center;border-radius:50%;font-size:12px;font-weight:800;color:white; }
        .chat-info { flex:1;min-width:0;display:flex;flex-direction:column;gap:5px; }.chat-info strong,.person strong { font-size:13px; }.chat-info small { color:#8b96ad;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .chat-time { display:flex;flex-direction:column;align-items:flex-end;gap:7px;color:#7e89a2;font-size:9px; }.chat-time b { width:18px;height:18px;display:grid;place-items:center;border-radius:50%;background:#7868eb;color:white;font-size:10px; }
        .empty { color:#8994ad;text-align:center;font-size:12px;padding:20px; }
        .profile-row { display:flex;align-items:center;gap:10px;padding:16px;border-top:1px solid #263149; }.profile-avatar { width:35px;height:35px; }.profile-row strong,.profile-row small { display:block;font-size:11px; }.profile-row small { color:#8290a9;margin-top:4px; }.online-dot { margin-left:auto;color:#55c69a;font-size:11px; }
        .cx-conversation { flex:1;min-width:0;display:flex;flex-direction:column;background:#0d1423; }.conversation-head { height:78px;flex-shrink:0;display:flex;align-items:center;gap:12px;padding:0 24px;border-bottom:1px solid #232d42;background:#121a2b; }
        .person { flex:1; }.person small { display:block;color:#58c69c;font-size:10px;margin-top:5px; }.messages-area { flex:1;overflow:auto;padding:25px clamp(16px,5vw,70px);display:flex;flex-direction:column;gap:14px; }
        .today { align-self:center;padding:6px 12px;border-radius:20px;background:#182237;color:#8994ad;font-size:9px;letter-spacing:1px;margin-bottom:12px; }
        .message-line { display:flex;width:100%;justify-content:flex-start; }.message-line.mine { justify-content:flex-end; }.bubble { max-width:min(75%,440px);padding:11px 14px 8px;border-radius:16px 16px 16px 5px;background:#202b40; }.mine-bubble { background:#6858d8;border-radius:16px 16px 5px 16px; }.bubble p { margin:0;font-size:13px;line-height:1.5;overflow-wrap:anywhere; }.bubble small { display:block;text-align:right;color:#d2ccef;font-size:9px;margin-top:5px; }
        .preview-note { margin-top:auto;align-self:center;color:#68748c;font-size:10px;text-align:center; }.composer { display:flex;align-items:center;gap:10px;padding:15px 20px;border-top:1px solid #232d42;background:#121a2b; }.composer input { padding:14px;border:1px solid #37425c;border-radius:12px;background:#0c1424;font-size:13px; }.attach,.send { width:40px;height:40px;flex-shrink:0;border:0;border-radius:12px;background:#1b2540;color:#b5aaff;font-size:22px; }.send { background:#7868eb;color:white;font-size:17px;cursor:pointer; }.send:disabled { opacity:.4; }.back-btn { display:none;border:0;background:transparent;color:#c9bfff;font-size:28px; }.empty-state { margin:auto;color:#8490a9; }
        @media(max-width:700px) { .cx-rail { width:54px; }.cx-list { width:calc(100% - 54px);min-width:0; }.cx-conversation { display:none; }.cx-conversation.show-mobile { display:flex;position:absolute;inset:0 0 0 54px;z-index:2; }.cx-list.hide-mobile { display:none; }.back-btn { display:block; }.conversation-head { padding:0 12px;gap:9px; }.composer { padding:12px; }.messages-area { padding:20px 14px; } }
      `}</style>
    </main>
  );
}

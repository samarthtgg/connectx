"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Profile = { id: string; username: string | null; full_name: string | null };
type ScheduledMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  scheduled_for: string;
  created_at: string;
};
type ProfileMap = Record<string, Profile>;

function displayName(profile?: Profile) {
  return profile?.full_name?.trim() || (profile?.username ? `@${profile.username}` : "ConnectX friend");
}

function localDateTimeMin() {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000 + 60000);
  return date.toISOString().slice(0, 16);
}

export default function ScheduledMessagesPage() {
  const [userId, setUserId] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
  const [recipientId, setRecipientId] = useState("");
  const [content, setContent] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const profileMap = useMemo<ProfileMap>(() => Object.fromEntries(profiles.map(profile => [profile.id, profile])), [profiles]);

  const loadData = useCallback(async (id: string) => {
    const [profileResult, scheduledResult] = await Promise.all([
      supabase.from("profiles").select("id,username,full_name").neq("id", id).order("full_name", { ascending: true }),
      supabase.from("scheduled_messages")
        .select("id,sender_id,receiver_id,content,scheduled_for,created_at")
        .eq("sender_id", id).is("sent_at", null).is("group_id", null)
        .order("scheduled_for", { ascending: true }),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (scheduledResult.error) throw scheduledResult.error;
    setProfiles((profileResult.data ?? []) as Profile[]);
    setScheduled((scheduledResult.data ?? []) as ScheduledMessage[]);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) { setError(sessionError.message); setLoading(false); return; }
      const id = data.session?.user.id;
      if (!id) { setError("Sign in to manage your scheduled messages."); setLoading(false); return; }
      setUserId(id);
      try {
        await loadData(id);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load scheduled messages.");
      } finally {
        if (active) setLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id ?? "";
      setUserId(id);
      if (id) void loadData(id).catch(reason => setError(reason instanceof Error ? reason.message : "Could not refresh scheduled messages."));
      else { setProfiles([]); setScheduled([]); setError("Sign in to manage your scheduled messages."); }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [loadData]);

  async function scheduleMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = content.trim();
    const date = new Date(scheduledFor);
    if (!userId) { setError("Sign in before scheduling a message."); return; }
    if (!recipientId) { setError("Choose a recipient."); return; }
    if (!trimmed) { setError("Write a message first."); return; }
    if (!scheduledFor || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      setError("Choose a future date and time."); return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const { data, error: insertError } = await supabase.from("scheduled_messages")
        .insert({ sender_id: userId, receiver_id: recipientId, content: trimmed, scheduled_for: date.toISOString() })
        .select("id,sender_id,receiver_id,content,scheduled_for,created_at").single();
      if (insertError) throw insertError;
      setScheduled(current => [...current, data as ScheduledMessage].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for)));
      setContent(""); setScheduledFor("");
      setNotice("Your message is scheduled.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not schedule this message.");
    } finally { setBusy(false); }
  }

  async function cancelMessage(id: string) {
    if (!userId || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { error: deleteError } = await supabase.from("scheduled_messages")
        .delete().eq("id", id).eq("sender_id", userId).is("sent_at", null);
      if (deleteError) throw deleteError;
      setScheduled(current => current.filter(item => item.id !== id));
      setNotice("Scheduled message cancelled.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not cancel this message.");
    } finally { setBusy(false); }
  }

  return (
    <main className="scheduled-page">
      <header className="scheduled-topbar">
        <Link href="/chat-preview" className="scheduled-back" aria-label="Back to chats">‹</Link>
        <h1>Scheduled messages</h1>
      </header>

      <div className="scheduled-content">
        <section className="sunset-card">
          <span className="sunset-orb sunset-orb-coral" aria-hidden="true" />
          <span className="sunset-orb sunset-orb-pink" aria-hidden="true" />
          <div className="sunset-heading">
            <div><span className="sunset-eyebrow">NEW SCHEDULE</span><h2>Make it memorable.</h2><p>Write now, choose a date and time, and send automatically.</p></div>
            <span className="sunset-spark" aria-hidden="true">✦</span>
          </div>
          <form className="sunset-form" onSubmit={scheduleMessage}>
            <label className="sunset-label" htmlFor="scheduled-recipient">Send to</label>
            <select id="scheduled-recipient" value={recipientId} onChange={event => setRecipientId(event.target.value)} required disabled={loading || !profiles.length}>
              <option value="">{loading ? "Loading people…" : profiles.length ? "Choose a friend" : "No friends available"}</option>
              {profiles.map(profile => <option key={profile.id} value={profile.id}>{displayName(profile)}</option>)}
            </select>
            <label className="sunset-label" htmlFor="scheduled-content">Message</label>
            <textarea id="scheduled-content" rows={4} maxLength={5000} value={content} onChange={event => setContent(event.target.value)} placeholder="Write your message…" required />
            <label className="sunset-label" htmlFor="scheduled-for">Send date and time</label>
            <input id="scheduled-for" type="datetime-local" min={localDateTimeMin()} value={scheduledFor} onChange={event => setScheduledFor(event.target.value)} required />
            <button className="sunset-submit" type="submit" disabled={busy || loading || !userId || !recipientId || !content.trim() || !scheduledFor}>{busy ? "Scheduling…" : "Schedule message"}</button>
          </form>
        </section>

        <section className="scheduled-upcoming-card">
          <div className="scheduled-upcoming-head"><span>UPCOMING</span><strong>{scheduled.length}</strong></div>
          {loading ? <p className="scheduled-empty">Loading your scheduled messages…</p> : scheduled.length ? scheduled.map(item => (
            <article className="scheduled-item" key={item.id}>
              <div className="scheduled-item-copy">
                <strong>{item.content}</strong>
                <span>To {displayName(profileMap[item.receiver_id])}</span>
                <time>{new Date(item.scheduled_for).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time>
              </div>
              <button type="button" onClick={() => void cancelMessage(item.id)} disabled={busy}>Cancel</button>
            </article>
          )) : <p className="scheduled-empty">No upcoming messages. Your scheduled messages will appear here.</p>}
        </section>

        <p className="scheduled-footnote">Messages are sent in the background, even if you close the app. Scheduling currently supports text messages in direct chats.</p>
        {(error || notice) && <p className={error ? "scheduled-feedback error" : "scheduled-feedback"} role="status">{error || notice}</p>}
      </div>

      <style jsx>{`
        .scheduled-page{min-height:100dvh;background:#121116;color:#f8f3f4;padding-bottom:calc(32px + env(safe-area-inset-bottom));font-family:Arial,Helvetica,sans-serif}
        .scheduled-topbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:18px;min-height:76px;padding:0 22px;border-bottom:1px solid #302c36;background:rgba(20,18,25,.94);backdrop-filter:blur(18px)}
        .scheduled-back{color:#f6eaf0;text-decoration:none;font-size:34px;line-height:1}
        .scheduled-topbar h1{margin:0;font-size:21px;font-weight:600;letter-spacing:-.3px}
        .scheduled-content{width:min(100% - 32px,620px);margin:26px auto 0}
        .sunset-card{position:relative;isolation:isolate;overflow:hidden;padding:30px 26px 26px;border:1px solid #ffffff1b;border-radius:34px;background:linear-gradient(145deg,#351c38 0%,#28152f 58%,#351832 100%);box-shadow:0 22px 65px #0005}
        .sunset-orb{position:absolute;z-index:-1;pointer-events:none;border-radius:50%;filter:blur(.3px);opacity:.8}
        .sunset-orb-coral{width:270px;height:270px;top:-150px;left:-105px;background:#bd655b}
        .sunset-orb-pink{width:230px;height:230px;right:-95px;bottom:-135px;background:#a04391;opacity:.7}
        .sunset-heading{position:relative;display:flex;justify-content:space-between;gap:12px;margin-bottom:26px}
        .sunset-eyebrow{color:#d9a5d7;font-size:12px;font-weight:800;letter-spacing:1.6px}
        .sunset-heading h2{margin:12px 0 7px;color:#fff8f3;font-size:30px;line-height:1.12;letter-spacing:-1px}
        .sunset-heading p{max-width:420px;margin:0;color:#efc9c4;font-size:15px;line-height:1.55}
        .sunset-spark{color:#ffc18d;font-size:34px}
        .sunset-form{position:relative;display:grid;gap:12px}
        .sunset-label{margin:5px 3px -5px;color:#f1c9cb;font-size:12px;font-weight:750;letter-spacing:1.2px;text-transform:uppercase}
        .sunset-form select,.sunset-form textarea,.sunset-form input{box-sizing:border-box;width:100%;min-width:0;border:1px solid #ffffff52;border-radius:23px;background:rgba(255,255,255,.13);color:#fff8f4;font:inherit;font-size:16px;outline:none;box-shadow:inset 0 1px 0 #ffffff0c}
        .sunset-form select{min-height:58px;padding:0 16px;color-scheme:dark}
        .sunset-form select option{background:#2a1b31;color:#fff}
        .sunset-form textarea{min-height:132px;resize:vertical;padding:18px 19px;line-height:1.5}
        .sunset-form textarea::placeholder{color:#ead7dfaa}
        .sunset-form input{min-height:66px;padding:0 17px;color-scheme:dark}
        .sunset-form select:focus,.sunset-form textarea:focus,.sunset-form input:focus{border-color:#ffb36e;box-shadow:0 0 0 3px #ffb36e26}
        .sunset-submit{min-height:72px;margin-top:8px;padding:16px 20px;border:0;border-radius:26px;background:#ffb36e;color:#351b20;font-size:20px;font-weight:700;box-shadow:0 9px 25px #160b1c35}
        .sunset-submit:disabled{opacity:.55}
        .scheduled-upcoming-card{margin-top:20px;padding:20px 21px;border:1px solid #ffffff12;border-radius:24px;background:#211d29}
        .scheduled-upcoming-head{display:flex;justify-content:space-between;color:#d9a5d7;font-size:12px;font-weight:800;letter-spacing:1.5px}
        .scheduled-upcoming-head strong{color:#fff;font-size:13px}
        .scheduled-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 0;border-bottom:1px solid #ffffff1c}
        .scheduled-item:last-child{border-bottom:0}
        .scheduled-item-copy{display:grid;gap:6px;min-width:0}
        .scheduled-item-copy strong{color:#fff5f1;font-size:14px;font-weight:600;line-height:1.45;overflow-wrap:anywhere}
        .scheduled-item-copy span,.scheduled-item-copy time{color:#cbb9cb;font-size:12px}
        .scheduled-item button{flex:0 0 auto;padding:9px 13px;border:1px solid #ffffff38;border-radius:12px;background:#ffffff10;color:#ffe0d8;font-size:12px}
        .scheduled-empty,.scheduled-footnote{color:#d7c8d7;font-size:13px;line-height:1.6}
        .scheduled-empty{margin:16px 0 4px}
        .scheduled-footnote{margin:18px 5px 0;opacity:.85}
        .scheduled-feedback{margin:14px 4px 0;color:#a9f3d4;font-size:13px;line-height:1.5}
        .scheduled-feedback.error{color:#ff9eaa}
        @media(max-width:600px){.scheduled-topbar{min-height:68px;padding:0 17px}.scheduled-content{width:calc(100% - 28px);margin-top:16px}.sunset-card{padding:25px 18px 20px;border-radius:28px}.sunset-heading{margin-bottom:21px}.sunset-heading h2{font-size:27px}.sunset-form select{min-height:56px}.sunset-form textarea{min-height:120px;border-radius:20px}.sunset-form input{min-height:62px}.sunset-submit{min-height:68px;border-radius:23px}.scheduled-upcoming-card{padding:17px;border-radius:20px}}
      `}</style>
    </main>
  );
}

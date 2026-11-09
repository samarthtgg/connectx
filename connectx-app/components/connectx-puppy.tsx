"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Mood = "idle" | "jump" | "left" | "right" | "sleep" | "think" | "wave" | "dance" | "happy" | "sad" | "angry" | "cry" | "play";
const colors = ["#9ca3af","#f3a6c8","#f59e0b","#facc15","#84cc16","#22c55e","#14b8a6","#06b6d4","#38bdf8","#60a5fa","#818cf8","#a78bfa","#c084fc","#e879f9","#fb7185","#f87171","#fb923c","#d6b38a","#64748b","#f8fafc"];

export default function ConnectXPuppy() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  const [colorIndex, setColorIndex] = useState(2);
  const [mood, setMood] = useState<Mood>("idle");
  const [bubble, setBubble] = useState("");
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [position, setPosition] = useState({ x: 22, y: 118 });
  const [listening, setListening] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [compact, setCompact] = useState(false);
  const [eyesClosed, setEyesClosed] = useState(false);
  const [lastInteraction, setLastInteraction] = useState(0);
  const [ballPlaying, setBallPlaying] = useState(false);
  const [ballFlight, setBallFlight] = useState<{ x: number; y: number; vx: number; vy: number; bounces: number; returning: boolean } | null>(null);
  const [kickSide, setKickSide] = useState<"left" | "right">("left");
  const [username, setUsername] = useState("friend");
  const [interactionCount, setInteractionCount] = useState(0);
  const [injuredUntil, setInjuredUntil] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [injuryPreview, setInjuryPreview] = useState(false);
  const fastMoveStrikes = useRef(0);
  const dragStartedAt = useRef(0);
  const dragStartPoint = useRef({ x: 0, y: 0 });
  const lastPointAt = useRef(0);
  const userId = useRef<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const recognition = useRef<any>(null);
  const lastTap = useRef(0);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shrinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startBallFetchRef = useRef<() => void>(() => {});

  const showBubble = useCallback((message: string, duration = 2000) => {
    setBubble(message);
    setBubbleVisible(true);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubbleVisible(false), duration);
  }, []);

  const say = useCallback((message: string, nextMood: Mood = "wave") => {
    showBubble(message, 2200);
    setMood(nextMood);
    if (moodTimer.current) clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => setMood("idle"), 3200);
  }, [showBubble]);

  useEffect(() => {
    const savedInjury = Number(localStorage.getItem("cx-puppy-injured-until-v1") || 0);
    if (savedInjury > Date.now()) { setInjuredUntil(savedInjury); setRemainingSeconds(Math.ceil((savedInjury - Date.now()) / 1000)); setVisible(false); }
    else localStorage.removeItem("cx-puppy-injured-until-v1");
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active || !data.user) return;
      userId.current = data.user.id;
      const { data: profile } = await supabase.from("profiles").select("username, full_name").eq("id", data.user.id).maybeSingle();
      if (!active) return;
      const name = profile?.username || profile?.full_name || data.user.user_metadata?.username || data.user.email?.split("@")[0] || "friend";
      setUsername(String(name).replace(/^@/, ""));
      const saved = Number(localStorage.getItem(`cx-puppy-bond-${data.user.id}`) || 0);
      setInteractionCount(Number.isFinite(saved) ? Math.max(0, saved) : 0);
    }).catch(() => {});
    setLastInteraction(Date.now());
    const blinkTimer = setInterval(() => {
      setEyesClosed(true);
      window.setTimeout(() => setEyesClosed(false), 140);
    }, 1000);
    return () => { active = false; clearInterval(blinkTimer); };
  }, []);

  useEffect(() => {
    if (!injuredUntil) return;
    const tick = () => { const left = Math.max(0, Math.ceil((injuredUntil - Date.now()) / 1000)); setRemainingSeconds(left); if (left === 0) { setInjuredUntil(0); localStorage.removeItem("cx-puppy-injured-until-v1"); setVisible(false); localStorage.setItem("cx-puppy-hidden-v1", "true"); } };
    tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer);
  }, [injuredUntil]);

  const interact = useCallback(() => {
    if (injuredUntil > Date.now()) return;
    setLastInteraction(Date.now());
    if (mood === "sad") setMood("idle");
    const now = Date.now();
    if (now - lastPointAt.current >= 1800) {
      lastPointAt.current = now;
      setInteractionCount(current => {
        const next = current + 1;
        if (userId.current) localStorage.setItem(`cx-puppy-bond-${userId.current}`, String(next));
        if ([20, 60, 150].includes(next)) {
          const unlocked = next === 20 ? "Junior" : next === 60 ? "Friendly" : "Best Friend";
          window.setTimeout(() => showBubble(`We did it, ${username}! I am now ${unlocked}! 🎉`, 3200), 150);
        }
        return next;
      });
    }
  }, [mood, showBubble, username, injuredUntil]);

  useEffect(() => {
    if (!visible) return;
    const playfulTimer = window.setInterval(() => {
      if (!dragging && mood === "idle" && !ballPlaying && Math.random() > 0.45) {
        setMood("wave");
        window.setTimeout(() => setMood(current => current === "wave" ? "idle" : current), 1200);
      }
    }, 8500);
    return () => window.clearInterval(playfulTimer);
  }, [visible, dragging, mood, ballPlaying]);

  useEffect(() => {
    const idleTimer = window.setInterval(() => {
      if (Date.now() - lastInteraction >= 30000 && mood === "idle" && !ballPlaying) {
        setMood("sad");
        showBubble("Are you still there? 🥺", 2600);
      }
    }, 1000);
    return () => window.clearInterval(idleTimer);
  }, [lastInteraction, mood, ballPlaying, showBubble]);

  useEffect(() => {
    try {
      const hidden = localStorage.getItem("cx-puppy-hidden-v1");
      const savedPosition = localStorage.getItem("cx-puppy-position-v1");
      setVisible(hidden !== "true");
      setColorIndex(2);
      localStorage.setItem("cx-puppy-color-v1", "2");
      if (savedPosition) {
        const parsed = JSON.parse(savedPosition);
        if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) setPosition(parsed);
      }
    } catch {}
    return () => {
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
      if (moodTimer.current) clearTimeout(moodTimer.current);
      recognition.current?.stop?.();
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (/login|signup|register/.test(pathname)) {
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
      setBubble("Create an account or log in! 🐾");
      setBubbleVisible(true);
    } else {
      setBubbleVisible(false);
    }
  }, [pathname, visible]);

  const level = interactionCount >= 150 ? "Best Friend" : interactionCount >= 60 ? "Friendly" : interactionCount >= 20 ? "Junior" : "Baby";
  const levelStart = interactionCount >= 150 ? 150 : interactionCount >= 60 ? 60 : interactionCount >= 20 ? 20 : 0;
  const nextLevelAt = interactionCount >= 150 ? 150 : interactionCount >= 60 ? 150 : interactionCount >= 20 ? 60 : 20;
  const levelProgress = interactionCount >= 150 ? 100 : Math.min(100, ((interactionCount - levelStart) / (nextLevelAt - levelStart)) * 100);

  const handleCommand = useCallback((spoken: string) => {
    if (injuredUntil > Date.now()) return;
    const command = spoken.toLowerCase().trim();
    interact();
    if (/\b(happy|happier)\b/.test(command)) say("Yay! I'm so happy! 🥰", "happy");
    else if (/\b(sad|unhappy)\b/.test(command)) say("Aww... I'm feeling sad. 😢", "sad");
    else if (/\b(angry|mad)\b/.test(command)) say("Grrr! I'm a little angry! 😠", "angry");
    else if (/\b(cry|crying)\b/.test(command)) say("Boohoo... 😭", "cry");
    else if (/(play with (the )?ball|play ball|fetch)/.test(command)) { startBallFetchRef.current(); say("Yippee! Let\u0027s play fetch! 🎾", "play"); }
    else if (/(jump|hop)/.test(command)) say("Wheee! 🐾", "jump");
    else if (/(go |move |walk )?left|turn left/.test(command)) { setPosition(p => ({ ...p, x: Math.max(8, p.x - 105) })); say("Walking left!", "left"); }
    else if (/(go |move |walk )?right|turn right/.test(command)) { setPosition(p => ({ ...p, x: Math.min(window.innerWidth - 112, p.x + 105) })); say("Walking right!", "right"); }
    else if (/(sleep|nap|rest)/.test(command)) say("Zzz... sweet dreams 💜", "sleep");
    else if (/(think|thinking)/.test(command)) say("Hmm... let me think 🤔", "think");
    else if (/(dance|dancing)/.test(command)) say("Dance party! 💃", "dance");
    else if (/(high five|give me five|paw)/.test(command)) { if (interactionCount >= 20) say(`High five, ${username}! 🐾`, "wave"); else say("Play with me more to unlock high five!", "think"); }
    else if (/(roll over|roll)/.test(command)) { if (interactionCount >= 60) say(`Rolling over for you, ${username}!`, "dance"); else say("Reach Friendly level to unlock roll over!", "think"); }
    else if (/(play dead|pretend dead)/.test(command)) { if (interactionCount >= 150) say(`Anything for you, ${username}!`, "sleep"); else say("Become my Best Friend to unlock this trick!", "think"); }
    else if (/(hello|hi|hey)/.test(command)) say(`Hey ${username}! I missed you! 🐾`, "wave");
    else if (/(sit|stop|stay)/.test(command)) say("I'll stay right here.", "idle");
    else if (/(wake|awake)/.test(command)) say("I'm awake! Let's play!", "wave");
    else if (/(come here|come to me|follow me|come)/.test(command)) { setPosition(p => ({ ...p, x: Math.max(8, Math.min(window.innerWidth - 112, window.innerWidth / 2 - 56)), y: Math.max(78, Math.min(window.innerHeight - 150, window.innerHeight / 2 - 56)) })); say(`Coming to you, ${username}!`, "jump"); }
    else if (/(spin|turn around)/.test(command)) say("Wheee, round and round!", "dance");
    else if (/(hide)/.test(command)) { setVisible(false); localStorage.setItem("cx-puppy-hidden-v1", "true"); }
    else say("Hmm? 🐾", "think");
  }, [say, interactionCount, username, interact, injuredUntil]);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { say("Woof! 🐾", "think"); return; }
    const instance = new SpeechRecognition();
    recognition.current = instance;
    instance.lang = "en-IN";
    instance.interimResults = false;
    instance.maxAlternatives = 1;
    instance.onstart = () => { setListening(true); say(`I am listening, ${username}! 🐾`, "wave"); };
    instance.onresult = (event: any) => handleCommand(event.results[0][0].transcript);
    instance.onerror = () => say("Woof? 🐾", "think");
    instance.onend = () => setListening(false);
    try { instance.start(); } catch { setListening(false); }
  };

  const startBallFetch = () => {
    if (injuredUntil > Date.now() || ballFlight) return;
    const startX = Math.max(18, Math.min(window.innerWidth - 46, position.x + 48));
    const startY = Math.max(18, Math.min(window.innerHeight - 46, position.y + 74));
    setKickSide(side => side === "left" ? "right" : "left");
    setBallPlaying(true);
    setBallFlight({ x: startX, y: startY, vx: (Math.random() > 0.5 ? 1 : -1) * (5.5 + Math.random() * 5), vy: -8 - Math.random() * 5, bounces: 0, returning: false });
  };
  startBallFetchRef.current = startBallFetch;

  useEffect(() => {
    if (!ballFlight) return;
    let previous = 0;
    let frame = 0;
    const step = (time: number) => {
      if (!previous) previous = time;
      const scale = Math.min(2, (time - previous) / 16.67);
      previous = time;
      setBallFlight(current => {
        if (!current) return null;
        let { x, y, vx, vy, bounces, returning } = current;
        const dx = position.x + 48 - x; const dy = position.y + 72 - y;
        const distance = Math.hypot(dx, dy);
        if (returning) {
          if (distance < 24) { setBallPlaying(false); return null; }
          vx = vx * 0.82 + (dx / Math.max(1, distance)) * 1.7;
          vy = vy * 0.82 + (dy / Math.max(1, distance)) * 1.7;
        } else { vy += 0.34 * scale; }
        x += vx * scale; y += vy * scale;
        const maxX = Math.max(12, window.innerWidth - 40); const maxY = Math.max(12, window.innerHeight - 40);
        if (x < 8 || x > maxX) { x = Math.max(8, Math.min(maxX, x)); vx *= -0.82; bounces += 1; }
        if (y < 8) { y = 8; vy = Math.abs(vy) * 0.82; bounces += 1; }
        if (y > maxY) { y = maxY; vy = -Math.abs(vy) * 0.72; bounces += 1; }
        if (!returning && bounces >= 3) returning = true; return { x, y, vx, vy, bounces, returning };
      });
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [ballFlight !== null, position.x, position.y]);
  const finishDrag = () => {
    setDragging(false);
    if (injuredUntil > Date.now()) return;
    const elapsed = Math.max(1, Date.now() - dragStartedAt.current);
    const distance = Math.hypot(position.x - dragStartPoint.current.x, position.y - dragStartPoint.current.y);
    if (distance < 105 || distance / elapsed < 1.05) return;
    fastMoveStrikes.current += 1;
    if (fastMoveStrikes.current === 1) say('Wait, I am little! Please move me gently 🥺', 'sad');
    else if (fastMoveStrikes.current === 2) say('Please do not do that! It hurts me 😟', 'cry');
    else {
      const until = Date.now() + 600000;
      setInjuredUntil(until); setRemainingSeconds(600); setInjuryPreview(true);
      recognition.current?.stop?.();
      localStorage.setItem('cx-puppy-injured-until-v1', String(until));
      showBubble('I am hurt... I need 10 minutes to recover. 🩹', 3800);
      window.setTimeout(() => { setInjuryPreview(false); setVisible(false); localStorage.setItem('cx-puppy-hidden-v1', 'true'); }, 4000);
    }
  };

  const begin = () => {
    if (injuredUntil > Date.now()) return;
    setVisible(true);
    localStorage.setItem("cx-puppy-hidden-v1", "false");
    setMood("wave");
  };

  const moveTo = (clientX: number, clientY: number) => {
    if (injuredUntil > Date.now()) return;
    const x = Math.max(8, Math.min(window.innerWidth - 104, clientX - dragOffset.current.x));
    const y = Math.max(78, Math.min(window.innerHeight - 150, clientY - dragOffset.current.y));
    setPosition({ x, y });
    localStorage.setItem("cx-puppy-position-v1", JSON.stringify({ x, y }));
  };

  const changeColor = () => {
    const next = (colorIndex + 1) % colors.length;
    setColorIndex(next);
    localStorage.setItem("cx-puppy-color-v1", String(next));
    say(`New colour ${next + 1} of 20! 🎨`, "wave");
  };

  if (injuryPreview) return (
    <div className="puppy-injury-scene fixed bottom-24 right-4 z-[110] flex w-64 flex-col items-center rounded-3xl border border-rose-300/30 bg-slate-950/95 p-4 text-center text-white shadow-2xl">
      <style>{`
        @keyframes puppy-stumble { 0%{transform:translateY(0) rotate(0) scale(1)} 12%{transform:translate(-5px,-8px) rotate(-9deg)} 24%{transform:translate(7px,-3px) rotate(10deg)} 38%{transform:translate(-4px,4px) rotate(-12deg)} 52%{transform:translate(0,13px) rotate(17deg) scale(.96)} 68%{transform:translate(0,15px) rotate(90deg) scale(.9)} 100%{transform:translate(0,15px) rotate(90deg) scale(.9)} }
        @keyframes puppy-fall-fade { 0%,35%{opacity:1} 65%,100%{opacity:.82} }
        @keyframes puppy-tear { 0%,35%{opacity:0;transform:translateY(-5px)} 48%,100%{opacity:1;transform:translateY(0)} }
        @keyframes puppy-bandage { 0%,45%{opacity:0;transform:scale(.2) rotate(-25deg)} 65%,100%{opacity:1;transform:scale(1) rotate(0)} }
        @keyframes puppy-blood { 0%,48%{opacity:0;transform:scale(.2)} 66%,100%{opacity:1;transform:scale(1)} }
        @keyframes puppy-pulse { 0%,100%{opacity:.45} 50%{opacity:1} }
        .puppy-injury-body{transform-origin:60px 70px;animation:puppy-stumble 3.8s cubic-bezier(.3,.1,.7,1) both}
        .puppy-injury-tear{animation:puppy-tear 3.8s ease-out both}
        .puppy-injury-bandage{transform-box:fill-box;transform-origin:center;animation:puppy-bandage 3.8s ease-out both}
        .puppy-injury-blood{transform-box:fill-box;transform-origin:center;animation:puppy-blood 3.8s ease-out both}
        .puppy-injury-caption{animation:puppy-pulse 1.2s ease-in-out infinite}
        @media(prefers-reduced-motion:reduce){.puppy-injury-body,.puppy-injury-tear,.puppy-injury-bandage,.puppy-injury-blood,.puppy-injury-caption{animation:none!important}}
      `}</style>
      <svg viewBox="0 0 120 112" className="h-32 w-32 overflow-visible">
        <g className="puppy-injury-body">
          <path d="M34 73 Q27 55 39 42 L48 27 Q54 17 63 36 Q76 23 86 36 L96 57 Q103 78 85 88 L43 88Z" fill={colors[colorIndex]} stroke="#e2e8f0" strokeWidth="3"/>
          <path d="M43 43 L35 16 Q34 5 46 15 L61 35 M76 35 L91 13 Q101 7 99 22 L91 49" fill={colors[colorIndex]} stroke="#e2e8f0" strokeWidth="3"/>
          <ellipse cx="65" cy="59" rx="29" ry="27" fill="#f1f5f9"/>
          <path d="M47 46 L65 44 L66 60 L48 62Z" fill="#e5e7eb" stroke="#94a3b8" strokeWidth="2"/>
          <path d="M47 50 L65 48 M48 56 L65 54" stroke="#94a3b8" strokeWidth="2"/>
          <path d="M75 56 Q80 54 83 58" fill="none" stroke="#172033" strokeWidth="2.5"/>
          <path d="M61 68 Q66 64 71 68" fill="none" stroke="#475569" strokeWidth="2.5"/>
          <path className="puppy-injury-bandage" d="M44 44 L66 42 L68 59 L46 62Z" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2"/>
          <path d="M47 48 L66 46 M47 54 L67 52 M49 59 L67 57" stroke="#94a3b8" strokeWidth="2"/>
          <path className="puppy-injury-blood" d="M78 69 Q84 76 78 82 Q72 76 78 69Z" fill="#a61b1b"/>
          <path className="puppy-injury-blood" d="M38 79 Q47 74 55 80" stroke="#a61b1b" strokeWidth="3" strokeLinecap="round" fill="none"/>
        </g>
        <path className="puppy-injury-tear" d="M84 61 Q89 68 84 73 Q79 68 84 61Z" fill="#38bdf8"/>
      </svg>
      <p className="puppy-injury-caption text-sm font-semibold text-rose-200">Oh no... Puppy is hurt 🩹</p>
      <p className="mt-1 text-xs text-slate-300">Puppy is resting and needs 10 minutes to recover.</p>
    </div>
  );

  if (!visible) return <button type="button" disabled={remainingSeconds > 0} onClick={() => { if (injuredUntil > Date.now()) return; setVisible(true); localStorage.setItem("cx-puppy-hidden-v1","false"); showBubble("I am back! 🐾", 2000); }} className="fixed bottom-24 right-4 z-[100] rounded-full border border-cyan-300/30 bg-slate-950/90 px-4 py-2 text-sm font-semibold text-cyan-200 shadow-xl disabled:cursor-not-allowed disabled:opacity-70">{remainingSeconds > 0 ? "Puppy resting 🩹 " + Math.floor(remainingSeconds / 60) + ":" + String(remainingSeconds % 60).padStart(2, "0") : "Show puppy 🐾"}</button>;

  return (
    <>
      {ballFlight && <div aria-hidden="true" className="pointer-events-none fixed z-[99] h-7 w-7 rounded-full border-2 border-white/90 bg-orange-400 shadow-[0_5px_12px_rgba(0,0,0,.45)]" style={{ left: ballFlight.x, top: ballFlight.y, transform: "rotate(" + (ballFlight.x * 3) + "deg)" }}><span className="absolute inset-x-1 top-1/2 h-[2px] -translate-y-1/2 rotate-45 bg-white/90"/><span className="absolute inset-x-1 top-1/2 h-[2px] -translate-y-1/2 -rotate-45 bg-white/90"/></div>}
      {visible && (
        <div className="fixed z-[100] touch-none select-none" style={{ left: position.x, top: position.y, transition: dragging ? "none" : "left 650ms cubic-bezier(.2,.8,.2,1), top 650ms cubic-bezier(.2,.8,.2,1)" }}>
          {bubbleVisible && <div className="mb-2 max-w-56 rounded-2xl border border-cyan-300/25 bg-slate-950/95 px-3 py-2 text-xs font-medium text-white shadow-xl">
            {bubble}
          </div>}
          <div
            onPointerDown={(event) => { if (injuredUntil > Date.now()) return; interact(); const rect = event.currentTarget.getBoundingClientRect(); dragOffset.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }; dragStartedAt.current = Date.now(); dragStartPoint.current = { x: position.x, y: position.y }; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={(event) => { if (dragging) moveTo(event.clientX, event.clientY); }}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            onDoubleClick={() => { if (injuredUntil <= Date.now()) changeColor(); }}
            onTouchEnd={() => { const now = Date.now(); if (now - lastTap.current < 330) changeColor(); lastTap.current = now; }}
            onClick={() => { if (injuredUntil > Date.now()) return; interact(); if (shrinkTimer.current) clearTimeout(shrinkTimer.current); setCompact(false); shrinkTimer.current = setTimeout(() => setCompact(true), 3000); }}
            className={`relative cursor-grab active:cursor-grabbing transition-transform duration-700 ease-in-out ${compact ? "h-[76px] w-[76px]" : "h-[112px] w-[112px]"}`}
            style={{ touchAction: "none" }}
            aria-label="ConnectX puppy. Drag to move; double tap to change colour."
          >
            <svg viewBox="0 0 120 112" className={`h-full w-full drop-shadow-[0_9px_14px_rgba(0,0,0,.5)] cx-puppy-idle ${ballPlaying ? "cx-puppy-fetch-stance" : ""} ${mood === "jump" ? "cx-puppy-jump" : mood === "sleep" ? "cx-puppy-sleep" : mood === "think" ? "cx-puppy-think" : mood === "dance" ? "cx-puppy-dance" : mood === "left" ? "cx-puppy-left" : mood === "right" ? "cx-puppy-right" : ""}`}>
              <path className={`cx-puppy-tail ${mood === "happy" || mood === "wave" || mood === "play" ? "cx-puppy-tail-excited" : ""}`} d="M30 76 C7 72 12 43 24 46 C34 49 22 62 35 62" fill="none" stroke={colors[colorIndex]} strokeWidth="11" strokeLinecap="round"/>
              <ellipse cx="61" cy="91" rx="34" ry="7" fill="#020617" opacity=".25"/>
              <path d="M34 73 Q27 55 39 42 L48 27 Q54 17 63 36 Q76 23 86 36 L96 57 Q103 78 85 88 L43 88Z" fill={colors[colorIndex]} stroke="#e2e8f0" strokeWidth="3"/>
              <path d="M43 43 L35 16 Q34 5 46 15 L61 35 M76 35 L91 13 Q101 7 99 22 L91 49" fill={colors[colorIndex]} stroke="#e2e8f0" strokeWidth="3" strokeLinejoin="round"/>
              <path d="M42 22 L46 36 L55 35Z M83 34 L94 20 L91 40Z" fill="#f9a8d4"/>
              <ellipse cx="65" cy="59" rx="29" ry="27" fill="#f1f5f9"/>
              {mood === "angry" && <g><path d="M49 49 L60 53 M81 49 L70 53" stroke="#7f1d1d" strokeWidth="3.2" strokeLinecap="round"/></g>}
              {eyesClosed ? <g><path d="M50 56 Q55 52 60 56 M70 56 Q75 52 80 56" fill="none" stroke="#172033" strokeWidth="2.8" strokeLinecap="round"/></g> : <g><ellipse cx="55" cy="55" rx="4.2" ry="6" fill="#172033"/><ellipse cx="75" cy="55" rx="4.2" ry="6" fill="#172033"/><circle cx="56" cy="53" r="1.8" fill="white"/><circle cx="76" cy="53" r="1.8" fill="white"/></g>}
              {(mood === "sad" || mood === "cry") && <g><path d="M50 57 Q55 61 60 57 M70 57 Q75 61 80 57" fill="none" stroke="#172033" strokeWidth="2.6" strokeLinecap="round"/><path d="M53 59 Q50 68 55 70 Q59 68 56 60 M76 59 Q73 68 78 70 Q82 68 79 60" fill="#38bdf8" opacity=".9"/></g>}
              <ellipse cx="45" cy="66" rx="6" ry="3" fill="#f9a8d4" opacity=".8"/><ellipse cx="85" cy="66" rx="6" ry="3" fill="#f9a8d4" opacity=".8"/>
              <path d="M61 65 Q65 60 69 65 Q66 72 65 72Z" fill="#f472b6"/>
              {mood === "happy" ? <path d="M53 72 Q65 86 77 72" fill="none" stroke="#475569" strokeWidth="2.4" strokeLinecap="round"/> : mood === "sad" || mood === "cry" ? <path d="M55 79 Q65 68 75 79" fill="none" stroke="#475569" strokeWidth="2.4" strokeLinecap="round"/> : mood === "angry" ? <path d="M56 78 Q65 70 74 78" fill="none" stroke="#475569" strokeWidth="2.4" strokeLinecap="round"/> : <path d="M65 72 Q59 78 54 73 M65 72 Q71 78 76 73" fill="none" stroke="#475569" strokeWidth="1.7" strokeLinecap="round"/>}
              {ballPlaying && <g className="cx-puppy-ball"><circle cx="108" cy="91" r="9" fill="#fb923c" stroke="#fff" strokeWidth="1.5"/><path d="M100 87 Q108 91 116 87 M100 95 Q108 91 116 95" fill="none" stroke="#fff" strokeWidth="1.4"/></g>}
              {ballPlaying ? <g className="cx-puppy-four-legs">
                <path d="M43 73 Q36 80 39 95 L48 98 L53 78Z M73 77 L80 96 L89 96 Q91 80 83 73Z" fill="#dbeafe" stroke="#94a3b8" strokeWidth="2" strokeLinejoin="round"/>
                <path d={kickSide === "left" ? "M69 82 L74 100 L84 100 Q86 87 79 78Z" : "M47 78 Q41 88 44 100 L54 101 L58 82Z"} fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2" strokeLinejoin="round"/>
                <path className={kickSide === "left" ? "cx-puppy-kick-left" : "cx-puppy-kick-right"} d={kickSide === "left" ? "M47 82 Q39 91 29 91 L25 97 L34 101 Q49 100 58 88Z" : "M73 82 Q81 91 91 91 L95 97 L86 101 Q71 100 62 88Z"} fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2" strokeLinejoin="round"/>
              </g> : <path d="M43 82 Q34 94 45 99 L56 99 Q63 94 55 84 M76 84 Q69 95 80 100 L91 99 Q98 93 87 81" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2"/>}
              {mood === "sleep" && <><path d="M49 56 Q55 60 60 56 M70 56 Q76 60 81 56" fill="none" stroke="#172033" strokeWidth="2"/><text x="94" y="17" fill="#c4b5fd" fontSize="15">Zz</text></>}
              {mood === "think" && <><circle cx="105" cy="23" r="3" fill="#c4b5fd"/><text x="99" y="15" fill="#c4b5fd" fontSize="13">?</text></>}
              {mood === "cry" && <text x="94" y="17" fill="#60a5fa" fontSize="14">😭</text>}\n              {mood === "wave" && <path d="M91 79 Q105 67 104 54" fill="none" stroke="#e2e8f0" strokeWidth="5" strokeLinecap="round"/>}
            </svg>
            <button type="button" aria-label="Talk to Puppy" title="Talk to Puppy" onPointerDown={event => event.stopPropagation()} onClick={startListening} className="absolute -bottom-2 -right-1 rounded-full border border-white/20 bg-slate-950/95 px-2 py-1 text-xs text-white shadow-lg">🎙️</button>
          </div>
        </div>
      )}
      <style jsx global>{`
        @keyframes cxPuppyKickLeft { 0%,100%{transform:rotate(0)} 35%{transform:rotate(-28deg) translate(-5px,-3px)} 65%{transform:rotate(8deg)} }\n        @keyframes cxPuppyKickRight { 0%,100%{transform:rotate(0)} 35%{transform:rotate(28deg) translate(5px,-3px)} 65%{transform:rotate(-8deg)} }\n        @keyframes cxPuppyFetch { from{transform:translateY(1px) scaleY(.99)} to{transform:translateY(3px) scaleY(1.01)} }\n        .cx-puppy-fetch-stance{transform-origin:50% 90%;animation:cxPuppyFetch .5s ease-in-out infinite alternate}\n        .cx-puppy-kick-left{transform-box:fill-box;transform-origin:90% 15%;animation:cxPuppyKickLeft .55s ease-in-out infinite}\n        .cx-puppy-kick-right{transform-box:fill-box;transform-origin:10% 15%;animation:cxPuppyKickRight .55s ease-in-out infinite}\n        @keyframes cxPuppyBlink { 0%, 40%, 46%, 100% { transform: scaleY(1); } 43%, 44% { transform: scaleY(.06); } }
        @keyframes cxPuppyBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes cxPuppyTail { 0%,100%{transform:rotate(-10deg)} 50%{transform:rotate(20deg)} }
        @keyframes cxPuppyJump { 0%,100%{transform:translateY(0) rotate(0)} 40%{transform:translateY(-42px) rotate(-9deg)} 70%{transform:translateY(-20px) rotate(7deg)} }
        @keyframes cxPuppyDance { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-15deg) translateY(-5px)} 75%{transform:rotate(15deg) translateY(-5px)} }
        @keyframes cxPuppyThink { to{transform:rotate(8deg)} }
        @keyframes cxPuppyTailFast { 0%,100%{transform:rotate(-22deg)} 50%{transform:rotate(30deg)} }
        @keyframes cxPuppyWalk { 0%,100%{transform:translateY(0) rotate(0)} 25%{transform:translateY(-3px) rotate(-4deg)} 75%{transform:translateY(-3px) rotate(4deg)} }
        @keyframes cxPuppyWave { 0%,100%{transform:rotate(0)} 30%{transform:rotate(-7deg) translateY(-4px)} 65%{transform:rotate(7deg) translateY(-2px)} }
        .cx-puppy-idle{animation:cxPuppyBob 2.2s ease-in-out infinite;transform-origin:50% 90%}
        .cx-puppy-eyes{transform-box:fill-box;transform-origin:center;animation:cxPuppyBlink 1s infinite ease-in-out}
        .cx-puppy-tail{transform-origin:28px 70px;animation:cxPuppyTail .55s ease-in-out infinite}
        .cx-puppy-tail-excited{animation:cxPuppyTailFast .2s ease-in-out infinite}
        @media (prefers-reduced-motion:reduce){.cx-puppy-idle,.cx-puppy-tail,.cx-puppy-tail-excited,.cx-puppy-jump,.cx-puppy-dance{animation:none!important}}
        .cx-puppy-jump{animation:cxPuppyJump .7s ease-in-out 2}
        .cx-puppy-sleep{transform:rotate(12deg);opacity:.8}
        .cx-puppy-think{animation:cxPuppyThink 1.1s ease-in-out infinite alternate}
        .cx-puppy-dance{animation:cxPuppyDance .45s ease-in-out 5}
        .cx-puppy-left{transform:translateX(-8px) scaleX(.96)}
        .cx-puppy-right{transform:translateX(8px) scaleX(1.04)}
        .cx-puppy-left,.cx-puppy-right{animation:cxPuppyWalk .32s ease-in-out 3}
        .cx-puppy-dance{transform-origin:50% 80%}
        .cx-puppy-idle:has(.cx-puppy-tail-excited){animation:cxPuppyWave .55s ease-in-out 2}
      `}</style>
    </>
  );
}

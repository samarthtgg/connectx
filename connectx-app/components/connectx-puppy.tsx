"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Mood = "idle" | "jump" | "left" | "right" | "sleep" | "think" | "wave" | "dance" | "happy" | "sad" | "angry" | "cry" | "play";
const colors = ["#9ca3af","#f3a6c8","#f59e0b","#facc15","#84cc16","#22c55e","#14b8a6","#06b6d4","#38bdf8","#60a5fa","#818cf8","#a78bfa","#c084fc","#e879f9","#fb7185","#f87171","#fb923c","#d6b38a","#64748b","#f8fafc"];

export default function ConnectXPuppy() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [colorIndex, setColorIndex] = useState(0);
  const [mood, setMood] = useState<Mood>("idle");
  const [bubble, setBubble] = useState("");
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [position, setPosition] = useState({ x: 22, y: 118 });
  const [listening, setListening] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [compact, setCompact] = useState(false);
  const [eyesClosed, setEyesClosed] = useState(false);
  const [lastInteraction, setLastInteraction] = useState(Date.now());
  const [ballPlaying, setBallPlaying] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const recognition = useRef<any>(null);
  const lastTap = useRef(0);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shrinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const blinkTimer = setInterval(() => {
      setEyesClosed(true);
      window.setTimeout(() => setEyesClosed(false), 140);
    }, 1000);
    return () => clearInterval(blinkTimer);
  }, []);

  const interact = () => {
    setLastInteraction(Date.now());
    if (mood === "sad") setMood("idle");
  };

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
      const savedColor = Number(localStorage.getItem("cx-puppy-color-v1") || 0);
      const savedPosition = localStorage.getItem("cx-puppy-position-v1");
      setVisible(hidden !== "true");
      setColorIndex(Number.isFinite(savedColor) ? ((savedColor % colors.length) + colors.length) % colors.length : 0);
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

  const handleCommand = useCallback((spoken: string) => {
    const command = spoken.toLowerCase().trim();
    interact();
    if (/\b(happy|happier)\b/.test(command)) say("Yay! I'm so happy! 🥰", "happy");
    else if (/\b(sad|unhappy)\b/.test(command)) say("Aww... I'm feeling sad. 😢", "sad");
    else if (/\b(angry|mad)\b/.test(command)) say("Grrr! I'm a little angry! 😠", "angry");
    else if (/\b(cry|crying)\b/.test(command)) say("Boohoo... 😭", "cry");
    else if (/(play with (the )?ball|play ball|fetch)/.test(command)) { setBallPlaying(true); say("Yippee! Let's play fetch! 🎾", "play"); window.setTimeout(() => setBallPlaying(false), 6500); }
    else if (/(jump|hop)/.test(command)) say("Wheee! 🐾", "jump");
    else if (/(go |move )?left|turn left/.test(command)) { setPosition(p => ({ ...p, x: Math.max(8, p.x - 105) })); say("Going left!", "left"); }
    else if (/(go |move )?right|turn right/.test(command)) { setPosition(p => ({ ...p, x: Math.min(window.innerWidth - 112, p.x + 105) })); say("Going right!", "right"); }
    else if (/(sleep|nap|rest)/.test(command)) say("Zzz... sweet dreams 💜", "sleep");
    else if (/(think|thinking)/.test(command)) say("Hmm... let me think 🤔", "think");
    else if (/(dance|dancing)/.test(command)) say("Dance party! 💃", "dance");
    else if (/(hello|hi|hey)/.test(command)) say("Hello bestie! 🐾", "wave");
    else if (/(sit|stop|stay)/.test(command)) say("I'll stay right here.", "idle");
    else if (/(wake|awake)/.test(command)) say("I'm awake! Let's play!", "wave");
    else if (/(come here|come)/.test(command)) { setPosition(p => ({ ...p, x: Math.max(8, Math.min(window.innerWidth - 112, p.x - 65)) })); say("Coming!", "jump"); }
    else if (/(spin|turn around)/.test(command)) say("Wheee, round and round!", "dance");
    else if (/(hide)/.test(command)) { setVisible(false); localStorage.setItem("cx-puppy-hidden-v1", "true"); }
    else say("Hmm? 🐾", "think");
  }, [say]);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { say("Woof! 🐾", "think"); return; }
    const instance = new SpeechRecognition();
    recognition.current = instance;
    instance.lang = "en-IN";
    instance.interimResults = false;
    instance.maxAlternatives = 1;
    instance.onstart = () => { setListening(true); setMenuOpen(false); say("Woof! 🐾", "wave"); };
    instance.onresult = (event: any) => handleCommand(event.results[0][0].transcript);
    instance.onerror = () => say("Woof? 🐾", "think");
    instance.onend = () => setListening(false);
    try { instance.start(); } catch { setListening(false); }
  };

  const begin = () => {
    setVisible(true);
    localStorage.setItem("cx-puppy-hidden-v1", "false");
    setMood("wave");
  };

  const moveTo = (clientX: number, clientY: number) => {
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

  if (!visible) return <button type="button" onClick={() => { setVisible(true); localStorage.setItem("cx-puppy-hidden-v1","false"); showBubble("I'm back! 🐾", 2000); }} className="fixed bottom-24 right-4 z-[100] rounded-full border border-cyan-300/30 bg-slate-950/90 px-4 py-2 text-sm font-semibold text-cyan-200 shadow-xl">Show puppy 🐾</button>;

  return (
    <>
      {visible && (
        <div className="fixed z-[100] touch-none select-none" style={{ left: position.x, top: position.y }}>
          {bubbleVisible && <div className="mb-2 max-w-56 rounded-2xl border border-cyan-300/25 bg-slate-950/95 px-3 py-2 text-xs font-medium text-white shadow-xl">
            {bubble}
          </div>}
          {menuOpen && <div className="mb-2 w-52 rounded-2xl border border-cyan-300/25 bg-slate-950/95 p-2 text-sm text-white shadow-2xl">
            <button onPointerDown={e => e.stopPropagation()} onClick={startListening} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-white/10">{listening ? "🔴 Listening…" : "🎙️ Talk to puppy"}</button>
            <button onPointerDown={e => e.stopPropagation()} onClick={() => { changeColor(); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-white/10">🎨 Change colour ({colorIndex + 1}/20)</button>
            <a href="/puppy-settings" onPointerDown={e => e.stopPropagation()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-white/10">📖 Puppy settings & how to talk</a>\n            <button onPointerDown={e => e.stopPropagation()} onClick={() => { setVisible(false); setMenuOpen(false); localStorage.setItem("cx-puppy-hidden-v1","true"); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-rose-300 hover:bg-white/10">🙈 Hide puppy</button>
          </div>}
          <div
            onPointerDown={(event) => { interact(); const rect = event.currentTarget.getBoundingClientRect(); dragOffset.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={(event) => { if (dragging) moveTo(event.clientX, event.clientY); }}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
            onDoubleClick={changeColor}
            onTouchEnd={() => { const now = Date.now(); if (now - lastTap.current < 330) changeColor(); lastTap.current = now; }}
            onClick={() => { interact(); if (shrinkTimer.current) clearTimeout(shrinkTimer.current); setCompact(false); shrinkTimer.current = setTimeout(() => setCompact(true), 3000); }}
            className={`relative cursor-grab active:cursor-grabbing transition-transform duration-700 ease-in-out ${compact ? "h-[76px] w-[76px]" : "h-[112px] w-[112px]"}`}
            style={{ touchAction: "none" }}
            aria-label="ConnectX puppy. Drag to move; double tap to change colour."
          >
            <svg viewBox="0 0 120 112" className={`h-full w-full drop-shadow-[0_9px_14px_rgba(0,0,0,.5)] cx-puppy-idle ${mood === "jump" ? "cx-puppy-jump" : mood === "sleep" ? "cx-puppy-sleep" : mood === "think" ? "cx-puppy-think" : mood === "dance" ? "cx-puppy-dance" : mood === "left" ? "cx-puppy-left" : mood === "right" ? "cx-puppy-right" : ""}`}>
              <path className="cx-puppy-tail" d="M30 76 C7 72 12 43 24 46 C34 49 22 62 35 62" fill="none" stroke={colors[colorIndex]} strokeWidth="11" strokeLinecap="round"/>
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
              <path d="M43 82 Q34 94 45 99 L56 99 Q63 94 55 84 M76 84 Q69 95 80 100 L91 99 Q98 93 87 81" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2"/>
              {mood === "sleep" && <><path d="M49 56 Q55 60 60 56 M70 56 Q76 60 81 56" fill="none" stroke="#172033" strokeWidth="2"/><text x="94" y="17" fill="#c4b5fd" fontSize="15">Zz</text></>}
              {mood === "think" && <><circle cx="105" cy="23" r="3" fill="#c4b5fd"/><text x="99" y="15" fill="#c4b5fd" fontSize="13">?</text></>}
              {mood === "cry" && <text x="94" y="17" fill="#60a5fa" fontSize="14">😭</text>}\n              {mood === "wave" && <path d="M91 79 Q105 67 104 54" fill="none" stroke="#e2e8f0" strokeWidth="5" strokeLinecap="round"/>}
            </svg>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
              <button aria-label="Puppy options" onPointerDown={e => e.stopPropagation()} onClick={() => setMenuOpen(v => !v)} className="rounded-full border border-white/15 bg-slate-950/95 px-3 py-1 text-sm text-white shadow-lg">•••</button>
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`
        @keyframes cxPuppyBall { 0%{transform:translate(0,0) rotate(0)} 25%{transform:translate(15px,-18px) rotate(90deg)} 50%{transform:translate(25px,0) rotate(180deg)} 75%{transform:translate(10px,-12px) rotate(270deg)} 100%{transform:translate(0,0) rotate(360deg)} }\n        .cx-puppy-ball{transform-origin:108px 91px;animation:cxPuppyBall .65s ease-in-out infinite}\n        @keyframes cxPuppyBlink { 0%, 40%, 46%, 100% { transform: scaleY(1); } 43%, 44% { transform: scaleY(.06); } }
        @keyframes cxPuppyBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes cxPuppyTail { 0%,100%{transform:rotate(-10deg)} 50%{transform:rotate(20deg)} }
        @keyframes cxPuppyJump { 0%,100%{transform:translateY(0) rotate(0)} 40%{transform:translateY(-42px) rotate(-9deg)} 70%{transform:translateY(-20px) rotate(7deg)} }
        @keyframes cxPuppyDance { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-15deg) translateY(-5px)} 75%{transform:rotate(15deg) translateY(-5px)} }
        @keyframes cxPuppyThink { to{transform:rotate(8deg)} }
        .cx-puppy-idle{animation:cxPuppyBob 2.2s ease-in-out infinite;transform-origin:50% 90%}
        .cx-puppy-eyes{transform-box:fill-box;transform-origin:center;animation:cxPuppyBlink 1s infinite ease-in-out}
        .cx-puppy-tail{transform-origin:28px 70px;animation:cxPuppyTail .55s ease-in-out infinite}
        .cx-puppy-jump{animation:cxPuppyJump .7s ease-in-out 2}
        .cx-puppy-sleep{transform:rotate(12deg);opacity:.8}
        .cx-puppy-think{animation:cxPuppyThink 1.1s ease-in-out infinite alternate}
        .cx-puppy-dance{animation:cxPuppyDance .45s ease-in-out 5}
        .cx-puppy-left{transform:translateX(-8px) scaleX(.96)}
        .cx-puppy-right{transform:translateX(8px) scaleX(1.04)}
      `}</style>
    </>
  );
}

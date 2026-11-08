"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Mood = "idle" | "jump" | "left" | "right" | "sleep" | "think" | "wave";
const colors = ["#9ca3af","#f3a6c8","#f59e0b","#facc15","#84cc16","#22c55e","#14b8a6","#06b6d4","#38bdf8","#60a5fa","#818cf8","#a78bfa","#c084fc","#e879f9","#fb7185","#f87171","#fb923c","#d6b38a","#64748b","#f8fafc"];

export default function ConnectXPuppy() {
  const [visible, setVisible] = useState(false);
  const [started, setStarted] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [colorIndex, setColorIndex] = useState(0);
  const [mood, setMood] = useState<Mood>("idle");
  const [bubble, setBubble] = useState("Hi! I'm your ConnectX puppy 🐾");
  const [position, setPosition] = useState({ x: 22, y: 118 });
  const [listening, setListening] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const recognition = useRef<any>(null);
  const lastTap = useRef(0);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const seen = localStorage.getItem("cx-puppy-intro-v1");
      const hidden = localStorage.getItem("cx-puppy-hidden-v1");
      const savedColor = Number(localStorage.getItem("cx-puppy-color-v1") || 0);
      const savedPosition = localStorage.getItem("cx-puppy-position-v1");
      if (!seen) setGuideOpen(true);
      setVisible(hidden !== "true");
      setStarted(seen === "true");
      setColorIndex(Number.isFinite(savedColor) ? ((savedColor % colors.length) + colors.length) % colors.length : 0);
      if (savedPosition) {
        const parsed = JSON.parse(savedPosition);
        if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) setPosition(parsed);
      }
    } catch {}
    return () => {
      if (speechTimer.current) clearTimeout(speechTimer.current);
      recognition.current?.stop?.();
    };
  }, []);

  const say = useCallback((text: string, nextMood: Mood = "wave") => {
    setBubble(text);
    setMood(nextMood);
    if (speechTimer.current) clearTimeout(speechTimer.current);
    speechTimer.current = setTimeout(() => setMood("idle"), 2600);
  }, []);

  const handleCommand = useCallback((spoken: string) => {
    const command = spoken.toLowerCase().trim();
    if (/(jump|hop)/.test(command)) say("Wheee! 🐾", "jump");
    else if (/(go |move )?left|turn left/.test(command)) { setPosition(p => ({ ...p, x: Math.max(8, p.x - 95) })); say("Going left!", "left"); }
    else if (/(go |move )?right|turn right/.test(command)) { setPosition(p => ({ ...p, x: Math.min(window.innerWidth - 112, p.x + 95) })); say("Going right!", "right"); }
    else if (/(sleep|nap|rest)/.test(command)) say("Zzz... sweet dreams 💜", "sleep");
    else if (/(think|thinking)/.test(command)) say("Hmm... let me think 🤔", "think");
    else if (/(dance|dancing)/.test(command)) say("Let's dance!", "jump");
    else if (/(hello|hi|hey)/.test(command)) say("Hello friend! Ready to chat?", "wave");
    else if (/(sit|stop|stay)/.test(command)) say("I'll stay right here.", "idle");
    else if (/(wake|awake)/.test(command)) say("I'm awake! Let's play!", "wave");
    else if (/(hide)/.test(command)) { setVisible(false); localStorage.setItem("cx-puppy-hidden-v1", "true"); }
    else say("I heard you! Try “jump”, “go left”, “sleep” or “think”.", "think");
  }, [say]);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { say("Voice commands work best in Chrome. Please try a supported browser.", "think"); return; }
    const instance = new SpeechRecognition();
    recognition.current = instance;
    instance.lang = "en-IN";
    instance.interimResults = false;
    instance.maxAlternatives = 1;
    instance.onstart = () => { setListening(true); say("I'm listening... tell me what to do!", "wave"); };
    instance.onresult = (event: any) => handleCommand(event.results[0][0].transcript);
    instance.onerror = () => say("I couldn't hear that. Tap the mic and try again.", "think");
    instance.onend = () => setListening(false);
    try { instance.start(); } catch { setListening(false); }
  };

  const begin = () => {
    setStarted(true); setVisible(true); setGuideOpen(false);
    localStorage.setItem("cx-puppy-intro-v1", "true");
    localStorage.setItem("cx-puppy-hidden-v1", "false");
    say("Hi! Tap my mic and give me a command 🐾", "wave");
  };

  const moveTo = (clientX: number, clientY: number) => {
    const x = Math.max(8, Math.min(window.innerWidth - 104, clientX - dragOffset.current.x));
    const y = Math.max(78, Math.min(window.innerHeight - 190, clientY - dragOffset.current.y));
    setPosition({ x, y });
    localStorage.setItem("cx-puppy-position-v1", JSON.stringify({ x, y }));
  };

  if (!visible && !guideOpen) return <button type="button" onClick={() => { setVisible(true); localStorage.setItem("cx-puppy-hidden-v1","false"); }} className="fixed bottom-24 right-4 z-[100] rounded-full border border-cyan-300/30 bg-slate-950/90 px-4 py-2 text-sm font-semibold text-cyan-200 shadow-xl">Show puppy 🐾</button>;

  return (
    <>
      {visible && (
        <div className="fixed z-[100] touch-none select-none" style={{ left: position.x, top: position.y }}>
          {helpOpen && <div className="mb-2 w-56 rounded-2xl border border-cyan-300/30 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-2xl">
            <p className="mb-2 font-bold text-cyan-200">Puppy commands</p>
            <p>“Jump”, “Go left”, “Go right”, “Sleep”, “Think”, “Dance”, “Hello”, “Sit”, “Wake up”.</p>
            <button onClick={() => setHelpOpen(false)} className="mt-2 text-cyan-300">Close</button>
          </div>}
          <div className="mb-1 flex max-w-56 items-center gap-2 rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-xs text-white shadow-lg">
            <span className="min-w-0 flex-1">{bubble}</span>
            <button aria-label="Puppy help" onClick={() => setHelpOpen(v => !v)} className="text-cyan-300">?</button>
          </div>
          <div
            onPointerDown={(event) => { const rect = event.currentTarget.getBoundingClientRect(); dragOffset.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={(event) => { if (dragging) moveTo(event.clientX, event.clientY); }}
            onPointerUp={() => setDragging(false)}
            onDoubleClick={() => { const next = (colorIndex + 1) % colors.length; setColorIndex(next); localStorage.setItem("cx-puppy-color-v1", String(next)); say("New look! Double-tap me to change colour 🎨", "wave"); }}
            onTouchEnd={() => { const now = Date.now(); if (now - lastTap.current < 330) { const next = (colorIndex + 1) % colors.length; setColorIndex(next); localStorage.setItem("cx-puppy-color-v1", String(next)); } lastTap.current = now; }}
            className="relative h-[92px] w-[100px] cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
            aria-label="ConnectX puppy. Drag to move; double tap to change colour."
          >
            <svg viewBox="0 0 120 100" className={`h-full w-full drop-shadow-[0_8px_12px_rgba(0,0,0,.45)] ${mood === "jump" ? "cx-puppy-jump" : mood === "sleep" ? "cx-puppy-sleep" : mood === "think" ? "cx-puppy-think" : ""}`}>
              <path d="M25 65 C4 58 10 35 19 39 C25 42 19 51 29 52" fill="none" stroke={colors[colorIndex]} strokeWidth="10" strokeLinecap="round"/>
              <path d="M39 74 Q25 60 34 45 L43 20 Q49 12 57 34 Q71 18 81 28 L91 49 Q103 62 91 77Z" fill={colors[colorIndex]} stroke="#dbeafe" strokeWidth="3"/>
              <path d="M41 35 L39 13 Q40 5 49 14 L59 29 M74 29 L87 12 Q94 7 94 19 L88 40" fill={colors[colorIndex]} stroke="#dbeafe" strokeWidth="3" strokeLinejoin="round"/>
              <path d="M43 36 Q59 24 78 37 Q91 52 80 67 Q62 80 43 63Z" fill="#e5e7eb" opacity=".92"/>
              <ellipse cx="55" cy="48" rx="4" ry="6" fill="#172033"/><ellipse cx="73" cy="48" rx="4" ry="6" fill="#172033"/>
              <circle cx="56" cy="46" r="1.5" fill="white"/><circle cx="74" cy="46" r="1.5" fill="white"/>
              <path d="M61 56 Q64 52 67 56 Q65 62 64 62Z" fill="#f472b6"/><path d="M64 62 Q60 67 56 63 M64 62 Q68 67 72 63" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M42 67 Q34 79 43 84 L54 84 Q59 78 53 70 M75 70 Q69 80 78 85 L89 84 Q94 78 86 68" fill="#e5e7eb" stroke="#cbd5e1" strokeWidth="2"/>
              {mood === "sleep" && <><path d="M49 48 Q55 52 60 48 M68 48 Q74 52 80 48" fill="none" stroke="#172033" strokeWidth="2"/><text x="94" y="18" fill="#c4b5fd" fontSize="15">Zz</text></>}
              {mood === "think" && <><circle cx="103" cy="20" r="3" fill="#c4b5fd"/><text x="99" y="12" fill="#c4b5fd" fontSize="13">?</text></>}
            </svg>
            <div className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 gap-1 rounded-full border border-white/10 bg-slate-950/90 p-1">
              <button aria-label="Speak to puppy" onPointerDown={e => e.stopPropagation()} onClick={startListening} className={`rounded-full px-2 py-1 text-xs ${listening ? "bg-rose-500 text-white" : "bg-cyan-500/20 text-cyan-200"}`}>{listening ? "●" : "🎙️"}</button>
              <button aria-label="Puppy options" onPointerDown={e => e.stopPropagation()} onClick={() => setHelpOpen(v => !v)} className="rounded-full bg-white/10 px-2 py-1 text-xs text-white">•••</button>
              <button aria-label="Hide puppy" onPointerDown={e => e.stopPropagation()} onClick={() => { setVisible(false); localStorage.setItem("cx-puppy-hidden-v1","true"); }} className="rounded-full bg-white/10 px-2 py-1 text-xs text-white">×</button>
            </div>
          </div>
        </div>
      )}
      {guideOpen && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
        <div className="w-full max-w-sm rounded-3xl border border-cyan-300/30 bg-slate-950 p-6 text-white shadow-2xl">
          <div className="mb-3 text-5xl">🐱</div>
          <h2 className="text-xl font-bold">Meet your ConnectX pet!</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">Your little companion can move around the screen and respond to your voice. Drag it anywhere, double-tap it to cycle through 20 colours, or tap the microphone and speak.</p>
          <p className="mt-3 text-sm font-semibold text-cyan-200">Try saying:</p>
          <p className="mt-1 text-sm text-slate-300">“Jump”, “Go left”, “Go right”, “Sleep”, “Think”, “Dance”, “Hello”, “Sit” or “Wake up”.</p>
          <p className="mt-3 text-xs text-slate-400">Microphone permission is required. Voice commands depend on browser support and work best in Chrome.</p>
          <button onClick={begin} className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-3 font-bold text-white">Start puppy 🐾</button>
          <button onClick={() => { setGuideOpen(false); setVisible(false); localStorage.setItem("cx-puppy-intro-v1","true"); localStorage.setItem("cx-puppy-hidden-v1","true"); }} className="mt-2 w-full rounded-xl px-4 py-2 text-sm text-slate-400">Not now</button>
        </div>
      </div>}
      <style jsx global>{`
        @keyframes cxPuppyJump { 0%,100%{transform:translateY(0) rotate(0)} 45%{transform:translateY(-35px) rotate(-8deg)} }
        .cx-puppy-jump{animation:cxPuppyJump .65s ease-in-out 2}
        .cx-puppy-sleep{transform:rotate(12deg);opacity:.8}
        .cx-puppy-think{animation:cxPuppyThink 1.2s ease-in-out infinite alternate}
        @keyframes cxPuppyThink{to{transform:rotate(7deg)}}
      `}</style>
    </>
  );
}

export default function PuppySettingsPage() {
  const commands = [
    ["Happy", "Say: “Puppy, happy” or “happy”", "The puppy smiles and looks cheerful."],
    ["Sad", "Say: “Puppy, sad” or “sad”", "The puppy droops its expression and shows tears."],
    ["Angry", "Say: “Puppy, angry” or “angry”", "The puppy makes an angry face with lowered brows."],
    ["Cry", "Say: “Puppy, cry” or “crying”", "The puppy cries with visible tears."],
    ["Play with a ball", "Say: “Puppy, play with the ball”, “play ball” or “fetch”", "The puppy chases and bounces a colourful ball."],
    ["Jump", "Say: “jump” or “hop”", "The puppy jumps."],
    ["Dance", "Say: “dance”", "The puppy dances."],
    ["Sleep", "Say: “sleep” or “nap”", "The puppy goes sleepy."],
    ["Think", "Say: “think”", "The puppy looks thoughtful."],
    ["Hello", "Say: “hello”, “hi” or “hey”", "The puppy greets you."],
    ["Move", "Say: “left”, “right” or “come here”", "The puppy moves across the screen."],
    ["Sit / wake", "Say: “sit”, “stay” or “wake up”", "The puppy sits still or wakes up."],
    ["Spin", "Say: “spin” or “turn around”", "The puppy spins."],
    ["Hide", "Say: “hide”", "The puppy hides from the screen."],
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <a href="/settings" className="text-sm text-cyan-300 hover:underline">← Back to Settings</a>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">ConnectX settings</p>
        <h1 className="mt-2 text-3xl font-bold">🐾 Puppy</h1>
        <p className="mt-3 text-slate-300">Talk to your puppy, choose an emotion, and play together.</p>

        <section className="mt-8 rounded-2xl border border-cyan-300/20 bg-slate-900 p-5">
          <h2 className="text-xl font-semibold">How to talk to your puppy</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-slate-300">
            <li>Open the puppy’s three-dot menu.</li>
            <li>Tap <strong>Talk to puppy</strong> and allow microphone access when asked.</li>
            <li>Speak one command clearly in English, then wait for the puppy to react.</li>
            <li>For emotions, say “puppy happy”, “puppy sad”, “puppy angry” or “puppy cry”.</li>
          </ol>
          <p className="mt-3 text-sm text-slate-400">Voice recognition depends on browser and microphone support. If it does not start, check your browser microphone permission.</p>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-slate-900 p-5">
          <h2 className="text-xl font-semibold">All voice commands</h2>
          <div className="mt-4 divide-y divide-white/10">
            {commands.map(([name, phrase, reaction]) => (
              <div key={name} className="grid gap-1 py-3 sm:grid-cols-[150px_1fr]">
                <strong>{name}</strong>
                <div>
                  <p className="text-sm text-cyan-200">{phrase}</p>
                  <p className="mt-1 text-sm text-slate-400">{reaction}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-slate-900 p-5">
          <h2 className="text-xl font-semibold">Puppy behaviour</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">If you leave the puppy alone for 30 seconds, it becomes sad and asks for attention. Tap or interact with it to cheer it up. You can drag it anywhere, double-tap it to change its colour, and use the three-dot menu to hide it or open voice controls.</p>
        </section>
      </div>
    </main>
  );
}

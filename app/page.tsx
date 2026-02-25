"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  from: "user" | "bot";
  text: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const prompt = input.trim();
    if (!prompt) return;
    const userMsg: Message = { id: String(Date.now()) + "u", from: "user", text: prompt };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        const botMsg: Message = { id: String(Date.now()) + "b", from: "bot", text: "Error: " + (err.error || JSON.stringify(err)) };
        setMessages((m) => [...m, botMsg]);
        return;
      }

      const data = await res.json();
      const reply = (data && (data.reply || data.text || data.result)) || "(no response)";
      const botMsg: Message = { id: String(Date.now()) + "b", from: "bot", text: reply };
      setMessages((m) => [...m, botMsg]);
    } catch (e) {
      const botMsg: Message = { id: String(Date.now()) + "b", from: "bot", text: String(e) };
      setMessages((m) => [...m, botMsg]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 shadow-md rounded-lg overflow-hidden flex flex-col">
        <header className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">AI Chat</h1>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Connected to local Ollama</div>
        </header>

        <div ref={listRef} className="flex-1 p-6 space-y-4 overflow-y-auto" style={{ minHeight: 300 }}>
          {messages.length === 0 && (
            <div className="text-center text-zinc-500">Mulai obrolan dengan menulis pesan di bawah.</div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.from === "user" ? "text-right" : "text-left"}>
              <div className={`inline-block max-w-[80%] px-4 py-2 rounded-lg ${m.from === "user" ? "bg-blue-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"}`}>
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!loading) send();
          }}
          className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-3 items-end"
        >
          <textarea
            className="flex-1 resize-none rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tulis pesan..."
            aria-label="Tulis pesan"
          />
          <button
            type="submit"
            disabled={loading}
            className="h-10 px-4 rounded-md bg-blue-600 text-white disabled:opacity-50"
          >
            {loading ? "Mengirim..." : "Kirim"}
          </button>
        </form>
      </div>
    </div>
  );
}


import React, { useEffect, useRef, useState } from 'react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

// Minimal typing for the browser Web Speech API (not in lib.dom for all targets)
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getSpeechRecognition(): SpeechRecognitionLike | null {
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Tell me what you need to do, when, or what workout you did. I\'ll fill in your tasks, calendar and workouts.',
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const speechSupported = typeof window !== 'undefined' &&
    Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: trimmed };
    // TODO: send to AI (Firebase AI Logic) and write structured results to Firestore.
    const reply: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: 'AI is not connected yet. Once it is, this message will be turned into tasks, calendar blocks or workouts.',
    };
    setMessages(prev => [...prev, userMsg, reply]);
    setInput('');
  };

  const toggleMic = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = getSpeechRecognition();
    if (!recognition) return;
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results as ArrayLike<any>)
        .map((r: any) => r[0].transcript)
        .join('');
      setInput(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <h1 className="mono" style={{ fontSize: '24px', color: 'var(--white)', letterSpacing: '0.05em', marginBottom: '24px', fontWeight: 'normal' }}>
        CHAT
      </h1>

      <div
        id="chat-messages"
        role="log"
        aria-live="polite"
        style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '16px' }}
      >
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              padding: '10px 14px',
              border: '1px solid var(--border)',
              background: msg.role === 'user' ? 'var(--primary)' : 'var(--surface)',
              color: msg.role === 'user' ? 'var(--bg)' : 'var(--body)',
              fontSize: '14px',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {msg.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          send(input);
        }}
        style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}
      >
        <input
          id="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={listening ? 'Listening…' : 'e.g. "Gym tomorrow 6pm, then finish report by Friday"'}
          aria-label="Message"
          autoComplete="off"
          style={{
            flex: 1,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--white)',
            padding: '10px 12px',
            fontSize: '14px',
          }}
        />
        {speechSupported && (
          <button
            id="chat-mic"
            type="button"
            onClick={toggleMic}
            className="mono"
            aria-pressed={listening}
            aria-label={listening ? 'Stop voice input' : 'Start voice input'}
            style={{
              background: listening ? 'var(--primary)' : 'transparent',
              color: listening ? 'var(--bg)' : 'var(--dim)',
              border: '1px solid var(--border)',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            {listening ? '[STOP]' : '[MIC]'}
          </button>
        )}
        <button
          id="chat-send"
          type="submit"
          className="mono"
          disabled={!input.trim()}
          style={{
            background: 'var(--primary)',
            color: 'var(--bg)',
            border: 'none',
            padding: '8px 16px',
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            opacity: input.trim() ? 1 : 0.5,
            fontSize: '12px',
          }}
        >
          [SEND]
        </button>
      </form>
    </div>
  );
}

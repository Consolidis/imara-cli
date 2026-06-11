import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isProcessing: boolean;
  onClear: () => void;
  onStop?: () => void;
  currentModel?: string;
  onChangeModel?: (model: string) => void;
}

const MODELS = [
  { id: 'zuri', label: 'Zuri', desc: 'Senior Engineer' },
  { id: 'standard', label: 'Standard', desc: 'Equilibre' },
  { id: 'flash', label: 'Flash', desc: 'Ultra-rapide' },
];

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  isProcessing,
  onClear,
  onStop,
  currentModel = 'zuri',
  onChangeModel,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || isProcessing) return;
    onSendMessage(text);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Filtrer les messages de type "pensee" (reasoning)
  const visibleMessages = messages.filter(msg => {
    // Cacher les messages qui contiennent uniquement "Pensee :"
    if (msg.role === 'assistant' && msg.content.startsWith('Pensée :')) {
      return false;
    }
    return true;
  });

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <span>Assistant IMARA</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Selecteur de modele */}
          {onChangeModel && (
            <select
              value={currentModel}
              onChange={(e) => onChangeModel(e.target.value)}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                color: 'var(--text-primary)',
                fontSize: 11,
                padding: '2px 4px',
                cursor: 'pointer',
              }}
              title="Changer de modele"
            >
              {MODELS.map(m => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.desc})
                </option>
              ))}
            </select>
          )}
          <button
            onClick={onClear}
            style={{
              background: 'none', border: 'none', color: '#71717a',
              cursor: 'pointer', fontSize: 11, padding: '2px 6px', borderRadius: 3,
            }}
            title="Effacer l'historique"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {visibleMessages.map((msg) => (
          <div key={msg.id} className={`chat-msg ${msg.role}`}>
            {msg.content}
            <div className="timestamp">{formatTime(msg.timestamp)}</div>
          </div>
        ))}
        {isProcessing && (
          <div className="chat-msg system" style={{ textAlign: 'center', fontStyle: 'normal' }}>
            ⏳ L'agent travaille...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Votre message a l'agent..."
          rows={1}
          disabled={isProcessing}
        />
        {isProcessing ? (
          <button onClick={onStop} style={{ background: '#ef4444' }}>
            Stop
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={!input.trim()}>
            Envoyer
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatPanel;

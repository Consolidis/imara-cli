import { useState, useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { ChatMessage } from '../types';

/**
 * Hook pour la gestion du chat avec l'agent IA via Socket.io.
 * Chaque message est une entite complete (pas de streaming/fusion).
 */
export function useChat(socket: Socket | null): {
  messages: ChatMessage[];
  sendMessage: (text: string) => void;
  isProcessing: boolean;
  clearMessages: () => void;
  stopGeneration: () => void;
} {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'system-welcome',
      role: 'system',
      content: 'Bienvenue dans IMARA Studio. Posez votre question à l\'agent.',
      timestamp: Date.now(),
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const sessionIdRef = useRef<string>(`session_${Date.now()}`);

  useEffect(() => {
    if (!socket) return;
    const handleResponse = (data: {
      sessionId: string;
      role: 'user' | 'assistant' | 'tool' | 'system';
      content: string;
      type?: 'reasoning' | 'response';
      timestamp: number;
    }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          role: data.role,
          content: data.content,
          type: data.type,
          timestamp: data.timestamp,
        },
      ]);
    };
    const handleReasoning = (data: {
      sessionId: string;
      content: string;
      timestamp: number;
    }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `reason_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          role: 'assistant',
          content: data.content,
          type: 'reasoning',
          timestamp: data.timestamp,
        },
      ]);
    };
    const handleToolCall = (data: {
      sessionId: string;
      content: string;
      timestamp: number;
    }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          role: 'tool',
          content: data.content,
          timestamp: data.timestamp,
        },
      ]);
    };
    const handleDone = () => {
      setIsProcessing(false);
    };
    const handleError = (data: {
      sessionId: string;
      error: string;
      timestamp: number;
    }) => {
      setIsProcessing(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'system',
          content: `Erreur : ${data.error}`,
          timestamp: data.timestamp,
        },
      ]);
    };
    socket.on('chat-response', handleResponse);
    socket.on('chat-reasoning', handleReasoning);
    socket.on('chat-tool-call', handleToolCall);
    socket.on('chat-done', handleDone);
    socket.on('chat-error', handleError);
    return () => {
      socket.off('chat-response', handleResponse);
      socket.off('chat-reasoning', handleReasoning);
      socket.off('chat-tool-call', handleToolCall);
      socket.off('chat-done', handleDone);
      socket.off('chat-error', handleError);
    };
  }, [socket]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!socket || !text.trim() || isProcessing) return;
      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: text.trim(),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);
      socket.emit('chat-message', {
        message: text.trim(),
        sessionId: sessionIdRef.current,
      });
    },
    [socket, isProcessing]
  );

  const clearMessages = useCallback(() => {
    setMessages([
      {
        id: 'system-cleared',
        role: 'system',
        content: 'Historique efface. Posez votre question a l\'agent.',
        timestamp: Date.now(),
      },
    ]);
    sessionIdRef.current = `session_${Date.now()}`;
  }, []);

  const stopGeneration = useCallback(() => {
    if (!socket) return;
    socket.emit('stop-generation', { sessionId: sessionIdRef.current });
    setIsProcessing(false);
  }, [socket]);

  return { messages, sendMessage, isProcessing, clearMessages, stopGeneration };
}

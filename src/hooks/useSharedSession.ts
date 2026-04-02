/**
 * useSharedSession — WebSocket hook for multiplayer rehearsal rooms
 *
 * Connects to the SharedSession Durable Object and handles:
 * - room-state, participant-joined/left, interventions, chat
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { PersonaType } from "../lib/personas";

export interface SharedIntervention {
  timestamp: number;
  persona: PersonaType;
  personaName: string;
  color: string;
  text: string;
  audioDataUri?: string;
  triggeredBy: string;
  triggeredByName: string;
}

export interface RoomParticipant {
  participantId: string;
  name: string;
  joinedAt: number;
}

export interface SharedRoomState {
  roomCode: string;
  speechDescription: string;
  domain: string;
  difficultyLevel: number;
  participants: RoomParticipant[];
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export function useSharedSession(
  roomCode: string,
  participantId: string,
  participantName: string
) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [roomState, setRoomState] = useState<SharedRoomState | null>(null);
  const [interventions, setInterventions] = useState<SharedIntervention[]>([]);
  const [chatMessages, setChatMessages] = useState<{ from: string; text: string }[]>([]);

  // Connect WebSocket to SharedSession DO
  useEffect(() => {
    if (!roomCode) return;

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}/agents/shared-session/${roomCode}` +
      `?participantId=${participantId}&name=${encodeURIComponent(participantName)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => setStatus("connected");
    ws.onerror = () => setStatus("error");
    ws.onclose = () => setStatus("disconnected");

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as Record<string, unknown>;
        switch (msg.type) {
          case "room-state":
            setRoomState(msg as unknown as SharedRoomState);
            break;

          case "participant-joined":
          case "participant-left":
            setRoomState(prev => {
              if (!prev) return prev;
              const p = { participantId: String(msg.participantId), name: String(msg.name), joinedAt: Date.now() };
              if (msg.type === "participant-joined") {
                const exists = prev.participants.some(x => x.participantId === p.participantId);
                return exists ? prev : { ...prev, participants: [...prev.participants, p] };
              }
              return { ...prev, participants: prev.participants.filter(x => x.participantId !== p.participantId) };
            });
            break;

          case "intervention":
            setInterventions(prev => [...prev.slice(-20), msg as unknown as SharedIntervention]);
            break;

          case "chat":
            setChatMessages(prev => [...prev.slice(-50), {
              from: String(msg.from),
              text: String(msg.text)
            }]);
            break;
        }
      } catch { /* ignore malformed */ }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [roomCode, participantId, participantName]);

  // Send transcript to the room (triggers audience analysis)
  const sendTranscript = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "transcript", text }));
    }
  }, []);

  // Send audio chunk to peers
  const sendAudioChunk = useCallback((base64: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "audio-chunk", data: base64 }));
    }
  }, []);

  // Send chat message
  const sendChat = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat", text }));
    }
  }, []);

  return { status, roomState, interventions, chatMessages, sendTranscript, sendAudioChunk, sendChat };
}

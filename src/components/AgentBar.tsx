"use client";

import { useState, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { lastAssistantMessageIsCompleteWithToolCalls, DefaultChatTransport } from "ai";
import { motion, AnimatePresence } from "motion/react";
import { Send, Loader2, Check, Zap, Sparkles, Timer } from "lucide-react";
import { useTracksStore } from "@/store/tracks";
import { base64ToAudioBuffer } from "@/lib/audio-utils";
import {
  generateMidiTrack,
  getMidiInstrumentColor,
} from "@/lib/generate-midi-track";
import { mixer } from "@/lib/mixer";
import { InstrumentType } from "@/types/midi";
import { v4 as uuidv4 } from "uuid";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}.${Math.floor((s % 1) * 10)}`;
}

export default function AgentBar() {
  const [inputValue, setInputValue] = useState("");
  const { tracks, analysis, updateTrack, addTrack, removeTrack, step, timeSelections, removeTimeSelection } =
    useTracksStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Keep refs so onToolCall always has fresh state
  const tracksRef = useRef(tracks);
  const analysisRef = useRef(analysis);
  const timeSelectionsRef = useRef(timeSelections);
  useEffect(() => {
    tracksRef.current = tracks;
    analysisRef.current = analysis;
    timeSelectionsRef.current = timeSelections;
  }, [tracks, analysis, timeSelections]);

  const { messages, sendMessage, status, addToolOutput } = useChat({
    transport: new DefaultChatTransport({ api: "/api/agent" }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: ({ toolCall }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = toolCall.input as Record<string, any>;
      const { trackId, muted, solo, volume, description, instrument } = input;

      const resolve = (output: string) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        addToolOutput({ tool: toolCall.toolName as any, toolCallId: toolCall.toolCallId, output });

      switch (toolCall.toolName) {
        case "muteTrack": {
          const name = tracksRef.current.find((t) => t.id === trackId)?.name ?? trackId;
          updateTrack(trackId, { muted });
          resolve(`"${name}" ${muted ? "muted" : "unmuted"}`);
          break;
        }

        case "soloTrack": {
          const name = tracksRef.current.find((t) => t.id === trackId)?.name ?? trackId;
          updateTrack(trackId, { solo });
          resolve(`"${name}" ${solo ? "soloed" : "unsoloed"}`);
          break;
        }

        case "setVolume": {
          const name = tracksRef.current.find((t) => t.id === trackId)?.name ?? trackId;
          updateTrack(trackId, { volume });
          mixer.setVolume(trackId, volume);
          resolve(`"${name}" volume → ${Math.round(volume * 100)}%`);
          break;
        }

        case "removeTrack": {
          const name = tracksRef.current.find((t) => t.id === trackId)?.name ?? trackId;
          removeTrack(trackId);
          resolve(`"${name}" removed`);
          break;
        }

        case "generateBeat": {
          const sels = timeSelectionsRef.current;
          if (sels.length > 0) {
            // One track per selection, all launched in parallel
            sels.forEach((sel) => {
              const newId = uuidv4();
              addTrack({
                id: newId,
                name: description,
                type: "beat",
                audioUrl: null,
                audioBuffer: null,
                volume: 0.7,
                muted: false,
                solo: false,
                color: "#ea580c",
                isLoading: true,
                startOffset: sel.start,
              });
              void (async () => {
                try {
                  const res = await fetch("/api/generate-beat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ description, durationSeconds: sel.end - sel.start }),
                  });
                  if (!res.ok) throw new Error();
                  const { audioBase64 } = await res.json();
                  const buf = await base64ToAudioBuffer(audioBase64, "audio/mpeg");
                  updateTrack(newId, { audioBuffer: buf, isLoading: false });
                } catch {
                  updateTrack(newId, { isLoading: false, name: `${description} (failed)` });
                }
              })();
            });
            resolve(`Beat "${description}" added to ${sels.length} selection${sels.length > 1 ? "s" : ""}`);
          } else {
            // No selection — single 8s beat, no offset
            const newId = uuidv4();
            addTrack({
              id: newId,
              name: description,
              type: "beat",
              audioUrl: null,
              audioBuffer: null,
              volume: 0.7,
              muted: false,
              solo: false,
              color: "#ea580c",
              isLoading: true,
            });
            void (async () => {
              try {
                const res = await fetch("/api/generate-beat", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ description, durationSeconds: 8 }),
                });
                if (!res.ok) throw new Error();
                const { audioBase64 } = await res.json();
                const buf = await base64ToAudioBuffer(audioBase64, "audio/mpeg");
                updateTrack(newId, { audioBuffer: buf, isLoading: false });
                resolve(`Beat "${description}" added`);
              } catch {
                updateTrack(newId, { isLoading: false, name: `${description} (failed)` });
                resolve("Beat generation failed");
              }
            })();
          }
          break;
        }

        case "generateInstrument": {
          const instr = instrument as InstrumentType;
          const currentAnalysis = analysisRef.current;
          if (!currentAnalysis) {
            resolve("No song analysis — record a hum first");
            break;
          }
          const sels = timeSelectionsRef.current;
          if (sels.length > 0) {
            // One MIDI track per selection, all launched in parallel
            sels.forEach((sel) => {
              const newId = uuidv4();
              addTrack({
                id: newId,
                name: description,
                type: "midi",
                audioUrl: null,
                audioBuffer: null,
                volume: 0.7,
                muted: false,
                solo: false,
                color: getMidiInstrumentColor(instr),
                isLoading: true,
                startOffset: sel.start,
              });
              void (async () => {
                try {
                  const { audioBuffer } = await generateMidiTrack(currentAnalysis, instr, sel.end - sel.start);
                  updateTrack(newId, { audioBuffer, isLoading: false });
                } catch {
                  updateTrack(newId, { isLoading: false, name: `${description} (failed)` });
                }
              })();
            });
            resolve(`${instr} "${description}" added to ${sels.length} selection${sels.length > 1 ? "s" : ""}`);
          } else {
            // No selection — single 16s instrument, no offset
            const newId = uuidv4();
            addTrack({
              id: newId,
              name: description,
              type: "midi",
              audioUrl: null,
              audioBuffer: null,
              volume: 0.7,
              muted: false,
              solo: false,
              color: getMidiInstrumentColor(instr),
              isLoading: true,
            });
            void (async () => {
              try {
                const { audioBuffer } = await generateMidiTrack(currentAnalysis, instr, 16);
                updateTrack(newId, { audioBuffer, isLoading: false });
                resolve(`${instr} "${description}" added`);
              } catch {
                updateTrack(newId, { isLoading: false, name: `${description} (failed)` });
                resolve(`${instr} generation failed`);
              }
            })();
          }
          break;
        }
      }
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Must be after all hooks
  if (step !== "studio") return null;

  const isLoading = status === "streaming" || status === "submitted";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue("");
    sendMessage(
      { text },
      {
        body: {
          tracks: tracksRef.current.map((t) => ({
            id: t.id,
            name: t.name,
            type: t.type,
            muted: t.muted,
            solo: t.solo,
            volume: t.volume,
            isLoading: t.isLoading,
          })),
          analysis: analysisRef.current,
          timeSelections: timeSelectionsRef.current,
        },
      }
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-[#2A2A2E] bg-[#151518]">
        <Zap className="w-3 h-3 text-[#A855F7]" />
        <span className="text-[9px] uppercase tracking-wider text-[#505058] font-[family-name:var(--font-display)]">
          AI Agent
        </span>
        {isLoading && (
          <Loader2 className="w-2.5 h-2.5 animate-spin text-[#A855F7] ml-auto" />
        )}
      </div>

      {/* Messages — scrollable, fills space */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col gap-3 pt-1">
            <p className="text-[9px] uppercase tracking-wider text-[#3A3A42]">Available commands</p>
            {[
              { label: "Add beat", example: "add trap drums" },
              { label: "Add instrument", example: "add piano chords" },
              { label: "Mute track", example: "mute the bass" },
              { label: "Solo track", example: "solo the piano" },
              { label: "Set volume", example: "lower piano to 60%" },
              { label: "Remove track", example: "remove the drums" },
            ].map(({ label, example }) => (
              <button
                key={label}
                onClick={() => setInputValue(example)}
                className="w-full text-left group"
              >
                <div className="text-[9px] text-[#505058] uppercase tracking-wider mb-0.5">{label}</div>
                <div className="lcd-display px-2 py-1 text-[10px] text-[#606068] group-hover:text-[#A855F7] group-hover:border-[#A855F7]/30 transition-colors truncate">
                  &ldquo;{example}&rdquo;
                </div>
              </button>
            ))}
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "user" ? (
                <div className="lcd-display px-2 py-1.5 max-w-[85%]">
                  <span className="text-[11px] text-[#808088] break-words">
                    {msg.parts
                      .filter((p) => p.type === "text")
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      .map((p: any) => p.text)
                      .join("")}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 max-w-[90%]">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(msg.parts as any[]).map((part, i) => {
                    if (part.type === "text") {
                      return part.text ? (
                        <span key={i} className="text-[11px] text-[#E0E0E4] leading-snug">
                          {part.text}
                        </span>
                      ) : null;
                    }

                    if (part.type?.startsWith?.("tool-")) {
                      const toolName = part.type.slice(5);
                      const isDone = part.state === "output-available";
                      const isErr = part.state === "output-error";
                      const outputStr =
                        isDone && typeof part.output === "string" ? part.output : null;

                      return (
                        <span
                          key={i}
                          className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-sm border w-fit ${
                            isErr
                              ? "bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/20"
                              : isDone
                                ? "bg-[#00FF87]/10 text-[#00FF87] border-[#00FF87]/20"
                                : "bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]/20"
                          }`}
                        >
                          {isDone ? (
                            <Check className="w-2.5 h-2.5 shrink-0" />
                          ) : isErr ? (
                            "✕"
                          ) : (
                            <Loader2 className="w-2.5 h-2.5 animate-spin shrink-0" />
                          )}
                          <span className="font-mono">{toolName}</span>
                          {outputStr && (
                            <span className="opacity-60 max-w-[120px] truncate">: {outputStr}</span>
                          )}
                        </span>
                      );
                    }

                    return null;
                  })}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Thinking indicator */}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex items-center gap-1.5">
            {[4, 7, 5, 8, 4].map((h, i) => (
              <motion.div
                key={i}
                className="w-[2px] bg-[#A855F7] rounded-full"
                animate={{ height: [2, h, 2] }}
                transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
              />
            ))}
            <span className="text-[9px] text-[#505058]">thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar — pinned to bottom */}
      <div className="shrink-0 border-t border-[#2A2A2E] p-2">
        {/* Time selection context chips — one per active selection */}
        <AnimatePresence>
          {timeSelections.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 6 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-1">
                {timeSelections.map((sel) => (
                  <div
                    key={sel.id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded border border-[#00D4FF]/25 bg-[#00D4FF]/[0.06]"
                  >
                    <Timer className="w-2.5 h-2.5 text-[#00D4FF] shrink-0" />
                    <span className="text-[8px] uppercase tracking-wider text-[#00D4FF]/70 font-semibold shrink-0 truncate max-w-[60px]">
                      {sel.trackId
                        ? (tracks.find((t) => t.id === sel.trackId)?.name ?? "Track")
                        : "Master"}
                    </span>
                    <span className="text-[8px] text-[#00D4FF]/30 shrink-0">|</span>
                    <span className="text-[9px] font-[tabular-nums] text-[#00D4FF] font-mono shrink-0">
                      {formatTime(sel.start)} – {formatTime(sel.end)}
                    </span>
                    <span className="text-[8px] text-[#00D4FF]/50 font-[tabular-nums] shrink-0">
                      ({formatTime(sel.end - sel.start)})
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTimeSelection(sel.id)}
                      className="ml-auto text-[#00D4FF]/40 hover:text-[#FF3B30] transition-colors text-[9px] leading-none shrink-0"
                      title="Remove this selection"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="flex gap-1.5 items-center">
          <div className="flex-1 relative">
            <div className="absolute left-2 top-1/2 -translate-y-1/2">
              <Sparkles className="w-3 h-3 text-[#A855F7]" />
            </div>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={timeSelections.length > 0 ? "add piano to selections..." : "mute bass, add trap drums..."}
              className="w-full h-8 bg-[#0D0D0F] border border-[#2A2A2E] rounded pl-7 pr-2 text-[11px] text-[#E0E0E4] placeholder:text-[#3A3A42] outline-none focus:border-[#A855F7]/40 transition-colors font-mono"
              style={{ boxShadow: "inset 0 1px 3px rgba(0,0,0,0.3)" }}
              disabled={isLoading}
            />
          </div>
          <motion.button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            className="w-8 h-8 rounded flex items-center justify-center bg-[#232328] border border-[#2A2A2E] text-[#A855F7] hover:bg-[#2C2C33] hover:border-[#A855F7]/30 disabled:opacity-30 disabled:hover:bg-[#232328] transition-all"
          >
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin text-[#808088]" />
            ) : (
              <Send className="w-3 h-3" />
            )}
          </motion.button>
        </form>
      </div>
    </div>
  );
}

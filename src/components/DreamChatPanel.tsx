import { useState, useRef, useEffect } from "react";
import { ArrowUp, RotateCcw, AlertCircle, Loader2 } from "lucide-react";
import type { ChatMessage, ChatModelId, DreamEntry } from "../types/dream";
import { sendDreamChatMessage } from "../services/dreamApi";

interface DreamChatPanelProps {
  dream: DreamEntry;
  prefillPrompt: string | null;
  onConsumePrefill: () => void;
  onUpdateChatHistory: (dreamId: string, nextHistory: ChatMessage[]) => void;
}

const CHAT_MODES: Array<{
  model: ChatModelId;
  label: string;
  hint: string;
}> = [
  {
    model: "gemini-4-hydrogen",
    label: "Standard",
    hint: "Balanced symbolic exploration",
  },
  {
    model: "gemini-4-carbon",
    label: "Deep Analysis",
    hint: "Deep Jungian reasoning",
  },
  {
    model: "gemini-4-neon",
    label: "Synthesis",
    hint: "Complex archetypal connections",
  },
  {
    model: "gemini-3.1-flash-lite",
    label: "Quick",
    hint: "Rapid reflection",
  },
];

function renderFormattedProse(text: string) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim().length > 0);
  return blocks.map((block, blockIdx) => {
    const lines = block.split("\n");
    const isList = lines.every((l) => /^[-*•]\s+/.test(l.trim()));

    if (isList) {
      return (
        <ul key={blockIdx} className="my-2 space-y-1.5 pl-4 list-disc text-[#DEDBD2]">
          {lines.map((line, i) => (
            <li key={i} className="leading-relaxed">
              {renderInlineBold(line.trim().replace(/^[-*•]\s+/, ""))}
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p key={blockIdx} className="leading-relaxed text-[#E4E1D9]">
        {lines.map((line, lineIdx) => (
          <span key={lineIdx}>
            {lineIdx > 0 && <br />}
            {renderInlineBold(line)}
          </span>
        ))}
      </p>
    );
  });
}

function renderInlineBold(line: string) {
  const segments = line.split(/(\*\*[^*]+\*\*)/g);
  return segments.map((seg, idx) => {
    if (seg.startsWith("**") && seg.endsWith("**") && seg.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[#F6F4EF]">
          {seg.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{seg}</span>;
  });
}

export function DreamChatPanel({
  dream,
  prefillPrompt,
  onConsumePrefill,
  onUpdateChatHistory,
}: DreamChatPanelProps) {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<ChatModelId>("gemini-4-hydrogen");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (prefillPrompt) {
      setInput(prefillPrompt);
      onConsumePrefill();
      textareaRef.current?.focus();
    }
  }, [prefillPrompt, onConsumePrefill]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [dream.chatHistory.length, isSending]);

  const starterQuestions = [
    ...(dream.symbols.slice(0, 2).map(
      (s) => `What deeper personal or Jungian associations might "${s.symbol}" carry in this dream?`
    )),
    ...(dream.archetypes.slice(0, 1).map(
      (a) => `How can I work with ${a.name} in waking life based on how it appeared here?`
    )),
    `What recurring emotional pattern connects the ending of "${dream.title}" to its central theme?`,
  ].slice(0, 3);

  const handleSend = async (overrideMessage?: string) => {
    const trimmed = (overrideMessage ?? input).trim();
    if (!trimmed || isSending) return;

    setError(null);
    const priorHistory = dream.chatHistory;
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      text: trimmed,
      createdAt: new Date().toISOString(),
    };

    const optimisticHistory = [...priorHistory, userMessage];
    onUpdateChatHistory(dream.id, optimisticHistory);
    setInput("");
    setIsSending(true);

    try {
      const { reply, model } = await sendDreamChatMessage({
        dream,
        history: priorHistory,
        message: trimmed,
        model: selectedModel,
      });

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-model`,
        role: "model",
        text: reply,
        createdAt: new Date().toISOString(),
        modelUsed: model,
      };

      onUpdateChatHistory(dream.id, [...optimisticHistory, assistantMessage]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete symbol dialogue right now."
      );
      // Keep user's message visible so they know what they asked, or restore input for easy retry
      onUpdateChatHistory(dream.id, priorHistory);
      setInput(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearHistory = () => {
    if (isSending) return;
    setError(null);
    onUpdateChatHistory(dream.id, []);
  };

  const activeModeMeta =
    CHAT_MODES.find((m) => m.model === selectedModel) ?? CHAT_MODES[0];

  return (
    <section
      id="symbol-dialogue"
      aria-labelledby="symbol-dialogue-heading"
      className="border-t border-[#202430] pt-10"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-[#8A90A2]">
            Analytical Consultation
          </p>
          <h2
            id="symbol-dialogue-heading"
            className="mt-1 font-editorial text-3xl font-medium text-[#F2F0EB]"
          >
            Symbol Dialogue
          </h2>
          <p className="mt-1 text-sm text-[#959BAC]">
            Ask follow-up questions about specific symbols, figures, or emotional turns in this dream.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Interactive depth/model selector */}
          <div
            role="group"
            aria-label="Analytical depth mode"
            className="inline-flex items-center rounded-lg border border-[#242936] bg-[#11141C] p-1"
          >
            {CHAT_MODES.map((mode) => {
              const active = selectedModel === mode.model;
              return (
                <button
                  key={mode.model}
                  type="button"
                  onClick={() => setSelectedModel(mode.model)}
                  title={mode.hint}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? "bg-[#222736] text-[#F2F0EB]"
                      : "text-[#8B91A3] hover:text-[#DEDBD2]"
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>

          {dream.chatHistory.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              disabled={isSending}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#242936] px-3 py-1.5 text-xs text-[#9197A8] transition-colors hover:border-[#363D52] hover:text-[#F2F0EB] disabled:opacity-50 whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clear thread</span>
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Dialogue Container */}
      <div className="mt-6 overflow-hidden rounded-xl border border-[#222633] bg-[#11131A]">
        <div className="max-h-[460px] min-h-[240px] overflow-y-auto px-5 py-6 sm:px-7 space-y-6">
          {dream.chatHistory.length === 0 ? (
            <div className="space-y-4 py-2">
              <p className="text-sm leading-relaxed text-[#9DA3B4] max-w-prose">
                Begin a focused reflection on <span className="text-[#F2F0EB]">{dream.title}</span>. Choose a starting prompt below or ask about any detail you noticed upon waking.
              </p>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {starterQuestions.map((prompt, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    disabled={isSending}
                    className="rounded-lg border border-[#242937] bg-[#161923] p-3.5 text-left text-xs leading-relaxed text-[#D0CDC4] transition-colors hover:border-[#D4A359]/60 hover:text-[#F2F0EB] disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            dream.chatHistory.map((message) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  <div className="mb-1.5 flex items-center gap-2 text-[11px] text-[#7B8192]">
                    <span>{isUser ? "Dreamer" : "Jungian Analyst"}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {new Date(message.createdAt).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div
                    className={`max-w-[88%] rounded-xl px-4 py-3.5 text-sm space-y-2.5 sm:max-w-[78%] ${
                      isUser
                        ? "border border-[#362E20] bg-[#1C1A16] text-[#F2EDE2]"
                        : "border border-[#232836] bg-[#161922] text-[#E4E1D9]"
                    }`}
                  >
                    {renderFormattedProse(message.text)}
                  </div>
                </div>
              );
            })
          )}

          {isSending && (
            <div className="flex items-start gap-2.5 text-xs text-[#9EA4B4]">
              <Loader2 className="h-4 w-4 animate-spin text-[#D4A359] shrink-0" aria-hidden="true" />
              <span>Reflecting on symbols ({activeModeMeta.label})...</span>
            </div>
          )}

          <div ref={threadEndRef} />
        </div>

        {/* Inline Error State */}
        {error && (
          <div
            role="alert"
            className="mx-5 mb-3 flex items-start gap-2.5 rounded-lg border border-[#5B2A2A] bg-[#241416] px-3.5 py-2.5 text-xs text-[#F2B8B5]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC5A5A]" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick symbol chips when conversation has started */}
        {dream.chatHistory.length > 0 && dream.symbols.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto border-t border-[#1C202B] bg-[#0F1118] px-5 py-2.5">
            <span className="text-[11px] text-[#73798A] whitespace-nowrap shrink-0">
              Ask about:
            </span>
            {dream.symbols.map((sym) => (
              <button
                key={sym.symbol}
                type="button"
                disabled={isSending}
                onClick={() =>
                  setInput(
                    `Tell me more about the symbol "${sym.symbol}" and why it appeared as it did in this dream.`
                  )
                }
                className="rounded border border-[#252A38] bg-[#151822] px-2.5 py-1 text-xs text-[#C6C3BA] transition-colors hover:border-[#D4A359]/60 hover:text-[#F2F0EB] whitespace-nowrap shrink-0"
              >
                {sym.symbol}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="border-t border-[#202430] bg-[#0E1016] p-3.5 sm:p-4"
        >
          <div className="flex items-end gap-3">
            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Ask about a symbol, archetype, or feeling from this dream..."
              aria-label="Ask a follow-up question about this dream"
              className="min-h-[44px] flex-1 resize-none rounded-lg border border-[#242937] bg-[#141720] px-3.5 py-2.5 text-sm text-[#F2F0EB] placeholder:text-[#666C7C] focus:border-[#D4A359]/70 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isSending || !input.trim()}
              aria-label="Send message"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#D4A359] text-[#0B0C10] transition-colors hover:bg-[#DFB26E] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

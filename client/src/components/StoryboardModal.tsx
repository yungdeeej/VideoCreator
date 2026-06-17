import { useState } from "react";
import type {
  AspectRatio,
  DraftStoryboardResult,
  PublicConfig,
} from "@storyforge/shared";
import { api } from "../api";
import { Button, Input, Label, Spinner, TextArea } from "./ui";

export function StoryboardModal({
  config,
  aspectRatio,
  stylePreset,
  onClose,
  onApply,
}: {
  config: PublicConfig;
  aspectRatio: AspectRatio;
  stylePreset: string;
  onClose: () => void;
  onApply: (
    result: DraftStoryboardResult,
    opts: { setTitle: boolean },
  ) => Promise<void>;
}) {
  const [logline, setLogline] = useState("");
  const [sceneCount, setSceneCount] = useState(5);
  const [result, setResult] = useState<DraftStoryboardResult | null>(null);
  const [setTitle, setSetTitle] = useState(true);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!logline.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setResult(
        await api.draftStoryboard({
          logline: logline.trim(),
          sceneCount,
          aspectRatio,
          stylePreset,
        }),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!result) return;
    setApplying(true);
    setError(null);
    try {
      await onApply(result, { setTitle });
      onClose();
    } catch (e: any) {
      setError(e.message);
      setApplying(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-ink-700 bg-ink-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            <span className="text-accent">✨</span> Draft storyboard
            {config.assistMock && (
              <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">
                MOCK
              </span>
            )}
          </h2>
          <button className="text-slate-400 hover:text-slate-100" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Logline / story idea</Label>
            <TextArea
              rows={3}
              value={logline}
              onChange={(e) => setLogline(e.target.value)}
              placeholder="e.g. A neglected farm is brought back to life over a single golden season."
            />
          </div>
          <div className="flex items-end gap-4">
            <div>
              <Label>Scenes</Label>
              <input
                type="number"
                min={1}
                max={12}
                value={sceneCount}
                onChange={(e) =>
                  setSceneCount(
                    Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                  )
                }
                className="w-20 rounded-lg bg-ink-850 border border-ink-700 px-2.5 py-1.5 text-sm"
              />
            </div>
            <Button
              variant="primary"
              onClick={generate}
              disabled={busy || !logline.trim()}
            >
              {busy ? <Spinner /> : "✨"} Generate
            </Button>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {result && (
            <div className="mt-2 space-y-2">
              <div className="text-sm text-slate-300">
                Suggested title:{" "}
                <span className="text-accent">{result.suggestedTitle}</span>
              </div>
              <div className="space-y-2">
                {result.scenes.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-sm"
                  >
                    <div className="text-xs text-slate-500 mb-1">Scene {i + 1}</div>
                    <div className="text-slate-200">{s.imagePrompt}</div>
                    <div className="mt-1 text-slate-400 text-xs italic">
                      ↪ {s.motionPrompt}
                    </div>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={setTitle}
                  onChange={(e) => setSetTitle(e.target.checked)}
                />
                Rename project to the suggested title
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={() => setResult(null)}>
                  Regenerate
                </Button>
                <Button variant="primary" onClick={apply} disabled={applying}>
                  {applying ? <Spinner /> : ""} Add {result.scenes.length} scene
                  {result.scenes.length !== 1 ? "s" : ""}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

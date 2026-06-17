import { useEffect, useState } from "react";
import type {
  AspectRatio,
  PublicConfig,
  Scene,
  TextOverlay,
  UpdateSceneInput,
} from "@storyforge/shared";
import { Button, Label, Select, Spinner, StatusBadge, TextArea } from "./ui";
import { fmtUSD, sceneCost } from "../lib/cost";

const OVERLAY_POSITIONS: TextOverlay["position"][] = [
  "top",
  "center",
  "bottom",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

export interface SceneCardProps {
  scene: Scene;
  index: number;
  config: PublicConfig;
  aspect: AspectRatio;
  onChange: (patch: UpdateSceneInput) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRegenerateImage?: () => void;
  onRegenerateVideo?: () => void;
  /** Expand the given idea into image + motion prompts (Claude assistant). */
  onSuggest?: (idea: string) => Promise<void>;
  disabled?: boolean;
}

export function SceneCard(props: SceneCardProps) {
  const { scene, config, index } = props;
  const model = config.videoModels.find((m) => m.key === scene.videoModel);
  const needsEnd = !!model?.needsEndFrame;
  const cost = sceneCost(scene, config);

  // Local drafts for textareas (commit on blur to avoid request spam).
  const [imagePrompt, setImagePrompt] = useState(scene.imagePrompt);
  const [motionPrompt, setMotionPrompt] = useState(scene.motionPrompt);
  const [endImagePrompt, setEndImagePrompt] = useState(scene.endImagePrompt ?? "");

  useEffect(() => setImagePrompt(scene.imagePrompt), [scene.imagePrompt]);
  useEffect(() => setMotionPrompt(scene.motionPrompt), [scene.motionPrompt]);
  useEffect(
    () => setEndImagePrompt(scene.endImagePrompt ?? ""),
    [scene.endImagePrompt],
  );

  const [showOverlay, setShowOverlay] = useState(!!scene.textOverlay);
  const [suggesting, setSuggesting] = useState(false);

  async function suggest() {
    if (!props.onSuggest) return;
    const idea = imagePrompt.trim();
    if (!idea) return;
    setSuggesting(true);
    try {
      await props.onSuggest(idea);
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 overflow-hidden">
      <div className="flex">
        {/* Preview column */}
        <div className="w-64 shrink-0 bg-ink-950 border-r border-ink-700 p-3 flex flex-col gap-2">
          <Preview scene={scene} needsEnd={needsEnd} />
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge status={scene.imageStatus} label="img" />
            <StatusBadge status={scene.videoStatus} label="vid" />
          </div>
          {scene.error && (
            <p className="text-[11px] text-red-400 break-words">{scene.error}</p>
          )}
          <Downloads scene={scene} needsEnd={needsEnd} />
          <div className="mt-auto flex gap-1.5">
            <Button
              variant="ghost"
              className="flex-1 justify-center text-xs"
              disabled={props.disabled || !props.onRegenerateImage}
              onClick={props.onRegenerateImage}
              title="Regenerate this scene's image(s)"
            >
              ↻ Image
            </Button>
            <Button
              variant="ghost"
              className="flex-1 justify-center text-xs"
              disabled={props.disabled || !props.onRegenerateVideo}
              onClick={props.onRegenerateVideo}
              title="Regenerate this scene's clip"
            >
              ↻ Clip
            </Button>
          </div>
        </div>

        {/* Editor column */}
        <div className="flex-1 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-700 text-xs font-semibold">
                {index}
              </span>
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Scene
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="subtle" onClick={props.onMoveUp} disabled={!props.onMoveUp}>
                ↑
              </Button>
              <Button variant="subtle" onClick={props.onMoveDown} disabled={!props.onMoveDown}>
                ↓
              </Button>
              <Button variant="danger" onClick={props.onDelete}>
                ✕
              </Button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Image prompt</Label>
              {props.onSuggest && (
                <button
                  className="mb-1 inline-flex items-center gap-1 rounded text-[11px] text-accent hover:text-accent-soft disabled:opacity-40"
                  onClick={suggest}
                  disabled={suggesting || props.disabled || !imagePrompt.trim()}
                  title="Expand this idea into polished image + motion prompts (Claude)"
                >
                  {suggesting ? <Spinner /> : "✨"} Suggest
                </button>
              )}
            </div>
            <TextArea
              rows={2}
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              onBlur={() =>
                imagePrompt !== scene.imagePrompt &&
                props.onChange({ imagePrompt })
              }
              placeholder="A rough idea works — then hit ✨ Suggest…"
            />
          </div>

          {needsEnd && (
            <div>
              <Label>End-frame prompt (Seedance morph target)</Label>
              <TextArea
                rows={2}
                value={endImagePrompt}
                onChange={(e) => setEndImagePrompt(e.target.value)}
                onBlur={() =>
                  endImagePrompt !== (scene.endImagePrompt ?? "") &&
                  props.onChange({ endImagePrompt })
                }
                placeholder="What the scene should morph INTO…"
              />
            </div>
          )}

          <div>
            <Label>Motion prompt</Label>
            <TextArea
              rows={2}
              value={motionPrompt}
              onChange={(e) => setMotionPrompt(e.target.value)}
              onBlur={() =>
                motionPrompt !== scene.motionPrompt &&
                props.onChange({ motionPrompt })
              }
              placeholder="How it should move…"
            />
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label>Model</Label>
              <Select
                value={scene.videoModel}
                onChange={(e) =>
                  props.onChange({ videoModel: e.target.value as Scene["videoModel"] })
                }
              >
                {config.videoModels.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Duration (s)</Label>
              <input
                type="number"
                min={1}
                max={12}
                value={scene.durationSec}
                onChange={(e) =>
                  props.onChange({ durationSec: Number(e.target.value) || 1 })
                }
                className="w-20 rounded-lg bg-ink-850 border border-ink-700 px-2.5 py-1.5 text-sm"
              />
            </div>
            <div className="ml-auto text-right">
              <Label>Est. cost</Label>
              <div className="text-sm text-accent font-mono">{fmtUSD(cost.total)}</div>
            </div>
          </div>

          {/* overlay editor */}
          <div className="pt-1">
            <button
              className="text-xs text-slate-400 hover:text-slate-200"
              onClick={() => setShowOverlay((v) => !v)}
            >
              {showOverlay ? "▾" : "▸"} Text overlay{" "}
              {scene.textOverlay ? "(on)" : "(off)"}
            </button>
            {showOverlay && (
              <OverlayEditor
                overlay={scene.textOverlay}
                duration={scene.durationSec}
                onChange={(o) => props.onChange({ textOverlay: o })}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Downloads({ scene, needsEnd }: { scene: Scene; needsEnd: boolean }) {
  const links: Array<{ label: string; url: string }> = [];
  if (needsEnd) {
    if (scene.startImageUrl) links.push({ label: "start", url: scene.startImageUrl });
    if (scene.endImageUrl) links.push({ label: "end", url: scene.endImageUrl });
  } else if (scene.imageUrl ?? scene.startImageUrl) {
    links.push({ label: "still", url: (scene.imageUrl ?? scene.startImageUrl)! });
  }
  if (scene.videoUrl) links.push({ label: "clip", url: scene.videoUrl });
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.url}
          download
          target="_blank"
          rel="noreferrer"
          className="hover:text-accent underline decoration-dotted"
        >
          ↓ {l.label}
        </a>
      ))}
    </div>
  );
}

function Preview({ scene, needsEnd }: { scene: Scene; needsEnd: boolean }) {
  if (scene.videoUrl) {
    return (
      <video
        src={scene.videoUrl}
        controls
        loop
        className="w-full rounded-lg bg-black aspect-video object-contain"
      />
    );
  }
  if (needsEnd) {
    return (
      <div className="grid grid-cols-2 gap-1.5">
        <Thumb url={scene.startImageUrl} label="start" />
        <Thumb url={scene.endImageUrl} label="end" />
      </div>
    );
  }
  return <Thumb url={scene.imageUrl ?? scene.startImageUrl} label="still" />;
}

function Thumb({ url, label }: { url?: string; label: string }) {
  return (
    <div className="relative aspect-video rounded-lg bg-ink-800 border border-ink-700 overflow-hidden flex items-center justify-center">
      {url ? (
        <img src={url} className="h-full w-full object-cover" />
      ) : (
        <span className="text-[10px] text-slate-600 uppercase">{label}</span>
      )}
    </div>
  );
}

function OverlayEditor({
  overlay,
  duration,
  onChange,
}: {
  overlay?: TextOverlay;
  duration: number;
  onChange: (o: TextOverlay | undefined) => void;
}) {
  const o: TextOverlay = overlay ?? {
    text: "",
    position: "bottom",
    fontSize: 42,
    color: "#ffffff",
    startSec: 0,
    endSec: duration,
  };
  const set = (patch: Partial<TextOverlay>) => onChange({ ...o, ...patch });

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-ink-850 border border-ink-700 p-3">
      <TextArea
        rows={2}
        value={o.text}
        onChange={(e) => set({ text: e.target.value })}
        placeholder="Overlay text (burned into the clip)…"
      />
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1">
          pos
          <Select
            value={o.position}
            onChange={(e) => set({ position: e.target.value as TextOverlay["position"] })}
          >
            {OVERLAY_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex items-center gap-1">
          size
          <input
            type="number"
            min={8}
            max={200}
            value={o.fontSize}
            onChange={(e) => set({ fontSize: Number(e.target.value) || 12 })}
            className="w-16 rounded bg-ink-800 border border-ink-700 px-1.5 py-1"
          />
        </label>
        <label className="flex items-center gap-1">
          color
          <input
            type="color"
            value={o.color}
            onChange={(e) => set({ color: e.target.value })}
            className="h-7 w-9 rounded bg-ink-800 border border-ink-700"
          />
        </label>
        <label className="flex items-center gap-1">
          {o.startSec}s–{o.endSec}s
        </label>
        <button
          className="ml-auto text-red-400 hover:underline"
          onClick={() => onChange(undefined)}
        >
          remove
        </button>
      </div>
    </div>
  );
}

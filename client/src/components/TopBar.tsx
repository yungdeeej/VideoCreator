import { useEffect, useRef, useState } from "react";
import type {
  AspectRatio,
  JobStatus,
  Project,
  PublicConfig,
  UpdateProjectInput,
} from "@storyforge/shared";
import { Button, Input, Label, Spinner, TextArea } from "./ui";
import { fmtUSD } from "../lib/cost";

export interface TopBarProps {
  project: Project;
  config: PublicConfig;
  cost: number;
  spent: number;
  busy: boolean;
  onPatch: (patch: UpdateProjectInput) => void;
  onUploadReference: (file: File) => void | Promise<void>;
  onGenerateAll?: () => void;
  onCombine?: () => void;
  exportStatus: JobStatus;
  exportProgress?: number;
  exportUrl?: string;
  onBack: () => void;
}

export function TopBar(props: TopBarProps) {
  const { project, config, cost, spent } = props;
  const [name, setName] = useState(project.name);
  const [showSettings, setShowSettings] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setName(project.name), [project.name]);

  return (
    <div className="sticky top-0 z-10 border-b border-ink-700 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto max-w-5xl px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="subtle" onClick={props.onBack}>
            ← Projects
          </Button>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name !== project.name && props.onPatch({ name })}
            className="max-w-xs font-medium"
          />

          <label className="flex items-center gap-1 text-xs text-slate-400">
            Aspect
            <select
              value={project.aspectRatio}
              onChange={(e) =>
                props.onPatch({ aspectRatio: e.target.value as AspectRatio })
              }
              className="rounded-lg bg-ink-850 border border-ink-700 px-2 py-1.5 text-sm text-slate-100"
            >
              {config.aspectRatios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>

          <Button variant="ghost" onClick={() => setShowSettings((v) => !v)}>
            ⚙ Style
          </Button>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                Est. {fmtUSD(cost)}
              </div>
              <div className="font-mono text-sm text-accent" title="Actual spend so far">
                spent {fmtUSD(spent)}
              </div>
            </div>
            <Button
              variant="primary"
              onClick={props.onGenerateAll}
              disabled={!props.onGenerateAll || props.busy}
            >
              {props.busy ? <Spinner /> : "⚡"} Generate All
            </Button>
            <CombineButton {...props} />
          </div>
        </div>

        {showSettings && (
          <div className="mt-3 grid gap-4 md:grid-cols-2 rounded-xl border border-ink-700 bg-ink-900 p-4">
            <div>
              <Label>Style preset (prefixed to every image prompt)</Label>
              <TextArea
                rows={4}
                defaultValue={project.stylePreset}
                onBlur={(e) =>
                  e.target.value !== project.stylePreset &&
                  props.onPatch({ stylePreset: e.target.value })
                }
              />
            </div>
            <div className="space-y-3">
              <div>
                <Label>Motion suffix (appended to every motion prompt)</Label>
                <TextArea
                  rows={2}
                  defaultValue={project.motionSuffix}
                  onBlur={(e) =>
                    e.target.value !== project.motionSuffix &&
                    props.onPatch({ motionSuffix: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Character reference (consistency)</Label>
                <div className="flex items-center gap-3">
                  {project.characterRefImageUrl ? (
                    <img
                      src={project.characterRefImageUrl}
                      className="h-14 w-14 rounded-lg object-cover border border-ink-700"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-lg border border-dashed border-ink-600 flex items-center justify-center text-[10px] text-slate-600">
                      none
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) props.onUploadReference(f);
                      e.target.value = "";
                    }}
                  />
                  <Button variant="ghost" onClick={() => fileRef.current?.click()}>
                    Upload
                  </Button>
                  {project.characterRefImageUrl && (
                    <Button
                      variant="subtle"
                      onClick={() => props.onPatch({ characterRefImageUrl: "" })}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CombineButton(props: TopBarProps) {
  const { exportStatus, exportProgress, exportUrl } = props;
  if (exportStatus === "running") {
    return (
      <Button variant="ghost" disabled>
        <Spinner /> Rendering{" "}
        {exportProgress != null ? `${Math.round(exportProgress * 100)}%` : ""}
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        onClick={props.onCombine}
        disabled={!props.onCombine || props.busy}
      >
        🎬 Combine & Export
      </Button>
      {exportStatus === "done" && exportUrl && (
        <a
          href={exportUrl}
          download
          className="rounded-lg bg-green-500/15 px-3 py-1.5 text-sm text-green-300 hover:bg-green-500/25"
        >
          ↓ MP4
        </a>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import type { TitleCard, UpdateTitleCardInput } from "@storyforge/shared";
import { Button, Input, Label } from "./ui";

export interface TitleCardItemProps {
  card: TitleCard;
  onChange: (patch: UpdateTitleCardInput) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function TitleCardItem({
  card,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: TitleCardItemProps) {
  const [text, setText] = useState(card.text);
  const [subtitle, setSubtitle] = useState(card.subtitle ?? "");

  useEffect(() => setText(card.text), [card.text]);
  useEffect(() => setSubtitle(card.subtitle ?? ""), [card.subtitle]);

  return (
    <div className="rounded-2xl border border-dashed border-ink-600 bg-ink-900/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wide text-slate-500">
          Title card
        </span>
        <div className="flex items-center gap-1">
          <Button variant="subtle" onClick={onMoveUp} disabled={!onMoveUp}>
            ↑
          </Button>
          <Button variant="subtle" onClick={onMoveDown} disabled={!onMoveDown}>
            ↓
          </Button>
          <Button variant="danger" onClick={onDelete}>
            ✕
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* live preview */}
        <div
          className="w-56 shrink-0 aspect-video rounded-lg border border-ink-700 flex flex-col items-center justify-center text-center px-3"
          style={{ backgroundColor: card.bgColor, color: card.textColor }}
        >
          <div className="text-lg font-semibold leading-tight">
            {card.text || "Title"}
          </div>
          {card.subtitle && (
            <div className="mt-1 text-xs opacity-80">{card.subtitle}</div>
          )}
        </div>

        <div className="flex-1 space-y-2">
          <div>
            <Label>Title</Label>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => text !== card.text && onChange({ text })}
            />
          </div>
          <div>
            <Label>Subtitle</Label>
            <Input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              onBlur={() =>
                subtitle !== (card.subtitle ?? "") && onChange({ subtitle })
              }
            />
          </div>
          <div className="flex flex-wrap items-end gap-4 text-xs">
            <label>
              <Label>Duration (s)</Label>
              <input
                type="number"
                min={1}
                max={15}
                value={card.durationSec}
                onChange={(e) =>
                  onChange({ durationSec: Number(e.target.value) || 1 })
                }
                className="w-20 rounded-lg bg-ink-850 border border-ink-700 px-2.5 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1">
              <Label>Background</Label>
              <input
                type="color"
                value={card.bgColor}
                onChange={(e) => onChange({ bgColor: e.target.value })}
                className="h-8 w-12 rounded bg-ink-800 border border-ink-700"
              />
            </label>
            <label className="flex flex-col gap-1">
              <Label>Text</Label>
              <input
                type="color"
                value={card.textColor}
                onChange={(e) => onChange({ textColor: e.target.value })}
                className="h-8 w-12 rounded bg-ink-800 border border-ink-700"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

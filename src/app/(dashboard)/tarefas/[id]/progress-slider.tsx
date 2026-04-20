"use client";

import { useState, useTransition } from "react";
import { updateTaskProgressAction } from "../actions";

interface ProgressSliderProps {
  taskId: string;
  initialProgress: number;
}

export function ProgressSlider({ taskId, initialProgress }: ProgressSliderProps) {
  const [value, setValue] = useState(initialProgress);
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue(Number(e.target.value));
  }

  function handleCommit() {
    startTransition(async () => {
      await updateTaskProgressAction(taskId, value);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
        <span>Progresso manual</span>
        <span className={`font-medium ${pending ? "text-neutral-400" : "text-neutral-700"}`}>
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={handleChange}
        onMouseUp={handleCommit}
        onTouchEnd={handleCommit}
        className="w-full h-1.5 appearance-none bg-neutral-100 rounded-full cursor-pointer accent-neutral-900"
      />
      <div className="flex justify-between text-[10px] text-neutral-300 mt-1">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

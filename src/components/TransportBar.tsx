"use client";

import { Play, Square, SkipBack, Download, Loader2 } from "lucide-react";
import { useTracksStore } from "@/store/tracks";
import { mixer } from "@/lib/mixer";
import { useState } from "react";

export default function TransportBar() {
  const { tracks, analysis, isPlaying, setPlaying } = useTracksStore();
  const [isExporting, setIsExporting] = useState(false);

  const handlePlayStop = () => {
    if (isPlaying) {
      mixer.stop();
      setPlaying(false);
    } else {
      setPlaying(true);
      const offset = mixer.currentPosition;
      mixer.play(tracks, () => setPlaying(false), offset);
    }
  };

  const handleRewind = () => {
    if (isPlaying) {
      mixer.seekTo(tracks, 0, () => setPlaying(false));
    } else {
      mixer.stop();
      setPlaying(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const wavBlob = await mixer.exportMix(tracks);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hum-producer-mix-${Date.now()}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    }
    setIsExporting(false);
  };

  return (
    <div className="flex items-center gap-4">
      {/* Transport Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleRewind}
          className="transport-btn w-8 h-8 flex items-center justify-center rounded"
        >
          <SkipBack className="w-3.5 h-3.5 text-[#808088]" />
        </button>

        <button
          onClick={handlePlayStop}
          className={`transport-btn w-9 h-8 flex items-center justify-center rounded ${
            isPlaying ? "!bg-[#00FF87]/10 !border-[#00FF87]/30" : ""
          }`}
        >
          {isPlaying ? (
            <Square className="w-3.5 h-3.5 text-[#00FF87]" />
          ) : (
            <Play className="w-3.5 h-3.5 text-[#E0E0E4] ml-0.5" />
          )}
        </button>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="transport-btn w-8 h-8 flex items-center justify-center rounded"
        >
          {isExporting ? (
            <Loader2 className="w-3.5 h-3.5 text-[#808088] animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5 text-[#808088]" />
          )}
        </button>
      </div>

      {/* Analysis LCD Readouts */}
      {analysis && (
        <div className="flex items-center gap-2">
          <div className="lcd-display px-2 py-0.5 flex items-center gap-1.5">
            <span className="text-[9px] text-[#505058] uppercase">Key</span>
            <span className="text-[11px] led-cyan font-medium">{analysis.key}</span>
          </div>
          <div className="lcd-display px-2 py-0.5 flex items-center gap-1.5">
            <span className="text-[9px] text-[#505058] uppercase">BPM</span>
            <span className="text-[11px] led-green font-medium font-[tabular-nums]">{analysis.tempo}</span>
          </div>
          <div className="lcd-display px-2 py-0.5 flex items-center gap-1.5">
            <span className="text-[9px] text-[#505058] uppercase">Mood</span>
            <span className="text-[11px] led-purple font-medium">{analysis.mood}</span>
          </div>
          <div className="lcd-display px-2 py-0.5 flex items-center gap-1.5">
            <span className="text-[9px] text-[#505058] uppercase">Genre</span>
            <span className="text-[11px] led-amber font-medium">{analysis.genre}</span>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { Play, Square, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTracksStore } from "@/store/tracks";
import { mixer } from "@/lib/mixer";
import TrackItem from "./TrackItem";
import { useState } from "react";

export default function TrackList() {
  const { tracks, analysis, isPlaying, setPlaying, step } = useTracksStore();
  const [isExporting, setIsExporting] = useState(false);

  if (step !== "studio") return null;

  const handlePlayStop = () => {
    if (isPlaying) {
      mixer.stop();
      setPlaying(false);
    } else {
      setPlaying(true);
      mixer.play(tracks, () => setPlaying(false));
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
      alert("Export failed. Make sure you have at least one active track.");
    }
    setIsExporting(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {analysis && (
        <div className="flex flex-wrap gap-2 justify-center">
          <Badge variant="outline" className="text-violet-400 border-violet-600">
            Key: {analysis.key}
          </Badge>
          <Badge variant="outline" className="text-blue-400 border-blue-600">
            {analysis.tempo} BPM
          </Badge>
          <Badge variant="outline" className="text-emerald-400 border-emerald-600">
            {analysis.mood}
          </Badge>
          <Badge variant="outline" className="text-orange-400 border-orange-600">
            {analysis.genre}
          </Badge>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Your Tracks</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handlePlayStop}
            className={
              isPlaying
                ? "bg-red-600 hover:bg-red-700"
                : "bg-violet-600 hover:bg-violet-700"
            }
          >
            {isPlaying ? (
              <>
                <Square className="w-4 h-4 mr-1" /> Stop
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" /> Play All
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-1" />
            )}
            Export WAV
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {tracks.map((track) => (
          <TrackItem key={track.id} track={track} />
        ))}
      </div>
    </div>
  );
}

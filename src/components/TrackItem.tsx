"use client";

import { useRef, useEffect } from "react";
import { Volume2, VolumeX, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Track } from "@/types/music";
import { useTracksStore } from "@/store/tracks";
import WaveSurfer from "wavesurfer.js";

interface TrackItemProps {
  track: Track;
}

export default function TrackItem({ track }: TrackItemProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const { updateTrack, removeTrack } = useTracksStore();

  useEffect(() => {
    if (!waveformRef.current || !track.audioBuffer) return;

    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: track.color + "80",
      progressColor: track.color,
      cursorColor: "transparent",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 48,
      interact: false,
      normalize: true,
    });

    // Load from AudioBuffer's channel data
    const channelData = track.audioBuffer.getChannelData(0);
    ws.load("", [channelData], track.audioBuffer.duration);

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
    };
  }, [track.audioBuffer, track.color]);

  const typeColors: Record<string, string> = {
    hum: "bg-violet-600",
    arrangement: "bg-blue-600",
    beat: "bg-orange-600",
    instrument: "bg-emerald-600",
  };

  const typeIcons: Record<string, string> = {
    hum: "🎤",
    arrangement: "🎵",
    beat: "🥁",
    instrument: "🎸",
  };

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg bg-gray-900 border border-gray-800 ${
        track.muted ? "opacity-50" : ""
      }`}
    >
      {/* Track info */}
      <div className="flex items-center gap-2 w-40 shrink-0">
        <span className="text-lg">{typeIcons[track.type]}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {track.name}
          </p>
          <Badge
            className={`text-[10px] px-1.5 py-0 ${typeColors[track.type]}`}
          >
            {track.type}
          </Badge>
        </div>
      </div>

      {/* Waveform */}
      <div className="flex-1 min-w-0">
        {track.isLoading ? (
          <div className="flex items-center justify-center h-12">
            <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
            <span className="text-xs text-gray-500 ml-2">Generating...</span>
          </div>
        ) : (
          <div ref={waveformRef} className="w-full" />
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant={track.muted ? "destructive" : "outline"}
          className="w-8 h-8 p-0"
          onClick={() => updateTrack(track.id, { muted: !track.muted })}
        >
          {track.muted ? (
            <VolumeX className="w-3.5 h-3.5" />
          ) : (
            <Volume2 className="w-3.5 h-3.5" />
          )}
        </Button>

        <Button
          size="sm"
          variant={track.solo ? "default" : "outline"}
          className={`w-8 h-8 p-0 text-xs font-bold ${
            track.solo ? "bg-yellow-600 hover:bg-yellow-700" : ""
          }`}
          onClick={() => updateTrack(track.id, { solo: !track.solo })}
        >
          S
        </Button>

        <div className="w-20">
          <Slider
            value={[track.volume * 100]}
            max={100}
            step={1}
            onValueChange={([val]) =>
              updateTrack(track.id, { volume: val / 100 })
            }
            className="w-full"
          />
        </div>

        {track.type !== "hum" && (
          <Button
            size="sm"
            variant="ghost"
            className="w-8 h-8 p-0 text-gray-500 hover:text-red-500"
            onClick={() => removeTrack(track.id)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

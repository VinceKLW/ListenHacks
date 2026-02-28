import HumRecorder from "@/components/HumRecorder";
import TrackList from "@/components/TrackList";
import VoiceCommandBar from "@/components/VoiceCommandBar";
import TextCommandBar from "@/components/TextCommandBar";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎵</span>
            <h1 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
              HUM PRODUCER
            </h1>
          </div>
          <span className="text-xs text-gray-600 font-mono">
            ListenHacks 2025
          </span>
        </div>
      </header>

      <div className="px-6 py-8">
        <HumRecorder />
        <TrackList />
        <VoiceCommandBar />
        <TextCommandBar />
      </div>
    </main>
  );
}

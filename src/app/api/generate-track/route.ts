import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { key, tempo, mood, genre, description } = await req.json();

    const prompt = `${genre} music in ${key} at ${tempo} BPM, ${mood} mood. ${description || ""}`.trim();

    // Step 1: Create track task
    const createRes = await fetch(
      "https://public-api.beatoven.ai/api/v1/tracks",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.BEATOVEN_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: { text: prompt },
          format: "mp3",
          loopable: false,
          duration: 30000,
        }),
      }
    );

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error("Beatoven create error:", createRes.status, errText);
      return NextResponse.json(
        { error: `Beatoven API error: ${createRes.status}` },
        { status: 502 }
      );
    }

    const createData = await createRes.json();
    const taskId = createData.task_id;

    if (!taskId) {
      return NextResponse.json(
        { error: "No task_id returned from Beatoven" },
        { status: 502 }
      );
    }

    // Step 2: Poll for completion (max ~120 seconds)
    let trackUrl: string | null = null;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 3000));

      const statusRes = await fetch(
        `https://public-api.beatoven.ai/api/v1/tracks/${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.BEATOVEN_API_KEY}`,
          },
        }
      );

      if (!statusRes.ok) continue;

      const statusData = await statusRes.json();

      if (statusData.status === "composed" && statusData.meta?.track_url) {
        trackUrl = statusData.meta.track_url;
        break;
      }

      if (statusData.status === "failed") {
        return NextResponse.json(
          { error: "Track generation failed" },
          { status: 502 }
        );
      }
    }

    if (!trackUrl) {
      return NextResponse.json(
        { error: "Track generation timed out" },
        { status: 504 }
      );
    }

    return NextResponse.json({ trackUrl });
  } catch (error) {
    console.error("Generate track error:", error);
    return NextResponse.json(
      { error: "Failed to generate track" },
      { status: 500 }
    );
  }
}

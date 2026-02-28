import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  try {
    const audioRes = await fetch(url);

    if (!audioRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch audio" },
        { status: 502 }
      );
    }

    const contentType =
      audioRes.headers.get("content-type") || "audio/mpeg";
    const buffer = await audioRes.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Proxy fetch failed" },
      { status: 500 }
    );
  }
}

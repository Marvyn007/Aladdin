import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { parseResumePdf, parseLinkedInPdf } from "@/lib/resume-generation/parser";
import { convertFileToBuffer } from "@/lib/resume-generation/utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const uploadType = (formData.get("type") as string) || "resume"; // 'resume' | 'linkedin'

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    const buffer = await convertFileToBuffer(file);
    const parsedResume =
      uploadType === "linkedin"
        ? await parseLinkedInPdf(buffer)
        : await parseResumePdf(buffer);

    return NextResponse.json({
      success: true,
      data: parsedResume,
      confidence: 0.9,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[parse-resume] Error:", err.message);
    return NextResponse.json(
      { error: err.message || "Failed to parse resume." },
      { status: 500 }
    );
  }
}
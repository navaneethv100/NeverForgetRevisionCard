import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cardId } = await params;
  const cardIdNum = parseInt(cardId);

  const card = await prisma.card.findFirst({ where: { id: cardIdNum, userId: user.id } });
  if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

  try {
    const body = await req.json();
    const updated = await prisma.card.update({
      where: { id: cardIdNum },
      data: {
        front: body.front ?? card.front,
        hint: body.hint ?? card.hint,
        back: body.back ?? card.back,
        options: body.options ? JSON.stringify(body.options) : card.options,
        correctOption: body.correct_option ?? card.correctOption,
        explanation: body.explanation ?? card.explanation,
        verified: body.verified ?? card.verified,
      },
    });

    return NextResponse.json({ id: updated.id, message: "Card updated" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cardId } = await params;
  const cardIdNum = parseInt(cardId);

  const card = await prisma.card.findFirst({ where: { id: cardIdNum, userId: user.id } });
  if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

  await prisma.card.delete({ where: { id: cardIdNum } });

  return NextResponse.json({ message: "Card deleted" });
}

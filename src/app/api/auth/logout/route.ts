import { NextResponse } from "next/server";
import { logoutUser } from "@/lib/auth";

export async function POST() {
  await logoutUser();
  return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));
}

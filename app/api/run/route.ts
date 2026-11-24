import { z } from "zod";
import { insertMany } from "@/lib/db";
import { neighbours, randomBatch } from "@/lib/generate";
import { getFormat } from "@/lib/checksum/formats";
import { normalize } from "@/lib/normalize";

export const runtime = "nodejs";

const Body = z.object({
  brand: z.enum(["amazon", "apple", "xbox"]),
  seed: z.string().optional(),
  radius: z.number().int().min(1).max(5000).default(200),
  random: z.number().int().min(0).max(5000).default(0),
});

export async function POST(req: Request) {
  if (req.headers.get("x-run-token") !== process.env.RUN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = Body.parse(await req.json());

  const codes = [
    ...(body.seed ? neighbours(normalize(body.seed, body.brand), body.radius, getFormat(body.brand)) : []),
    ...(body.random ? randomBatch(body.brand, body.random) : []),
  ];

  const added = await insertMany(body.brand, codes);
  return Response.json({ added, generated: codes.length });
}

import { validMemoryPin } from "@/lib/memory-pin";
import { revalidatePath } from "next/cache";
import { mutation, reply, uuid } from "@/lib/mutation";
export async function POST(request: Request) {
  const context = await mutation(request);
  if (context.error) return context.error;
  const { db, body } = context;
  if (!uuid(body.generationId) || !validMemoryPin(body.pin)) return reply({ error: "Choose a pin on the Columbia map before saving." }, 400);
  const { error } = await db.rpc("publish_memory", {
    draft_id: body.generationId, selected_map: body.pin.mapId,
    selected_x: body.pin.x, selected_y: body.pin.y, selected_location: body.pin.location,
  });
  if (error) return reply({ error: "Couldn’t save this memory. Your draft is still here; please retry." }, 503);
  revalidatePath("/");
  return reply({ success: true });
}

import { mutation, reply } from "@/lib/mutation";
import { revalidatePath } from "next/cache";
export const maxDuration = 120;
export async function DELETE(request: Request) {
  const context = await mutation(request);
  if (context.error) return context.error;
  const { db, body } = context;
  if (body.confirmation !== "DELETE") return reply({ error: "Please confirm account deletion." }, 400);
  const { data, error } = await db.functions.invoke("delete-account", { body: { confirmation: "DELETE" } });
  if (error || !data?.success) return reply({ error: "Deletion couldn’t finish. Your uploaded memory photos are kept; your profile photo may already be removed. Please retry to finish deleting your account." }, 503);
  await db.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  return reply({ success: true });
}

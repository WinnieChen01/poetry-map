import { normalizePoem, isRefinement, poetryPrompt } from "@/lib/poetry";
import { poetryImage } from "@/lib/poetry-image";
import { geminiText, geminiModelList } from "@/lib/gemini";
import { mutation, reply, uuid } from "@/lib/mutation";
export const maxDuration = 300;

export async function POST(request: Request) {
  const context = await mutation(request);
  if (context.error) return context.error;
  const { db, user, body } = context;
  // Preserve the original model output. An edited poem becomes a separate,
  // explicitly marked revision that the unchanged publishing flow can save.
  if (body.action === "edit") {
    const poem = normalizePoem(body.poem);
    if (!uuid(body.generationId) || !poem) return reply({ error: "Use three nonempty lines, up to 300 characters total." }, 400);
    const { data: source } = await db.from("generations").select("id,image_id,situation,location,prompt,model,caption").eq("id", body.generationId).eq("user_id", user.id).single();
    if (!source?.caption) return reply({ error: "Your poem is unavailable. Generate a new poem first." }, 404);
    if (source.caption === poem) return reply({ id: source.id, caption: poem });
    const revisionPrompt = JSON.stringify({ kind: "manual_poetry_revision", sourceGenerationId: source.id, originalText: source.caption, userEditedText: poem });
    const { data: revision, error } = await db.from("generations").insert({ image_id: source.image_id, situation: source.situation, location: source.location, model: "manual-edit", prompt: revisionPrompt }).select("id").single();
    if (error) return reply({ error: error.code === "P0001" ? "The hourly draft limit has been reached. Your edits are still here; try saving later." : "Couldn’t save your edits. Please retry." }, error.code === "P0001" ? 429 : 503);
    const { error: saveError } = await db.from("generations").update({ caption: poem }).eq("id", revision.id).select("id").single();
    if (saveError) return reply({ error: "Couldn’t save your edits. Please retry." }, 503);
    return reply({ id: revision.id, caption: poem });
  }
  const refinement = body.refinement ?? "";
  if (refinement !== "" && !isRefinement(refinement)) return reply({ error: "Choose one of the poem refinement options." }, 400);
  const previousPoem = body.previousPoem ? normalizePoem(body.previousPoem) : "";
  if (previousPoem === null) return reply({ error: "Use three lines for the poem you want to refine." }, 400);
  const situation = typeof body.situation === "string" ? body.situation.trim() : "";
  if (!uuid(body.imageId) || situation.length > 500) return reply({ error: "Choose an image. Your context is optional and can be up to 500 characters." }, 400);
  if (!process.env.GEMINI_API_KEY) return reply({ error: "AI generation isn’t configured yet. Please try again later." }, 503);
  const { data: image, error: imageError } = await db.from("images").select("id,description,image_url").eq("id", body.imageId).single();
  if (imageError || !image) return reply({ error: "That image is unavailable." }, 400);
  let visual;
  try { visual = await poetryImage(image.image_url); }
  catch { return reply({ error: "Couldn’t open this image for poetry. Please choose another image or retry." }, 422); }
  const prompt = poetryPrompt(situation, refinement, previousPoem);
  const { data: generation, error } = await db.from("generations").insert({ image_id: image.id, situation, location: "Lawn", prompt, model: geminiModelList()[0] }).select("id").single();
  if (error) return reply({ error: error.code === "P0001" ? "You’ve reached 10 generations this hour. Try again later." : "Couldn’t start generation. Please try again." }, error.code === "P0001" ? 429 : 503);
  try {
    const outcome = await geminiText([{ text: prompt }, visual]);
    if ("error" in outcome) return reply({ error: outcome.error }, outcome.status);
    const caption = normalizePoem(outcome.text);
    if (!caption) return reply({ error: "The response wasn’t a short three-line poem. Please regenerate; your current draft is unchanged." }, 422);
    const { error: saveError } = await db.from("generations").update({ caption }).eq("id", generation.id).select("id").single();
    if (saveError) return reply({ error: "Couldn’t save the poem. Please try again." }, 503);
    return reply({ id: generation.id, caption });
  } catch { return reply({ error: "Gemini didn’t respond after retries. Your draft is unchanged; please try again later." }, 503); }
}

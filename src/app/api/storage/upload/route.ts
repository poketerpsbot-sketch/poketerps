import type { NextRequest } from "next/server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { AppError, validationError } from "@/lib/errors";
import { apiJson, handleApi } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { uploadImage } from "@/lib/services/storage";
import { uploadMetadataSchema } from "@/lib/validation/storage";

const MAX_MULTIPART_BYTES = 11 * 1024 * 1024;

export async function POST(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireCurrentUser();
    await guardBrowserMutation(request, rateLimits.upload, actor.id);
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("multipart/form-data;")) {
      throw new AppError("UNSUPPORTED_MEDIA_TYPE", "Le formulaire multipart est requis.", 415);
    }
    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) {
      throw new AppError("PAYLOAD_TOO_LARGE", "Fichier trop volumineux.", 413);
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError("FILE_REQUIRED", "Un fichier est requis.", 400);
    }
    const metadata = uploadMetadataSchema.safeParse({
      bucket: form.get("bucket"),
      relatedId: form.get("relatedId"),
    });
    if (!metadata.success) throw validationError(metadata.error);
    const uploaded = await uploadImage(file, metadata.data.bucket, actor, metadata.data.relatedId);
    return apiJson({ path: uploaded.path, publicUrl: uploaded.publicUrl }, { status: 201 });
  });
}

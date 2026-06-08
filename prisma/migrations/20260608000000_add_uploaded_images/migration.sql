-- CreateTable
CREATE TABLE "uploaded_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploaded_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "uploaded_images_created_at_idx" ON "uploaded_images"("created_at");

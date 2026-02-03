-- CreateTable
CREATE TABLE "Actor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instruction" TEXT,
    "imageUrl" TEXT,
    "videoUrl" TEXT NOT NULL,
    "voiceId" TEXT,
    "gender" TEXT NOT NULL DEFAULT 'F',
    "age" TEXT NOT NULL DEFAULT 'Adult',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Actor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Actor_userId_idx" ON "Actor"("userId");

-- AddForeignKey
ALTER TABLE "Actor" ADD CONSTRAINT "Actor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

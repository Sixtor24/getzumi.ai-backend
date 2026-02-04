-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "Video_projectId_idx" ON "Video"("projectId");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

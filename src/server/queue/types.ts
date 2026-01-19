export type VideoJobPayload = {
  workspaceId: string;
  prompt: string;
  aspectRatio?: '9:16' | '16:9' | '1:1';
};

export type ImageJobPayload = {
  workspaceId: string;
  inputAssetId: string;
  prompt: string;
};

import { WorkSummary } from '@app/core/models/catalog';

export interface ReadingList {
  id: string;
  title: string;
  description: string;
  published: boolean;
  ownerUsername: string;
  ownerId: string;
  upvotes: number;
  items: { work: WorkSummary; note: string | null }[];
  updatedAt: string;
}

export interface ReadingListPayload {
  title: string;
  description: string;
  published: boolean;
  items: { workId: string; note?: string | null }[];
}

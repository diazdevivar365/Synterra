import { aquilaFetch } from '@/lib/aquila-server';

export interface BrandComment {
  id: number;
  user_email: string;
  parent_comment_id: number | null;
  section_anchor: string;
  text: string;
  mentions: string[];
  created_at: string;
  is_own: boolean;
}

interface CommentsResponse {
  brand_id: string;
  count: number;
  comments: BrandComment[];
}

export async function getComments(wsId: string, brandId: string): Promise<BrandComment[]> {
  const data = await aquilaFetch<CommentsResponse>(
    wsId,
    `/brands/${encodeURIComponent(brandId)}/comments`,
  );
  return data?.comments ?? [];
}

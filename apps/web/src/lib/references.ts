export type ReferenceKind = 'image' | 'doc' | 'url' | 'note' | 'video';

export interface Reference {
  id: string;
  org_id: string;
  brand_id: string | null;
  kind: ReferenceKind;
  title: string;
  url: string | null;
  notes: string | null;
  tags: string[];
  extracted_flags: Record<string, unknown> | null;
  usage_count: number;
  last_used_at: string | null;
  shared: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const REFERENCE_KINDS: { value: ReferenceKind; label: string; hint: string }[] = [
  { value: 'url', label: 'URL', hint: 'Link a un sitio, post o artículo' },
  { value: 'image', label: 'Imagen', hint: 'URL de imagen inspiradora' },
  { value: 'doc', label: 'Documento', hint: 'URL a PDF o docs (Drive, Notion, etc)' },
  { value: 'video', label: 'Video', hint: 'URL a YouTube, Vimeo, etc' },
  { value: 'note', label: 'Nota', hint: 'Texto libre / insight' },
];

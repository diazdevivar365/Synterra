export type ToqueKind = 'style' | 'url' | 'book' | 'author' | 'quote' | 'free_text';

export interface Toque {
  id: string;
  org_id: string;
  kind: ToqueKind;
  label: string;
  content: string | null;
  payload: Record<string, unknown>;
  extracted_flags: Record<string, unknown> | null;
  shared: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const TOQUE_KINDS: { value: ToqueKind; label: string; hint: string }[] = [
  { value: 'style', label: 'Estilo', hint: 'Una paleta / tono / referencia visual' },
  { value: 'url', label: 'URL', hint: 'Un sitio o post que inspira' },
  { value: 'book', label: 'Libro', hint: 'Título + autor (opcional capítulo)' },
  { value: 'author', label: 'Autor', hint: 'Una voz que querés imitar' },
  { value: 'quote', label: 'Cita', hint: 'Frase textual que resume una idea' },
  { value: 'free_text', label: 'Texto libre', hint: 'Párrafo propio describiendo el toque' },
];

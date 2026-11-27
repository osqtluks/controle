export interface Pessoa {
  id: string;
  nome: string;
  tipo: "cliente" | "fornecedor" | "ambos";
  telefone: string | null;
  observacoes: string | null;
  created_at: string;
}

export const TIPO_PESSOA: Record<Pessoa["tipo"], string> = {
  cliente: "Cliente",
  fornecedor: "Fornecedor",
  ambos: "Cliente e fornecedor",
};

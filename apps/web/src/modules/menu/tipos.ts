export interface PrefsMenu {
  titulo: string;
  subtitulo: string;
  mostrar_estoque: boolean;
}

export const PREFS_MENU_PADRAO: PrefsMenu = {
  titulo: "Cardápio",
  subtitulo: "Preço por grama — quanto mais leva, menos paga",
  mostrar_estoque: false,
};

/** Descrição alternativa de um produto, só para o Menu (a padrão continua no produto). */
export interface DescricaoVitrine {
  id: string;
  produto_id: string;
  texto: string;
}

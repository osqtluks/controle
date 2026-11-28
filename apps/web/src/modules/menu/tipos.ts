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

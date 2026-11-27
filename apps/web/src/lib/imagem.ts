/** Reduz uma foto no navegador (lado maior ≤ `max` px, JPEG) antes de enviar. */
export async function comprimirImagem(arquivo: File, max = 1280, qualidade = 0.82): Promise<File> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob>((ok, falha) =>
    canvas.toBlob((b) => (b ? ok(b) : falha(new Error("Não foi possível processar a foto"))), "image/jpeg", qualidade),
  );
  return new File([blob], "foto.jpg", { type: "image/jpeg" });
}

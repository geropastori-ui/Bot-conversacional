import fs from "node:fs";
import path from "node:path";

/**
 * Lee todos los .md de la carpeta de conocimiento (ordenados por nombre) y los une en un
 * solo bloque. Se carga una vez al iniciar: el texto queda fijo para que el prompt caching
 * funcione. Para aplicar cambios, reiniciar el servidor.
 */
export function loadKnowledge(dir: string): string {
  if (!fs.existsSync(dir)) {
    throw new Error(`No existe la carpeta de conocimiento: ${dir}`);
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();
  if (files.length === 0) {
    throw new Error(`La carpeta ${dir} no tiene archivos .md`);
  }
  return files
    .map((f) => {
      const body = fs.readFileSync(path.join(dir, f), "utf8").trim();
      return `<documento archivo="${f}">\n${body}\n</documento>`;
    })
    .join("\n\n");
}

import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
const out = path.join(process.cwd(), "public/assets");
await fs.mkdir(out, { recursive: true });
const mapping = {
  "logo-usibar-light.webp": ["image_14.jpg", "image_14.png"],
  "logo-usibar-dark.webp": ["image_14.jpg", "image_14.png"],
  "hero-bench.webp": ["image_13.jpg", "image_13.png"],
  "cilindro-olhal.webp": ["image_3.jpg", "image_8.png"],
  "cilindro-tirante.webp": ["image (8).jpg", "image_5.png"],
  "cilindro-longo.webp": ["image (7).jpg", "image_6.png"],
  "bloco-robusto.webp": ["image (2).jpg", "image_11.png"],
  "bloco-manifold-medio.webp": ["image (6).jpg", "image_7.png"],
  "bloco-compacto.webp": ["image (4).jpg", "image_9.png"],
  "cilindro-valvula.webp": ["05c91bc4-8999-48b4-ad2f-0fa7a19cc73e.jpg", "image_3.png"],
  "bloco-manifold-longo.webp": ["225276e1-ced7-4928-861a-548eae5a5ce8.jpg", "image_4.png"],
};
for (const [output, names] of Object.entries(mapping)) {
  let input;
  for (const dir of ["raw", "."]) {
    for (const name of names) {
      const file = path.join(dir, name);
      try {
        await fs.access(file);
        input = file;
        break;
      } catch {}
    }
    if (input) break;
  }
  if (input) {
    await sharp(input)
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 96 })
      .toFile(path.join(out, output));
    console.log("Fotografia preservada:", output);
  } else {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="460"><rect width="800" height="460" fill="white"/><g fill="none" stroke="#aaa99d" stroke-width="1"><rect x="285" y="95" width="230" height="210"/><path d="M260 200h280M400 70v260"/><circle cx="400" cy="200" r="80"/></g><text x="400" y="360" text-anchor="middle" fill="#686b60" font-family="sans-serif" font-size="20">Fotografia em preparação</text><text x="400" y="391" text-anchor="middle" fill="#99998f" font-family="sans-serif" font-size="12">COMPONENTE FABRICADO SOB PROJETO</text></svg>',
    );
    await sharp(svg).webp().toFile(path.join(out, output));
    console.log("Fotografia pendente:", output);
  }
}

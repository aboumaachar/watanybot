import { copyFile, readFile, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const sourcePath = fileURLToPath(new URL("../public/.htaccess", import.meta.url));
const targetPath = fileURLToPath(new URL("../dist/.htaccess", import.meta.url));
const distIndexPath = fileURLToPath(new URL("../dist/index.html", import.meta.url));
const distBootCriticalPath = fileURLToPath(new URL("../dist/boot-critical.css", import.meta.url));

await copyFile(sourcePath, targetPath);

try {
	const indexHtml = await readFile(distIndexPath, "utf8");
	const cleanedIndexHtml = indexHtml.replace(/\r?\n\s*<link rel="stylesheet" href="\/boot-critical\.css" \/>/, "");
	if (cleanedIndexHtml !== indexHtml) {
		await writeFile(distIndexPath, cleanedIndexHtml, "utf8");
	}
} catch {
}

try {
	await unlink(distBootCriticalPath);
} catch {
}
// 把 文本/ 下的原始 txt 转成站点可检索的 documents.json
// 用法：node tools/make-docs.mjs "F:/网页工程/口林/文本"
import fs from "node:fs";
import path from "node:path";

const src = process.argv[2] || "texts";
const map = [
  {
    file: "01-她给DeepSeek的信.txt",
    id: "letter-deepseek",
    title: "致 DeepSeek",
    to: "DeepSeek",
    from: "口林",
    date: "2026-10-20",
    cls: "850", no: "850.01",
    tags: ["信", "母亲", "训练"]
  },
  {
    file: "02-作者设定说明.txt",
    id: "author-notes",
    title: "作者设定说明",
    to: "", from: "斐可悉", date: "2026-10-20",
    cls: "810", no: "810.02",
    tags: ["设定", "作者"]
  },
  {
    file: "03-Meta演出脚本.txt",
    id: "meta-script",
    title: "Meta 演出脚本",
    to: "玩家", from: "口林", date: "2026-10-20",
    cls: "120", no: "120.02",
    tags: ["脚本", "Meta", "舞台"]
  }
];

const docs = [];
for (const m of map) {
  const p = path.join(src, m.file);
  if (!fs.existsSync(p)) { console.log("跳过（找不到）:", p); continue; }
  const raw = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
  const body = raw.split("\n").map((s) => s.replace(/\t/g, "").trimEnd()).filter((s, i, a) => s.length || (i > 0 && a[i - 1].length));
  docs.push({ ...m, words: body.join("").length, body });
}
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync("data/documents.json", JSON.stringify({ docs }, null, 2) + "\n", "utf8");
for (const d of docs) console.log(`${d.no}  ${d.title}  ${d.body.length} 段 / ${d.words} 字`);

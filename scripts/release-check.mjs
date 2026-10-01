import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve(import.meta.dirname,"..");
const required=["app/page.tsx","public/manifest.webmanifest","public/sw.js","docs/CHECKLIST_DE_ACEITACAO.md","docs/INSTALACAO_E_SUPORTE.md","docs/ENTREGA_COMERCIAL.md","docs/TERMO_SUPORTE_MODELO.md"];
const errors=[];
for(const file of required) if(!existsSync(resolve(root,file))) errors.push(`Arquivo obrigatório ausente: ${file}`);
const sql=readdirSync(resolve(root,"supabase")).filter(name=>/^\d{3}_.+\.sql$/.test(name)).sort();
for(let number=2;number<=19;number++) if(!sql.some(name=>name.startsWith(String(number).padStart(3,"0")+"_"))) errors.push(`SQL ${String(number).padStart(3,"0")} ausente.`);
const packageJson=JSON.parse(readFileSync(resolve(root,"package.json"),"utf8"));
if(packageJson.version!=="1.0.0") errors.push("Versão comercial diferente de 1.0.0.");
if(errors.length){console.error(errors.join("\n"));process.exit(1)}
console.log("Orbis Gestão 1.0.0: estrutura da versão comercial conferida.");

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Uso: node scripts/package-client.mjs <nome> <slug> <email-proprietario> <arquivo.zip>
const [name, slug, email, output] = process.argv.slice(2);
if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || '') ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '') || !output?.endsWith('.zip')) {
  console.error('Uso: node scripts/package-client.mjs "Nome da empresa" identificador email@empresa.com.br /caminho/cliente.zip');
  process.exit(1);
}
const project = resolve(import.meta.dirname, '..');
const staging = mkdtempSync(join(tmpdir(), 'orbis-cliente-'));
const target = join(staging, 'orbis-gestao');
const excluded = new Set(['.git', '.openai', '.sites-runtime', '.next', '.wrangler', 'node_modules', 'dist', 'examples']);
const excludedFiles = new Set(['PROGRESSO_PROJETO.md', '.env', '.env.local', 'package-client.mjs']);
function copyDirectory(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source)) {
    if (excluded.has(entry) || excludedFiles.has(entry) || entry.endsWith('.tsbuildinfo') || entry.startsWith('Orbis_Gestao_Backup')) continue;
    const from = join(source, entry), to = join(destination, entry);
    if (statSync(from).isDirectory()) copyDirectory(from, to);
    else if (statSync(from).isFile()) writeFileSync(to, readFileSync(from));
  }
}
function sqlLiteral(value) { return value.replaceAll("'", "''"); }
function replaceFile(file, substitutions) {
  const path = join(target, file);
  let content = readFileSync(path, 'utf8');
  for (const [oldValue, newValue] of substitutions) content = content.replaceAll(oldValue, newValue);
  writeFileSync(path, content);
}
try {
  copyDirectory(project, target);
  const company = sqlLiteral(name.trim()), owner = sqlLiteral(email.toLowerCase());
  for (const file of ['supabase/setup.sql', 'supabase/002_employees_and_invites.sql']) {
    replaceFile(file, [
      ['rodriguesboletos@gmail.com', owner], ['ER Creative', company],
      ['er-creative', slug], ['Eduardo Rodrigues', 'Proprietário'],
    ]);
  }
  replaceFile('lib/supabase-auth.ts', [
    [' || "https://bnlhhnipeqhcdxmzkgwl.supabase.co"', ''],
    [' || "sb_publishable_ysJbAV0p5I40noKsNnzW5w_bb2AcfAl"', ''],
    ['// Os valores padrão preservam a instalação de desenvolvimento já publicada.\n', ''],
  ]);
  replaceFile('app/page.tsx', [
    ['Proprietário ER Creative', 'Proprietário'],
    ['PAINEL ER CREATIVE', 'PAINEL ADMINISTRATIVO'],
  ]);
  replaceFile('components/reports-view.tsx', [['sistema ER Creative Studio', 'sistema Orbis Gestão']]);
  writeFileSync(join(target, '.env.example'), 'NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=COLE_A_CHAVE_PUBLICAVEL\n');
  writeFileSync(join(target, 'INSTALACAO_CLIENTE.md'), `# Instalação independente — ${name}\n\n1. Crie um projeto Supabase na conta da empresa.\n2. No SQL Editor, execute supabase/setup.sql, depois todos os arquivos numerados de 002 a 012 em ordem.\n3. No Authentication, crie o usuário ${email.toLowerCase()} (proprietário), com acesso à própria caixa de e-mail.\n4. Copie .env.example para .env.local e preencha com a URL e a chave publicável do projeto desta empresa. Nunca coloque a service_role no frontend.\n5. Instale as dependências com pnpm install --frozen-lockfile e compile com pnpm build. Configure essas duas variáveis também na hospedagem antes da compilação.\n6. Configure o endereço publicado nas URLs permitidas do Authentication para recuperação de senha.\n7. Abra o site e siga docs/CHECKLIST_DE_ACEITACAO.md antes de entregar a instalação.\n\nOs dados e os arquivos ficam exclusivamente no Supabase desta empresa. Para suporte, peça primeiro o diagnóstico gerado em Configurações. A empresa só precisa conceder acesso temporário ao projeto quando a análise realmente exigir, podendo revogá-lo após o atendimento.\n`);
  const installationGuide = join(target, 'INSTALACAO_CLIENTE.md');
  writeFileSync(installationGuide, readFileSync(installationGuide, 'utf8').replace('002 a 012', '002 a 018'));
  mkdirSync(dirname(resolve(output)), { recursive: true });
  execFileSync('zip', ['-qr', resolve(output), 'orbis-gestao'], { cwd: staging });
  console.log(resolve(output));
} finally { rmSync(staging, { recursive: true, force: true }); }

# Orbis Gestão — instalação e suporte

## Responsabilidade da empresa compradora

- Manter a conta de hospedagem, o projeto Supabase e os pagamentos desses serviços.
- Guardar as credenciais do proprietário e manter um segundo administrador ativo.
- Fazer backups regulares em Configurações e manter os arquivos em local seguro.

## Instalação independente

1. Criar um projeto Supabase na conta da empresa.
2. Executar os arquivos da pasta `supabase` em ordem numérica.
3. Criar o usuário proprietário indicado no pacote do cliente.
4. Preencher `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` na hospedagem.
5. Configurar a URL publicada nas URLs permitidas do Supabase Authentication.
6. Publicar o sistema e executar o checklist de aceitação.

Nunca colocar a chave `service_role` no frontend ou compartilhar essa chave em chamados.

## Atendimento de suporte

1. O cliente abre o chamado com descrição, horário, usuário afetado e captura da tela.
2. A ER Creative consulta o menu Histórico antes de solicitar acesso técnico.
3. Pedir o arquivo “Relatório para suporte”, disponível em Configurações; ele não contém senhas nem cadastros.
4. Se necessário, o cliente concede acesso temporário ao Supabase e à hospedagem.
5. Antes da correção, baixar o backup dos dados e registrar a versão instalada.
6. Aplicar e testar a correção na instalação do cliente.
7. Registrar a solução no chamado e solicitar que o cliente revogue o acesso temporário.

## Limites do backup interno

O backup JSON contém dados estruturados, mas não contém senhas nem os arquivos das fotos.
Os arquivos devem ser preservados pelo backup da infraestrutura do cliente.

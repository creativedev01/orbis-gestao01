# Entrega comercial — Orbis Gestão 1.0.0

## O que o cliente recebe

- Código-fonte do sistema e instruções de instalação.
- Banco Supabase independente, criado na conta do cliente.
- Hospedagem independente, criada na conta do cliente.
- Perfis de proprietário, administrador e funcionário.
- Estoque, clientes, fornecedores, funcionários, ordens de serviço, faturamento e relatórios.
- Aplicativo instalável, trabalho offline em OS e sincronização ao retornar a conexão.
- Histórico de alterações, backup dos dados e diagnóstico para suporte.

## Antes de entregar

1. Executar `setup.sql` e as SQLs 002 a 018, em ordem.
2. Criar o proprietário e configurar as credenciais públicas do Supabase.
3. Publicar o sistema e configurar as URLs permitidas de autenticação.
4. Executar a Verificação da instalação em Configurações.
5. Cumprir todos os itens de `CHECKLIST_DE_ACEITACAO.md`.
6. Entregar ao cliente os acessos das contas, o endereço do sistema e uma cópia do pacote instalado.
7. Registrar por escrito a data, a versão 1.0.0 e o período de garantia combinado.

## Responsabilidades

O cliente deve guardar os acessos, manter pagamentos e limites da hospedagem e do Supabase e realizar backups. A ER Creative deve corrigir defeitos cobertos pelo acordo e combinar separadamente alterações de escopo, integrações ou novas funções.

## Validações externas obrigatórias

- O cliente deve testar câmera, arquivos e modo offline nos aparelhos que realmente utilizará.
- Um contador deve validar os relatórios auxiliares e os campos fiscais exigidos pelo ramo da empresa.
- Os relatórios do Orbis não substituem notas fiscais, declarações ou obrigações contábeis oficiais.

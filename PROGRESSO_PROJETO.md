# Orbis Gestão — andamento do projeto

Atualizado em 22/09/2026.

## Modelo de entrega

O produto funciona como plataforma por assinatura administrada pela ER Creative. Cada empresa possui
dados isolados, usuários próprios, plano, situação da assinatura e prazo de retenção. O proprietário
da ER Creative possui um painel separado para empresas, leads, chamados, tarefas, financeiro,
base de conhecimento e observações internas. O pacote independente permanece disponível apenas
como contingência técnica.

## Concluído e funcional

- Autenticação real com Supabase, sessão persistente, recuperação de senha e encerramento de sessão.
- Separação de usuários por empresa e permissões de proprietário, administrador e funcionário.
- Configurações reais da empresa e nome exibido no sistema.
- Convites de funcionários, criação de conta, alteração de permissão e bloqueio/reativação.
- Saudação automática de bom dia, boa tarde ou boa noite.
- Estoque real com categorias, produtos, estoque mínimo, custo, preço e localização.
- Entradas, saídas, devoluções, perdas, avarias e ajustes com histórico protegido.
- Proteção contra estoque negativo e restrição de funcionário para registrar somente saídas.
- Edição e exclusão segura de produtos, preservando produtos com histórico como inativos.
- Clientes e fornecedores reais, com cadastro, busca, edição, exclusão lógica e endereço completo.
- Consulta automática de CEP pelo ViaCEP.
- Janela de informações ao clicar em produtos, clientes, fornecedores e funcionários.
- Interface responsiva, incluindo rolagem dos formulários no computador e celular.
- Aplicativo instalável, cache das OS do funcionário e sincronização de aceite, início, conclusão,
  foto assinada e materiais quando a conexão retornar.
- Indicador global de conexão e pendências, diagnóstico do aparelho e relatório seguro para suporte.
- Histórico de alterações em estoque, OS, clientes, fornecedores, categorias, convites e funcionários.
- Publicação contínua no mesmo endereço.
- CRM exclusivo da ER Creative com empresas, leads, chamados, tarefas e base de conhecimento.
- Financeiro da plataforma com mensalidades, pagamentos, vencimentos e exportação CSV.
- Empresas desativadas preservadas e recuperáveis, sem apagar dados operacionais.
- Filtros e exportações nos cadastros do CRM e painel com indicadores reais.

Atualizações recentes: ordens de serviço e faturamento reais, comprovante assinado em armazenamento
privado, relatórios mensais e arquivos auxiliares para o contador, logomarca por empresa,
link de login por empresa e renovação automática da sessão. O acesso ao site está público;
os dados exigem autenticação no Supabase.

## Validações finais externas

1. Testar em aparelhos reais o modo offline já implementado: aplicativo e OS atribuídas em cache,
   aceite, início, foto assinada, materiais utilizados e sincronização ao voltar a rede.
   Revisar conflitos e falhas encontrados nesses testes.
2. Conferir com o contador os dados e formatos fiscais exigidos pelo ramo do cliente.
3. Testar permissões, câmera, arquivos, sessão, sincronização e recuperação de dados em contas
   e aparelhos reais, incluindo falta e retorno da internet.
4. Completar o procedimento de instalação, atualização e suporte em ambiente separado de um cliente piloto.
5. Validar o fluxo comercial e de suporte com as primeiras empresas reais antes de automatizar cobranças.

## Avaliação do cronograma

O núcleo online de autenticação, empresas, funcionários, estoque, clientes, fornecedores, OS e
relatórios usa dados reais. O modo offline está implementado para as OS atribuídas ao funcionário,
mas ainda deve ser validado em aparelhos e conexões reais antes da entrega comercial.

Versão comercial preparada: **1.0.0**, com banco de dados na versão **18**. O escopo combinado está
concluído; permanecem as validações externas acima, configuração de cobrança automática quando houver
provedor escolhido e eventuais correções encontradas durante o teste com clientes reais.

## Banco de dados

Os scripts ficam na pasta `supabase` e devem ser executados em ordem numérica em uma instalação nova.

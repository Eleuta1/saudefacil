# Saúde Fácil — projeto integrado

Projeto acadêmico de agendamento de atendimentos em unidades de saúde, com área do paciente e painel CRM da equipe.

## Como executar

1. Extraia a pasta `saudefacil` para o diretório do servidor web.
2. Inicie um servidor local (por exemplo, Live Server no VS Code, Apache ou outro servidor HTTP). Se tiver Python instalado, execute `python -m http.server 8000` dentro da pasta `saudefacil`.
3. Abra `http://localhost:8000` para acessar o site do paciente.
4. Abra `http://localhost:8000/painel.html` para acessar o CRM da equipe.

A geolocalização e a consulta de unidades pelo Google Maps dependem de uma chave válida em `js/config.js`, com as APIs necessárias habilitadas. Sem a chave, o site mantém as unidades fictícias de demonstração.

## Contas de demonstração

**Paciente** — acesso em `login.html`

- E-mail: `paciente@sf.com`
- Senha: `paciente123`

**Equipe** — acesso em `painel.html`

| Perfil | E-mail | Senha | Escopo |
|---|---|---|---|
| Administrador | `admin@sf.com` | `admin123` | Todas as unidades e módulos |
| Gestor | `gestor@sf.com` | `gestor123` | UBS Vila Nova |
| Atendente | `atendente@sf.com` | `atend123` | UBS Vila Nova |

As contas e agendamentos fictícios são criados apenas na primeira execução, quando ainda não existem registros no armazenamento local do navegador.

## Integração realizada

- O CRM utiliza os mesmos registros de `sf_usuarios` e `sf_agendamentos` usados pelo site do paciente.
- Novos agendamentos feitos pelo paciente aparecem no quadro de agendamentos da equipe.
- A equipe pode confirmar, concluir, marcar falta ou cancelar agendamentos conforme o fluxo de status.
- O paciente acompanha o status e pode cancelar agendamentos que ainda estejam agendados ou confirmados.
- O painel inclui consulta de pacientes, gerenciamento de usuários da equipe, permissões por perfil e auditoria.
- Gestores e atendentes ficam limitados à unidade atribuída; o administrador visualiza todas as unidades.
- O projeto preserva a busca de unidades próximas com Google Maps e adiciona validação para impedir dois agendamentos no mesmo horário e unidade.

## Armazenamento e segurança

Esta versão é uma demonstração front-end: autenticação, permissões, auditoria e registros ficam no `localStorage`. Isso não oferece segurança real contra manipulação pelo navegador e não deve ser utilizado com dados pessoais ou de saúde reais. Para uso real, será necessário implementar backend, banco de dados, autenticação e autorização no servidor, trilha de auditoria protegida e controles de privacidade/LGPD.

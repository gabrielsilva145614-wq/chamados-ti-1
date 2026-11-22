# Chamados TI | Firebase Auth + RBAC

**Aluno:** Gabriel Nery da Silva

**Aplicação no Render:** https://chamados-ti-1-1.onrender.com

**Repositório de entrega:** `https://github.com/gabrielsilva145614-wq/chamados-ti-1`

**Credenciais de teste (crie-as no Firebase antes de entregar):**

| Papel | E-mail de teste | Senha |
| --- | --- | --- |
| `user` | `nery@gmail.com` | Fornecida ao professor em particular |
| `tecnico` | `tecnico@gmail.com` | Fornecida ao professor em particular |
| `admin` | `gabriel1@gmail.com` | Fornecida ao professor em particular |

> Nunca inclua senhas reais nem o JSON da chave de serviço no GitHub. Complete os dados acima ao criar as contas e finalizar o deploy.

## Sobre a adaptação do projeto original

Projeto adaptado a partir do repositório [pro-jacques/chamados-ti](https://github.com/profjacques/chamados-ti) para a atividade de Firebase, controle de acesso (RBAC) e deploy. **Este projeto é Node.js + Express + EJS.** Por isso o Render deve usar um **Web Service**, não um Static Site.

A interface original do HelpDesk foi preservada como base visual (CSS e layout). A persistência da nova versão passou do SQLite para o **Cloud Firestore**, pois o sistema executa em um servidor do Render com armazenamento local não persistente. Os chamados do SQLite antigo não são importados automaticamente. Toda a nova informação é salva no Firestore.

## Funcionalidades

- Cadastro por nome, e-mail e senha; login com senha; login Google (Firebase Authentication).
- Primeiro login cria `usuarios/{uid}` com `uid`, `nome`, `email`, `perfil: "user"`.
- `user`: cria chamados e visualiza apenas seus próprios chamados; pode comentar neles.
- `tecnico`: visualiza a fila, assume chamados, registra parecer e define status.
- `admin`: acesso total aos chamados, inclusive edição/exclusão, e gestão de perfis.
- `onAuthStateChanged` no navegador e autenticação de **cada requisição no servidor** com `verifySessionCookie` (Firebase Admin SDK).
- Rotas POST protegidas por sessão, checagem de origem e token CSRF nas ações autenticadas.
- Perfil sempre lido novamente do Firestore no servidor, sem confiar no campo enviado pela interface.
- Backend administra Firestore; clientes não têm acesso direto às coleções (ver `firestore.rules`).

### Modelo dos dados

`usuarios/{firebaseAuthUid}`:

```json
{
  "uid": "uid-do-firebase-authentication",
  "nome": "Maria Souza",
  "email": "maria@exemplo.com",
  "perfil": "user"
}
```

`chamados/{idAutoGerado}`:

```json
{
  "titulo": "Computador não liga",
  "descricao": "O computador não inicializa após o fim de semana.",
  "autorUid": "uid-do-firebase-authentication",
  "autorNome": "Maria Souza",
  "autorEmail": "maria@exemplo.com",
  "status": "Aberto",
  "tecnicoResponsavel": null,
  "tecnicoUid": null,
  "parecerTecnico": "",
  "categoria": "Hardware",
  "prioridade": "Média",
  "setor": "Financeiro",
  "criadoEm": "2026-11-19T00:00:00.000Z",
  "atualizadoEm": "2026-11-19T00:00:00.000Z",
  "historico": []
}
```

Status válidos: **Aberto, Em Atendimento, Resolvido**.

## 1. Firebase Console

1. Acesse https://console.firebase.google.com, crie um projeto e adicione um **aplicativo Web** (`</>`).
2. Em **Authentication > Sign-in method**, habilite **E-mail/Senha** (primeira opção) e **Google**. Escolha o e-mail de suporte solicitado.
3. Em **Firestore Database**, crie o banco. Use a localização adequada. Publique as regras de `firestore.rules` na aba **Rules**. Não mantenha as regras abertas do modo teste em produção.
4. No painel do aplicativo Web, copie os valores do `firebaseConfig` para as variáveis `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID` e, opcionalmente, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`.
5. Em **Project settings > Service accounts**, gere uma **chave privada** para a conta de serviço. Guarde o JSON completo, **sem enviá-lo ao repositório**. Configure a variável privada `FIREBASE_SERVICE_ACCOUNT_JSON` no servidor.
6. Em **Authentication > Settings > Authorized domains**, adicione `localhost` se não estiver listado e, depois, **apenas o host** gerado pelo Render: `seu-servico.onrender.com`, sem `https://` e sem `/`.

**Importante:** A `apiKey` pública do aplicativo Web não é a chave secreta do servidor. O JSON da conta de serviço é **privado**, usado somente pelo SDK Admin no Node.js. Nunca coloque este JSON em `/public`, em commits ou em mensagens públicas.

### Perfis de teste

1. Crie três contas na tela de cadastro (todas entram automaticamente como `user`).
2. No **Firestore > Data > usuarios**, encontre o documento da conta que será admin (o ID é o `uid` da conta) e altere `perfil` para `admin`.
3. Faça novo login ou atualize a página com a conta admin. A aba **Gestão de usuários** aparecerá. A partir dela, altere uma das outras contas para `tecnico` e mantenha outra como `user`.
4. Use contas distintas para testar cada perfil.

Os perfis não devem ser alterados diretamente em HTML, requisições ou no Firebase Authentication. A fonte confiável é `usuarios/{uid}` no Firestore.

## 2. Instalar e executar localmente

Requisitos: Node.js 20 ou 22, npm e seu projeto Firebase configurado.

```bash
npm install
```

Copie `.env.example` para `.env` e **substitua os exemplos** por valores reais. Use `CSRF_SECRET` com uma string aleatória longa. Em Node 20+, o comando de desenvolvimento lê o `.env`:

```bash
npm run dev
```

Acesse **http://localhost:3000/login**. O comando `npm start` lê as variáveis do ambiente do processo (ideal para Render). Uma alternativa para desenvolvimento é `GOOGLE_APPLICATION_CREDENTIALS=/caminho/para/chave.json` ao invés do JSON em variável.

Se ainda não estiver configurado, o servidor mostra uma mensagem clara sobre as variáveis faltantes e não inicia. Isso é proposital para não apresentar um sistema que parece autenticado sem validar credenciais.

## 3. Publicar no GitHub

1. Faça **Fork** do repositório base na sua conta GitHub.
2. Copie os arquivos desta versão para a pasta do seu fork (substituindo a versão antiga), respeitando a estrutura.
3. Execute no terminal dentro da pasta:

```bash
git add .
git commit -m "feat: firebase auth, firestore, RBAC e deploy Render"
git push origin main
```

Confira antes do commit se o `.env`, o arquivo da conta de serviço e as senhas não estão no `git status`.

## 4. Deploy no Render (Web Service)

1. Abra https://dashboard.render.com > **New + > Web Service**.
2. Conecte o seu **fork** com estas alterações.
3. Informe:

   | Campo | Valor |
   | --- | --- |
   | Language / Runtime | `Node` |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Health Check Path | `/health` |

4. Em **Environment**, configure `NODE_ENV=production` e todos os valores `FIREBASE_*` necessários. Para `FIREBASE_SERVICE_ACCOUNT_JSON`, cole o conteúdo inteiro do JSON em **uma variável de ambiente secreta**. Configure `CSRF_SECRET` com valor aleatório; o `render.yaml` também permite criar uma chave aleatória automaticamente.
5. Publique e abra `https://SEU-SERVICO.onrender.com/login`.
6. Adicione `SEU-SERVICO.onrender.com` na lista de domínios autorizados do Firebase Authentication. Para o login com Google, aguarde a atualização da configuração, recarregue a página e teste novamente.
7. Atualize **este README** com o link real do Render e as contas de avaliação. Envie ao professor **somente o link do fork no GitHub**.

Se optar pelo Blueprint (`render.yaml`), confira se o nome do serviço e as variáveis de ambiente estão corretos. Nunca insira a chave de serviço no `render.yaml`.

## 5. Checklist da atividade

- [ ] Login e cadastro por e-mail/senha.
- [ ] Login por Google.
- [ ] Registro automático em `usuarios/{uid}` como `user`.
- [ ] `user` só enxerga chamados onde `autorUid` é igual ao próprio `uid`.
- [ ] Novo chamado grava nome, e-mail, uid, status Aberto e técnico nulo.
- [ ] `tecnico` assume chamado, altera status e adiciona parecer técnico.
- [ ] `admin` edita/exclui e promove usuários pelo painel.
- [ ] Um `user` não consegue acessar `/usuarios` nem alterar status por POST manual.
- [ ] Render e Google login funcionando no domínio real.
- [ ] README com link e credenciais de avaliação.

## 6. Segurança e testes

Execute os testes unitários de RBAC e validação de chamados:

```bash
npm test
```

As regras recomendadas do Firestore estão em `firestore.rules`. Elas **negam todo acesso de SDK cliente** porque toda leitura/escrita ocorre pelo Express com o Admin SDK e validação de perfil. As regras do Firestore não afetam o Admin SDK, então o segredo da conta de serviço é crítico.

Os testes unitários não substituem testes reais do Firebase e do Render. Para confirmar integração com Auth, Firestore, Google e deploy, é obrigatório criar as credenciais e executar a aplicação no seu projeto Firebase.

## Estrutura principal

```text
app.js                  Express / EJS / inicialização
config/firebase.js      Firebase Admin + config pública da Web
middlewares/auth.js     sessão, autorização, CSRF e perfil inicial
services/policies.js    perfis e permissões
services/firestore.js   busca e validação de chamados
routes/index.js         rotas e operações de banco
views/login.ejs         entrar / criar conta / Google
views/usuarios.ejs      painel exclusivo admin
views/tickets/           abrir, listar, atender e editar chamados
public/js/login.js      Firebase Auth no navegador
public/js/auth-watch.js onAuthStateChanged nas páginas autenticadas
firestore.rules         bloqueio de acesso direto ao banco via SDK Web
render.yaml             configuração opcional de implantação
```

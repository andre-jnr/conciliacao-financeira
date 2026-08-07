# Conciliação Financeira

Aplicação web estática para conciliar as vendas registradas no sistema interno
com os recebimentos informados nos relatórios da Cielo. Roda inteiramente no
navegador (nenhum arquivo é enviado para servidor algum) e pode ser hospedada
no GitHub Pages sem nenhum passo de build.

## Como usar

1. Abra a aplicação (localmente ou publicada no GitHub Pages).
2. Envie o **Arquivo do Sistema** (relatório de vendas exportado pelo sistema
   interno) e o **Arquivo da Cielo** (relatório detalhado de vendas Cielo).
3. Clique em **Conciliar Arquivos**.
4. Revise os cards de resumo e a tabela de resultados. Use a busca e os
   filtros de status (Todos / Consta / Não Consta) para investigar.
5. Clique em **Exportar Resultado** para baixar um Excel com o detalhamento
   completo, incluindo o motivo de cada divergência.

## Regra de conciliação

Não existe identificador único entre as duas planilhas, então o cruzamento é
feito por dois critérios simultâneos:

1. **Bandeira**: primeira palavra do campo `Cartão` do sistema comparada com
   o campo `Bandeira` da Cielo (normalizada: maiúsculas, sem acento, sem
   espaços extras). Variações de nome conhecidas — como `Amex` ↔
   `American Express` e `Maestro` ↔ `Mastercard` — são tratadas por um mapa de
   apelidos em [`js/normalize.js`](js/normalize.js) (`BRAND_ALIASES`).
2. **Valor**: `Valor da Venda` do sistema comparado com `Valor bruto` da
   Cielo, com tolerância de meio centavo e suporte a diferentes formatos de
   moeda (`R$ 1.234,56`, `1234.56`, etc.).

Uma linha do sistema só é marcada como **Consta** quando as duas condições
batem com uma linha da Cielo ainda não utilizada por outra linha do sistema
(casamento 1-para-1). Quando não bate, o motivo é preenchido automaticamente:

- **Bandeira diferente** — existe uma venda Cielo com o mesmo valor, mas de
  outra bandeira.
- **Valor diferente** — existe uma venda Cielo da mesma bandeira, mas com
  valor diferente.
- **Registro duplicado** — o sistema tem mais lançamentos com aquela
  combinação bandeira+valor do que a Cielo.
- **Registro não encontrado na Cielo** — nenhuma correspondência foi
  encontrada.

O motor de conciliação está isolado em
[`js/reconciliation.js`](js/reconciliation.js) e a extração de bandeira/valor
de cada relatório é feita separadamente, o que facilita plugar um novo
adquirente (Rede, Stone, Getnet etc.) no futuro: basta um novo parser em
[`js/parsers.js`](js/parsers.js) e um extractor equivalente para o motor.

## Estrutura do projeto

```
index.html            Página única da aplicação
css/styles.css         Estilos (paleta neutra, cards, tabela, responsividade)
js/normalize.js        Normalização de texto, bandeira, moeda e data
js/parsers.js           Leitura das planilhas .xlsx (Sistema e Cielo)
js/reconciliation.js    Motor de conciliação (casamento bandeira + valor)
js/export.js            Geração do Excel de resultado
js/ui.js                 Manipulação de DOM / renderização
js/main.js               Orquestração (liga UI às regras de negócio)
vendor/xlsx.full.min.js SheetJS, vendorizado localmente (sem dependência de CDN)
```

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie estes arquivos para a branch
   `main`:
   ```bash
   git init
   git add .
   git commit -m "Conciliação financeira: versão inicial"
   git branch -M main
   git remote add origin <url-do-seu-repositorio>
   git push -u origin main
   ```
2. No GitHub, vá em **Settings → Pages**.
3. Em **Build and deployment**, selecione **Deploy from a branch**, escolha a
   branch `main` e a pasta `/ (root)`.
4. Salve. Em alguns minutos a aplicação estará disponível em
   `https://<seu-usuario>.github.io/<nome-do-repositorio>/`.

Nenhum passo de build é necessário — é HTML/CSS/JS puro, com a biblioteca de
leitura de Excel já vendorizada em `vendor/`.

## Rodar localmente

Como a aplicação usa módulos ES (`<script type="module">`), é preciso servir
os arquivos por HTTP (abrir o `index.html` direto com `file://` não
funciona). Qualquer servidor estático resolve:

```bash
python -m http.server 8080
# ou
npx serve .
```

Depois acesse `http://localhost:8080`.

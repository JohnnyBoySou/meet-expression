# Build do Módulo TypeScript

## Como Fazer o Build

```bash
# Instalar dependências (se ainda não instalou)
bun install

# Fazer o build
bun run build
```

## O que é Gerado

O build gera os seguintes arquivos na pasta `dist/`:

- `index.js` - Bundle ESM (ES Modules) para uso em projetos modernos
- `index.cjs` - Bundle CommonJS para compatibilidade
- `index.d.ts` - Definições de tipos TypeScript
- `index.d.cts` - Definições de tipos para CommonJS
- `*.map` - Source maps para debugging

## Estrutura do Package.json

O `package.json` está configurado com:

```json
{
  "main": "./dist/index.cjs",        // CommonJS (Node.js antigo)
  "module": "./dist/index.js",        // ESM (moderno)
  "types": "./dist/index.d.ts",      // Tipos TypeScript
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",   // Tipos primeiro
      "import": "./dist/index.js",    // ESM
      "require": "./dist/index.cjs"   // CommonJS
    }
  }
}
```

## Como Usar no Frontend

### Em um Projeto React/Vite

```bash
# No seu projeto React
npm install /caminho/para/typescript-module
# ou
npm link @meet-expression/core
```

```typescript
// No seu código React
import { createFaceExpressionEngine } from '@meet-expression/core';
import type { FrameResult } from '@meet-expression/core';
```

### Em um Projeto com Bundler (Vite, Webpack, etc)

O módulo já está bundlado, então você pode importar diretamente:

```typescript
import { createFaceExpressionEngine } from '@meet-expression/core';
```

## Dependências Externas

As seguintes dependências são marcadas como `external` e **não** são incluídas no bundle:

- `@mediapipe/tasks-vision` - Deve ser instalado no projeto que usa o módulo
- `@techstark/opencv-js` - Deve ser instalado no projeto que usa o módulo
- `react` / `react-dom` - Se você usar React hooks

**Importante**: Certifique-se de instalar essas dependências no seu projeto frontend:

```bash
npm install @mediapipe/tasks-vision @techstark/opencv-js
```

## Verificação do Build

Após o build, você pode verificar se está tudo correto:

```bash
# Verificar tamanho dos arquivos
ls -lh dist/

# Verificar se os tipos estão corretos
bun run typecheck
```

## Troubleshooting

### Erro: "Cannot find module '@meet-expression/core'"

- Certifique-se de que o módulo foi instalado/linkado corretamente
- Verifique se o `package.json` tem os campos `main`, `module` e `types` corretos

### Erro: "Module not found" para path aliases

- Os path aliases (`@core`, `@analyzers`, etc) são resolvidos durante o build
- Se você ver erros sobre esses paths, verifique o `tsup.config.ts`

### Erro: "Cannot find module '@mediapipe/tasks-vision'"

- Instale as dependências externas no seu projeto:
  ```bash
  npm install @mediapipe/tasks-vision @techstark/opencv-js
  ```

## Scripts Disponíveis

- `bun run build` - Faz o build do módulo
- `bun run typecheck` - Verifica tipos sem gerar arquivos
- `bun run lint` - Executa o linter

# Instalação Local do Módulo

Guia rápido para instalar e usar o módulo `@meet-expression/core` localmente no seu projeto React.

## Método Rápido: npm link (Recomendado)

### 1. Buildar o Módulo

```bash
cd /media/sousa/NVME/Projetos/300f/meet/meet-expression/typescript
bun run build
```

### 2. Criar o Link no Módulo

```bash
# Ainda no diretório do módulo
npm link
```

### 3. Linkar no Projeto React

```bash
# No diretório do seu projeto React
cd /caminho/para/seu/projeto-react
npm link @meet-expression/core
```

### 4. Instalar Dependências Peer

```bash
# No projeto React
npm install @mediapipe/tasks-vision
```

### 5. Pronto! Use no Código

```typescript
import { createFaceExpressionEngine, defaultFACSConfig } from '@meet-expression/core';
```

## Método Alternativo: Instalação via Caminho

### 1. Buildar o Módulo

```bash
cd /media/sousa/NVME/Projetos/300f/meet/meet-expression/typescript
bun run build
```

### 2. Adicionar no package.json do React

```json
{
  "dependencies": {
    "@meet-expression/core": "file:../caminho/relativo/para/typescript"
  }
}
```

**Exemplo:** Se seu projeto React está em `/projetos/react-app` e o módulo em `/projetos/meet-expression/typescript`:

```json
{
  "dependencies": {
    "@meet-expression/core": "file:../../meet-expression/typescript"
  }
}
```

### 3. Instalar

```bash
npm install
```

### 4. Instalar Dependências Peer

```bash
npm install @mediapipe/tasks-vision
```

## Verificação Rápida

Crie um arquivo de teste no seu React:

```typescript
// src/test-module.ts
import { defaultFACSConfig } from '@meet-expression/core';
console.log('FACS Config carregado:', defaultFACSConfig);
```

Se não der erro, está funcionando! ✅

## ⚠️ IMPORTANTE: Re-linkar NÃO é Necessário!

**Você só precisa linkar UMA VEZ!** O `npm link` cria um symlink permanente que permanece ativo.

### Workflow Correto:

1. **Setup inicial (uma vez só)**:
   ```bash
   # No módulo
   cd /media/sousa/NVME/Projetos/300f/meet/meet-expression/typescript
   bun run build
   npm link
   
   # No React
   cd /caminho/para/seu/projeto-react
   npm link @meet-expression/core
   ```

2. **Durante desenvolvimento (repetir quando necessário)**:
   ```bash
   # Apenas buildar - NÃO precisa re-linkar!
   cd /media/sousa/NVME/Projetos/300f/meet/meet-expression/typescript
   bun run build
   ```

3. **O React detecta automaticamente** as mudanças no `dist/` (se o hot reload estiver configurado)

### Build Watch (Recomendado para Desenvolvimento)

Para buildar automaticamente quando houver mudanças, use o watch mode:

```bash
# Terminal 1: Watch do módulo (deixe rodando)
cd /media/sousa/NVME/Projetos/300f/meet/meet-expression/typescript
bun run build:watch

# Terminal 2: Servidor React (deixe rodando)
cd /caminho/para/seu/projeto-react
npm run dev
```

Agora qualquer mudança no módulo será buildada automaticamente e o React detectará!

### Se as mudanças não aparecerem:

1. Reinicie o servidor de desenvolvimento do React
2. Limpe o cache: 
   - Vite: `rm -rf node_modules/.cache`
   - Next.js: `rm -rf .next`
3. Verifique se o build foi executado: `ls dist/` no módulo

## Troubleshooting

### "Cannot find module '@meet-expression/core'"

1. Verifique se buildou: `bun run build` no módulo
2. Verifique se linkou: `npm link` no módulo e `npm link @meet-expression/core` no React
3. Reinicie o servidor de desenvolvimento

### Hot Reload não funciona

Configure no `vite.config.ts` (Vite):

```typescript
export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
});
```

Ou no `webpack.config.js` (Webpack/CRA):

```javascript
module.exports = {
  resolve: {
    symlinks: false,
  },
};
```

## Scripts Úteis

### No package.json do Módulo

```json
{
  "scripts": {
    "build": "tsup",
    "build:watch": "tsup --watch"
  }
}
```

### No package.json do React (opcional)

```json
{
  "scripts": {
    "build:module": "cd ../meet-expression/typescript && bun run build",
    "dev": "npm run build:module && vite"
  }
}
```

## Exemplo Completo de Uso

```typescript
import { useEffect, useRef } from 'react';
import { createFaceExpressionEngine, defaultFACSConfig } from '@meet-expression/core';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<ReturnType<typeof createFaceExpressionEngine> | null>(null);

  useEffect(() => {
    async function init() {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11/wasm'
      );

      const faceLandmarker = await FaceLandmarker.createFromOptions(
        filesetResolver,
        {
          baseOptions: {
            modelAssetPath: '/models/face_landmarker.task',
          },
          outputFaceBlendshapes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        }
      );

      const engine = createFaceExpressionEngine(
        { facsConfig: defaultFACSConfig },
        faceLandmarker
      );

      engineRef.current = engine;

      engine.onResult((result) => {
        console.log('AUs:', result.aus);
      });
    }

    init();
  }, []);

  return <video ref={videoRef} autoPlay playsInline muted />;
}
```

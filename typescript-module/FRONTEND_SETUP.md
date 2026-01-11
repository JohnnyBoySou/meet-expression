# Configuração no Frontend

## Dependências Externas

O módulo `@meet-expression/core` requer que você instale e configure as seguintes dependências no seu projeto frontend:

### 1. Instalar Dependências

```bash
npm install @mediapipe/tasks-vision @techstark/opencv-js
# ou
yarn add @mediapipe/tasks-vision @techstark/opencv-js
# ou
bun add @mediapipe/tasks-vision @techstark/opencv-js
```

### 2. Baixar Modelo MediaPipe

Baixe o arquivo `face_landmarker.task` de:
- https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task

Coloque em `public/models/face_landmarker.task` no seu projeto.

## Por Que São Externas?

### MediaPipe (`@mediapipe/tasks-vision`)
- **Razão**: Precisa ser inicializado com configuração específica do projeto
- **Configuração necessária**:
  - Caminho do modelo (`face_landmarker.task`)
  - Configuração de WebAssembly (WASM files)
  - Modo de execução (IMAGE ou VIDEO)
  - É passado como **parâmetro** para o engine

### OpenCV (`@techstark/opencv-js`)
- **Razão**: Precisa de configuração para trabalhar com vídeo local/webcam
- **Configuração necessária**:
  - Carregamento assíncrono de WebAssembly
  - Acesso a elementos de vídeo do DOM
  - Processamento de frames do navegador

## Configuração por Framework

### React / Vite

```typescript
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    include: ['@mediapipe/tasks-vision', '@techstark/opencv-js'],
  },
  // Se necessário, copiar arquivos WASM
  publicDir: 'public',
});
```

### Configuração de WebAssembly

Ambas as bibliotecas usam WebAssembly. Certifique-se de que seu bundler está configurado para:

1. **Copiar arquivos `.wasm`** para a pasta `public` ou `dist`
2. **Configurar MIME type** correto para `.wasm`
3. **Permitir carregamento dinâmico** de módulos WASM

## Exemplo Completo de Setup

```typescript
// src/utils/faceExpressionSetup.ts
import { createFaceExpressionEngine } from '@meet-expression/core';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import facsConfig from '../config/FACS_IA_decision_ready_v1.json';

export async function setupFaceExpressionEngine() {
  // 1. Configurar MediaPipe com WASM
  const filesetResolver = await FilesetResolver.forVisionTasks(
    // CDN ou caminho local para arquivos WASM
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11/wasm'
    // ou para local: '/wasm'
  );

  // 2. Inicializar FaceLandmarker com modelo local
  const faceLandmarker = await FaceLandmarker.createFromOptions(
    filesetResolver,
    {
      baseOptions: {
        modelAssetPath: '/models/face_landmarker.task', // Caminho público
      },
      outputFaceBlendshapes: true,
      runningMode: 'VIDEO', // Para processamento contínuo de vídeo
      numFaces: 1,
    }
  );

  // 3. Criar engine (OpenCV será carregado automaticamente quando necessário)
  const engine = createFaceExpressionEngine(
    {
      facsConfig,
      windowSeconds: 4.0,
      fps: 30,
    },
    faceLandmarker // MediaPipe configurado e passado aqui
  );

  return engine;
}
```

## Estrutura de Arquivos no Frontend

```
seu-projeto-frontend/
├── public/
│   ├── models/
│   │   └── face_landmarker.task    # Modelo MediaPipe
│   └── wasm/                        # Arquivos WASM (se necessário)
│       └── (arquivos .wasm do MediaPipe)
├── src/
│   ├── config/
│   │   └── FACS_IA_decision_ready_v1.json
│   └── utils/
│       └── faceExpressionSetup.ts
└── package.json
```

## Troubleshooting

### Erro: "Cannot find module '@mediapipe/tasks-vision'"
- Instale a dependência: `npm install @mediapipe/tasks-vision`
- Verifique se está no `package.json`

### Erro: "Cannot find module '@techstark/opencv-js'"
- Instale a dependência: `npm install @techstark/opencv-js`
- Verifique se está no `package.json`

### Erro: "Failed to load WASM file"
- Certifique-se de que os arquivos `.wasm` estão acessíveis
- Configure o caminho correto no `FilesetResolver`
- Verifique as configurações de CORS se estiver usando CDN

### Erro: "Model file not found"
- Verifique se `face_landmarker.task` está em `public/models/`
- Verifique o caminho no `modelAssetPath`

### OpenCV não carrega
- O OpenCV é carregado automaticamente quando o optical flow é usado
- Verifique o console do navegador para erros de carregamento
- Certifique-se de que `@techstark/opencv-js` está instalado

## Vantagens de Manter Externas

1. ✅ **Flexibilidade**: Você controla a versão e configuração
2. ✅ **Tamanho**: Bundle do módulo permanece pequeno (~31 KB)
3. ✅ **Performance**: Carregamento sob demanda
4. ✅ **Configuração**: Cada projeto pode configurar conforme necessário
5. ✅ **Atualizações**: Pode atualizar MediaPipe/OpenCV independentemente

# Motoboy 3D

`www/moto3d.bin` (malha + cores) e `www/moto3d.jpg` (textura) foram gerados a partir de
`white_mesh.glb` e da ilustração `modelo.jpg` (moletom trocado para azul-marinho).

- `rast.py`: rasterizador simples usado para saber o que aparece de frente.
- `bake.py`: projeta a ilustração na frente do modelo e pinta costas/laterais com cores limpas.

O app desenha o modelo com WebGL puro (`www/moto3d.js`), sem bibliotecas, e funciona offline.
Se o celular não tiver WebGL, aparece o boneco 2D.

## Esqueleto
`rig.py` divide a malha em 16 ossos (quadril, peito, cabeça, braço/antebraço/mão de cada lado,
dedo esticado, outros dedos e polegar da mão levantada, coxa e canela de cada lado), suaviza as emendas e grava os pesos no `moto3d.bin`.
As poses de cada humor e reação ficam em `www/index.html` (`moodBones` e `eventBones`).

O braço do lado da bag é colado no tronco na malha original: mantenha as rotações de `armL` pequenas (até ~0,35 rad).

# Motoboy 3D (Blender 3.6)

Fonte: `Motoboy_Caixa_do_Corre_v3.blend` (na pasta Motoboy_Caixa_do_Corre_3D do PC).

- `anim_v3.py` corrige os grupos de pesos sem lado (mangas, calça, tênis) e cria as animações
  MB_Parado, MB_Tchau, MB_Feliz, MB_Triste, MB_Assustado (loops) e MB_Pulo, MB_Comendo,
  MB_Gasolina, MB_Manutencao, MB_Nota (uma vez).
- `export_v3.py` (na pasta do Blender) gera `motoboy_app.glb` leve, copiado para `www/boneco/`.
- No app, `www/boneco/moto3d.js` toca as animações com three.js (em `www/lib`) e transição suave.
  Sem WebGL, o app usa o boneco 2D (`sprite.js`).

# Motoboy 2D (animação limitada, estilo anime)

O app usa `www/boneco/sprite.js` + `www/boneco/pose_*.webp`: poses-chave desenhadas inteiras
(parado, tchau A/B, comemorando A/B, triste, apavorado A/B, agachado, comendo, segurando,
consertando, limpando a testa, esticando o braço). O animador troca de pose com um "pop" de
amassar/esticar e deforma o corpo inteiro (respirar, balançar, quicar), sem girar peças soltas.

## Gerar poses novas
1. `cut.py` recorta `referencia_T.jpg` nas peças de `pecas/`.
2. `puppet.js` monta as peças num esqueleto 2D.
3. Abra `gerar_poses.html` por um servidor local (pasta `tools/2d`), ajuste a lista `POSES`
   e salve cada canvas como PNG; depois converta para `www/boneco/pose_<nome>.webp` (400x480)
   e atualize os pontos de referência (cabeça e mãos) no topo de `sprite.js`.

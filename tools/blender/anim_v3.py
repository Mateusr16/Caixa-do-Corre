# Caixa do Corre - Motoboy V3: corrige pesos do V2 e cria animacoes fluidas.
# Rodar no Blender 3.6 com o Motoboy_Caixa_do_Corre_v2.blend aberto.
import bpy, math, os, json
from mathutils import Vector, Quaternion

D = os.path.dirname(bpy.data.filepath)
LOG = open(os.path.join(D, "log_v3.txt"), "w", encoding="utf-8")
def log(*a):
    LOG.write(" ".join(str(x) for x in a) + "\n"); LOG.flush()

ARM = bpy.data.objects["Esqueleto_Motoboy"]
BN = {b.name for b in ARM.data.bones}

# ---------------------------------------------------------------- 1) corrige grupos sem lado
fixed = 0
for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    side = ".L" if o.name.endswith(".L") else ".R" if o.name.endswith(".R") else None
    for g in o.vertex_groups:
        if g.name not in BN and side and (g.name + side) in BN:
            g.name = g.name + side; fixed += 1
log("grupos corrigidos", fixed)

# ---------------------------------------------------------------- 2) poses
for a in list(bpy.data.actions):
    if a.name.startswith("MB_"):
        bpy.data.actions.remove(a)
ARM.animation_data_create()
ARM.animation_data.action = None
for pb in ARM.pose.bones:
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)

AX = {"X": Vector((1, 0, 0)), "Y": Vector((0, 1, 0)), "Z": Vector((0, 0, 1))}
def qrest(pb, rots):
    """rotacoes em eixos do MUNDO (pose de repouso), convertidas pro espaco do osso"""
    inv = pb.bone.matrix_local.to_3x3().inverted()
    q = Quaternion()
    for ax, deg in rots:
        q = Quaternion((inv @ AX[ax]).normalized(), math.radians(deg)) @ q
    return q
def vrest(pb, v):
    return pb.bone.matrix_local.to_3x3().inverted() @ Vector(v)

FINGERS = ["index", "middle", "ring", "pinky"]
def side_sign(s): return 1 if s == "L" else -1

def base_pose():
    """bracos relaxados ao lado do corpo, maos semi-fechadas"""
    p = {}
    for s in ("L", "R"):
        k = side_sign(s)
        p["clavicle." + s] = [("Y", 8 * k)]
        p["upper_arm." + s] = [("Y", 68 * k), ("Z", 6 * k)]
        p["forearm." + s] = [("Z", -14 * k)]
        p["hand." + s] = [("X", 0)]
        for f in FINGERS:
            for i in (1, 2, 3):
                p["%s.%02d.%s" % (f, i, s)] = [("Y", (22 if i == 1 else 28) * k)]
        p["thumb.01." + s] = [("Z", 10 * k)]
        p["thumb.02." + s] = [("Y", 10 * k)]
    return p

def merge(*ds):
    out = {}
    for d in ds:
        for k, v in d.items():
            if k.startswith("_"):
                out[k] = v
            else:
                out[k] = out.get(k, []) + v
    return out

def fist(s, amt=1.0):
    k = side_sign(s); d = {}
    for f in FINGERS:
        for i in (1, 2, 3):
            d["%s.%02d.%s" % (f, i, s)] = [("Y", (60 if i == 1 else 70) * k * amt)]
    d["thumb.02." + s] = [("Y", 25 * k * amt)]; d["thumb.03." + s] = [("Y", 30 * k * amt)]
    return d
def open_hand(s, amt=1.0):
    k = side_sign(s); d = {}
    for f, sp in zip(FINGERS, (-6, -2, 2, 6)):
        for i in (1, 2, 3):
            d["%s.%02d.%s" % (f, i, s)] = [("Y", (-20 if i == 1 else -24) * k * amt)] + ([("Z", sp * k * amt)] if i == 1 else [])
    d["thumb.01." + s] = [("Z", -12 * k * amt)]
    return d

def apply(pose, frame):
    full = merge(base_pose(), pose)
    for pb in ARM.pose.bones:
        pb.rotation_quaternion = qrest(pb, full.get(pb.name, []))
        pb.keyframe_insert("rotation_quaternion", frame=frame, group=pb.name)
    r = ARM.pose.bones["root"]
    r.location = vrest(r, full.get("_loc", (0, 0, 0)))
    r.keyframe_insert("location", frame=frame, group="root")
    sq = full.get("_sq", 1.0)  # amassar/esticar no quadril
    h = ARM.pose.bones["hips"]
    h.scale = (1 / math.sqrt(sq), sq, 1 / math.sqrt(sq))
    h.keyframe_insert("scale", frame=frame, group="hips")

ACTS = {}
def action(name, keys, loop):
    act = bpy.data.actions.new("MB_" + name); act.use_fake_user = True
    ARM.animation_data.action = act
    for f, pose in keys:
        apply(pose, f)
    for fc in act.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"; kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"
        if loop:
            m = fc.modifiers.new("CYCLES")
    act.frame_range = (keys[0][0], keys[-1][0])
    ACTS[name] = {"loop": loop, "frames": [keys[0][0], keys[-1][0]]}
    log("acao", name, len(keys))
    return act

L, R = "L", "R"
# ---- Parado: respira, transfere peso, olha em volta (loop 4 s)
def idle(t):
    s = math.sin(2 * math.pi * t); c = math.cos(2 * math.pi * t); s2 = math.sin(4 * math.pi * t)
    return {"hips": [("Y", 3 * s), ("Z", 4 * s)], "_loc": (0.012 * s, 0, -0.004 * abs(s)),
            "spine": [("Y", -2 * s), ("X", 1.5 * s2)], "chest": [("X", 2 * s2), ("Y", -1.5 * s)],
            "neck": [("Z", 10 * math.sin(2 * math.pi * t + 1.2))], "head": [("Z", 8 * math.sin(2 * math.pi * t + 1.6)), ("X", 3 * c)],
            "upper_arm.L": [("Y", 2 * s2)], "upper_arm.R": [("Y", -2 * s2)], "forearm.L": [("Z", -4 * s2)], "forearm.R": [("Z", 4 * s2)],
            "thigh.L": [("Y", 2 * s)], "thigh.R": [("Y", 2 * s)], "shin.L": [("X", 3 * max(0, -s))], "shin.R": [("X", 3 * max(0, s))]}
action("Parado", [(int(i * 12), idle(i / 8)) for i in range(9)], True)

# ---- Tchau (loop 1 s): braco direito levanta, antebraco abana, mao aberta
def wave(t):
    a = math.sin(2 * math.pi * t)
    return merge({"clavicle.R": [("Y", -14)], "upper_arm.R": [("Y", -60), ("X", -15)], "forearm.R": [("Y", -75), ("Z", 15 * a)],
                  "hand.R": [("Z", 20 * math.sin(2 * math.pi * t - 0.8))], "head": [("Z", -8), ("Y", -5)], "chest": [("Y", 3)], "hips": [("Y", -2)]},
                 open_hand(R))
action("Tchau", [(int(i * 3), wave(i / 8)) for i in range(9)], True)

# ---- Feliz (loop 1 s = 2 pulinhos): braços pra cima alternando, joelhos quicando
def happy(t):
    b = abs(math.sin(2 * math.pi * t)); a = math.sin(2 * math.pi * t); land = 1 - b
    return merge({"_loc": (0, 0, 0.09 * b - 0.03 * land ** 4), "_sq": 1 + 0.05 * b - 0.07 * land ** 4,
                  "clavicle.L": [("Y", -12)], "clavicle.R": [("Y", 12)],
                  "upper_arm.L": [("Y", -130 + 18 * a)], "upper_arm.R": [("Y", 130 + 18 * a)],
                  "forearm.L": [("Y", 20 - 15 * a)], "forearm.R": [("Y", -20 - 15 * a)],
                  "hand.L": [("Y", 10 * a)], "hand.R": [("Y", 10 * a)],
                  "chest": [("Y", 6 * a)], "head": [("Y", -8 * a), ("X", -6 * b)], "hips": [("Y", -5 * a)],
                  "thigh.L": [("X", -25 * land ** 2)], "shin.L": [("X", 45 * land ** 2)], "foot.L": [("X", -20 * land ** 2)],
                  "thigh.R": [("X", -25 * land ** 2)], "shin.R": [("X", 45 * land ** 2)], "foot.R": [("X", -20 * land ** 2)]},
                 fist(L, .9), fist(R, .9))
action("Feliz", [(int(i * 3), happy(i / 8)) for i in range(9)], True)

# ---- Triste (loop 4 s): cabeca baixa, ombros caidos, suspiro
def sad(t):
    s = math.sin(2 * math.pi * t); sigh = max(0, math.sin(2 * math.pi * t)) ** 3
    return {"_loc": (0, 0, -0.02), "spine": [("X", 6)], "chest": [("X", 10 - 4 * sigh)], "neck": [("X", 14)], "head": [("X", 18 + 4 * s), ("Z", 6 * math.sin(math.pi * t))],
            "clavicle.L": [("Y", 12 + 3 * sigh)], "clavicle.R": [("Y", -12 - 3 * sigh)], "upper_arm.L": [("Y", 16), ("X", -6)], "upper_arm.R": [("Y", -16), ("X", -6)],
            "forearm.L": [("Z", 8)], "forearm.R": [("Z", -8)], "thigh.L": [("Z", 3)], "thigh.R": [("Z", -3)]}
action("Triste", [(int(i * 12), sad(i / 8)) for i in range(9)], True)

# ---- Assustado (loop 0,5 s): bracos protegendo o capacete, tremendo
def scared(t):
    j = math.sin(2 * math.pi * t * 2); k = math.cos(2 * math.pi * t * 3)
    return merge({"_loc": (0.006 * j, 0.03, -0.05), "spine": [("X", -6)], "chest": [("X", -8), ("Y", 2 * k)], "head": [("X", -10), ("Z", 4 * j)],
                  "clavicle.L": [("Y", -18)], "clavicle.R": [("Y", 18)],
                  "upper_arm.L": [("Y", -40 + 4 * k), ("Z", -25)], "upper_arm.R": [("Y", 40 + 4 * k), ("Z", 25)],
                  "forearm.L": [("Y", -95)], "forearm.R": [("Y", 95)], "hand.L": [("Z", 20 * j)], "hand.R": [("Z", -20 * j)],
                  "thigh.L": [("X", -22), ("Y", -4 * j)], "shin.L": [("X", 40)], "thigh.R": [("X", -22), ("Y", 4 * j)], "shin.R": [("X", 40)],
                  "foot.L": [("X", -18)], "foot.R": [("X", -18)]}, open_hand(L), open_hand(R))
action("Assustado", [(int(i * 2), scared(i / 6)) for i in range(7)], True)

# ---- Pulo (1,5 s): antecipacao, impulso, comemoracao no ar, aterrissagem amassando
crouch = {"_loc": (0, 0.02, -0.16), "_sq": 0.92, "spine": [("X", 16)], "chest": [("X", 10)], "head": [("X", -10)],
          "thigh.L": [("X", -55)], "shin.L": [("X", 95)], "foot.L": [("X", -40)], "thigh.R": [("X", -55)], "shin.R": [("X", 95)], "foot.R": [("X", -40)],
          "upper_arm.L": [("X", 35)], "upper_arm.R": [("X", 35)], "forearm.L": [("Z", -20)], "forearm.R": [("Z", 20)]}
launch = merge({"_loc": (0, 0, 0.32), "_sq": 1.08, "spine": [("X", -6)], "head": [("X", -14)],
                "upper_arm.L": [("Y", -150)], "upper_arm.R": [("Y", 150)], "forearm.L": [("Y", 10)], "forearm.R": [("Y", -10)],
                "thigh.L": [("X", 10)], "shin.L": [("X", 10)], "foot.L": [("X", 25)], "thigh.R": [("X", 10)], "shin.R": [("X", 10)], "foot.R": [("X", 25)]}, open_hand(L), open_hand(R))
top = merge({"_loc": (0, 0, 0.46), "spine": [("X", -4)], "head": [("X", -16)],
             "upper_arm.L": [("Y", -125)], "upper_arm.R": [("Y", 125)], "forearm.L": [("Y", -20)], "forearm.R": [("Y", 20)],
             "thigh.L": [("X", -40)], "shin.L": [("X", 75)], "thigh.R": [("X", -20)], "shin.R": [("X", 45)]}, fist(L), fist(R))
land = dict(crouch); land["_sq"] = 0.88; land["_loc"] = (0, 0.02, -0.18)
action("Pulo", [(0, {}), (6, crouch), (10, launch), (17, top), (24, launch), (28, land), (36, {})], False)

# ---- Comendo (3 s): pega o lanche, leva ao queixo, mastiga balancando a cabeca
reach = merge({"upper_arm.R": [("X", 40), ("Y", -20)], "forearm.R": [("Z", 60)], "hand.R": [("X", -20)]}, open_hand(R, .6))
mouth = merge({"clavicle.R": [("Y", -10)], "upper_arm.R": [("X", 30), ("Y", -38), ("Z", 30)], "forearm.R": [("Z", 125)], "hand.R": [("X", -30)],
               "head": [("X", 6)], "neck": [("X", 4)]}, fist(R, .7))
def chew(c):
    d = dict(mouth); d = merge(d, {"head": [("X", 8 * c), ("Z", 4 * c)], "chest": [("X", 2 * c)], "_sq": 1 - 0.015 * c})
    return d
action("Comendo", [(0, {}), (10, reach), (20, mouth)] + [(24 + i * 6, chew(1 if i % 2 == 0 else -1)) for i in range(8)] + [(72, mouth), (84, {})], False)

# ---- Gasolina (2,5 s): segura o galao pesado, ombro cai, suspira
heavy = merge({"clavicle.L": [("Y", 16)], "upper_arm.L": [("Y", 18), ("X", -8)], "forearm.L": [("Z", -10)], "hand.L": [("X", 10)],
               "spine": [("Y", -8)], "chest": [("Y", -6)], "hips": [("Y", 6)], "_loc": (-0.03, 0, -0.03)}, fist(L))
sigh = merge(heavy, {"head": [("X", 22), ("Z", -8)], "neck": [("X", 10)], "upper_arm.R": [("X", 10)], "_sq": 0.97})
action("Gasolina", [(0, {}), (10, heavy), (18, merge(heavy, {"_loc": (-0.03, 0, -0.06)})), (30, sigh), (46, sigh), (60, {})], False)

# ---- Manutencao (2,5 s): aperta com a chave girando o punho, depois limpa a testa
tool = merge({"upper_arm.R": [("X", 50), ("Y", -10)], "forearm.R": [("Z", 70)], "head": [("X", 15), ("Z", -10)], "chest": [("X", 6)]}, fist(R))
def turn(a): return merge(tool, {"hand.R": [("Y", -35 * a)], "forearm.R": [("X", 15 * a)]})
wipe = merge({"clavicle.L": [("Y", -15)], "upper_arm.L": [("Y", -60), ("X", 20)], "forearm.L": [("Y", -100)], "hand.L": [("Z", 20)], "head": [("X", -8)]}, open_hand(L, .5))
action("Manutencao", [(0, {}), (8, tool)] + [(12 + i * 5, turn(1 if i % 2 == 0 else -1)) for i in range(6)] + [(44, wipe), (52, merge(wipe, {"hand.L": [("Z", -20)]})), (64, {})], False)

# ---- Nota voando (2 s): solta a nota, tenta pegar, ombros caem
grab = merge({"upper_arm.R": [("X", 70), ("Y", -60)], "forearm.R": [("Z", 20)], "head": [("X", -20), ("Z", -15)], "chest": [("X", -6), ("Z", -8)],
              "_loc": (0.04, -0.04, 0.03), "thigh.R": [("X", -15)], "shin.R": [("X", 20)]}, open_hand(R))
slump = {"head": [("X", 15)], "chest": [("X", 8)], "clavicle.L": [("Y", 10)], "clavicle.R": [("Y", -10)], "_loc": (0, 0, -0.02), "_sq": 0.97}
action("Nota", [(0, {}), (6, merge({"upper_arm.R": [("X", 20)]}, open_hand(R, .4))), (14, grab), (24, merge(grab, {"_loc": (0.06, -0.06, 0.06)})), (34, slump), (48, {})], False)

ARM.animation_data.action = bpy.data.actions["MB_Parado"]
bpy.context.scene.frame_start, bpy.context.scene.frame_end = 0, 96
bpy.context.scene.render.fps = 24
json.dump(ACTS, open(os.path.join(D, "acoes_v3.json"), "w"), indent=1)
log("FIM")
LOG.close()
print("ANIM V3 OK")

"""
Arteon raio-x com 3 modelos GLB:
  1) carroceria  (volkswagen_arteon_shooting_brake.glb)
  2) suspensão   (car_chassis.glb, textura amarela)
  3) motor/trem de força (volkswagen-arteon-chassis.glb, textura cinza/preta)

Linha do tempo (24 fps, 12 s):
  carroceria sólida girando -> carroceria fica transparente -> suspensão aparece
  -> suspensão some enquanto motor/trem de força aparece -> carroceria volta.
Os dois "chassis" têm rodas, então eles NÃO ficam juntos: um troca pelo outro.
Assim não há rodas duplicadas brigando no mesmo lugar.

COMO USAR
1. Blender 4.2 ou mais novo -> aba Scripting -> Open -> este arquivo.
2. Clique em Run Script (Play).
3. Aperte Espaço na viewport para ver a animação fluida em tempo real.
4. Render > Render Animation para gerar o MP4 final em alta definição.
"""

import bpy
import math
import os
from mathutils import Vector

# ------------------------------------------------------------------
# CONFIGURAÇÃO DE CAMINHOS
# ------------------------------------------------------------------
MODELS_DIR = r"C:\Users\tiujo\Downloads"
BODY_FILE = "volkswagen_arteon_shooting_brake.glb"
SUSPENSION_FILE = "car_chassis.glb"                  # suspensão amarela
DRIVETRAIN_FILE = "volkswagen-arteon-chassis.glb"    # motor / trem de força cinza/preto
OUTPUT_PATH = r"C:\Users\tiujo\Downloads\arteon_raio_x.mp4"

REAL_LENGTH_M = 4.86     # comprimento real do Arteon Shooting Brake

# Ajustes angulares finos caso necessário (em graus em torno do eixo vertical Z)
SUSPENSION_ROT_DEG = 0
DRIVETRAIN_ROT_DEG = 0

# Encaixe proporcional milimétrico das peças dentro da lataria
LENGTH_FRAC = 0.96       # 96% do comprimento da carroceria
WIDTH_FRAC = 0.88        # 88% da largura (rodas perfeitamente alinhadas aos para-lamas)
Z_OFFSET = 0.0           # ajuste de altura vertical

FPS = 24
TOTAL_FRAMES = 288       # 12 segundos
BODY_SOLID_UNTIL = 36    # carroceria sólida inicial
BODY_FADE = (36, 84)     # transição para transparência raio-x
BODY_FINAL_ALPHA = 0.10  # opacidade da lataria raio-x
SUSP_IN = (72, 100)      # suspensão aparece
SUSP_OUT = (168, 196)    # suspensão desaparece suavemente
DRIVE_IN = (168, 196)    # motor/trem de força aparece (troca precisa sem colisão de rodas)
DRIVE_OUT = (240, 264)   # motor desaparece
BODY_BACK = (240, 276)   # carroceria volta à cor sólida original

CAMERA_DISTANCE_X = 1.55
CAMERA_HEIGHT_X = 0.38
RESOLUTION = (1920, 1080)


# ------------------------------------------------------------------
# FUNÇÕES DE CENA E GEOMETRIA
# ------------------------------------------------------------------
def limpar_cena():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for bloco in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.images):
        for item in list(bloco):
            if item.users == 0:
                bloco.remove(item)


def importar(nome):
    caminho = os.path.join(MODELS_DIR, nome)
    if not os.path.exists(caminho):
        print(f"[AVISO] Arquivo não encontrado: {caminho}")
        return []
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=caminho)
    return [o for o in bpy.data.objects if o not in antes]


def malhas(objs):
    return [o for o in objs if o.type == "MESH"]


def bbox_mundo(objs):
    """(min, max) em coordenadas de mundo de todas as malhas."""
    bpy.context.view_layer.update()
    mn = [1e18] * 3
    mx = [-1e18] * 3
    for o in malhas(objs):
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    return mn, mx


def criar_empty(nome, pai=None):
    e = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(e)
    if pai:
        e.parent = pai
    return e


def prender(objs, pai):
    for o in objs:
        if o.parent is None or o.parent not in objs:
            o.parent = pai


def tamanho(mn, mx):
    return [mx[i] - mn[i] for i in range(3)]


def centro(mn, mx):
    return [(mx[i] + mn[i]) / 2 for i in range(3)]


def preparar_corpo(objs):
    """Escala a carroceria para o tamanho real e centraliza no chão."""
    raiz = criar_empty("Corpo")
    prender(objs, raiz)
    mn, mx = bbox_mundo(objs)
    comp = max(tamanho(mn, mx)[0], tamanho(mn, mx)[1])
    s = REAL_LENGTH_M / comp
    raiz.scale = (s, s, s)
    mn, mx = bbox_mundo(objs)
    c = centro(mn, mx)
    raiz.location = (-c[0], -c[1], -mn[2])
    mn, mx = bbox_mundo(objs)
    return raiz, mn, mx


def encaixar_peca(nome, objs, rot_extra_deg, corpo_mn, corpo_mx):
    """
    Gira (se o comprimento estiver no eixo errado), escala e posiciona a peça
    dentro da carroceria. Hierarquia: Ajuste(escala+posição) > Giro > objetos.
    """
    ajuste = criar_empty(nome + "_Ajuste")
    giro = criar_empty(nome + "_Giro", ajuste)
    prender(objs, giro)

    mn, mx = bbox_mundo(objs)
    dx, dy, _ = tamanho(mn, mx)
    giro_deg = 0
    if dy > dx:                       # comprimento está no eixo Y -> gira 90° para alinhar com X
        giro_deg = 90
    giro.rotation_euler[2] = math.radians(giro_deg + rot_extra_deg)

    mn, mx = bbox_mundo(objs)
    dx, dy, dz = tamanho(mn, mx)
    cb = tamanho(corpo_mn, corpo_mx)
    sx = cb[0] * LENGTH_FRAC / dx
    sy = cb[1] * WIDTH_FRAC / dy
    sz = sx                            # altura proporcional ao comprimento (mantém o pneu redondo)
    ajuste.scale = (sx, sy, sz)

    mn, mx = bbox_mundo(objs)
    cp = centro(mn, mx)
    cc = centro(corpo_mn, corpo_mx)
    ajuste.location = (cc[0] - cp[0], cc[1] - cp[1], corpo_mn[2] + Z_OFFSET - mn[2])

    mn, mx = bbox_mundo(objs)
    print(f"[{nome}] giro={giro_deg + rot_extra_deg}°  escala=({sx:.3f},{sy:.3f},{sz:.3f})  "
          f"tamanho final={[round(v, 2) for v in tamanho(mn, mx)]} m")
    return ajuste


def principled(mat):
    if not mat or not mat.use_nodes:
        return None
    for n in mat.node_tree.nodes:
        if n.type == "BSDF_PRINCIPLED":
            return n
    return None


def materiais(objs):
    vistos, saida = set(), []
    for o in malhas(objs):
        for slot in o.material_slots:
            if slot.material and slot.material.name not in vistos:
                vistos.add(slot.material.name)
                saida.append(slot.material)
    return saida


def ativar_transparencia(mats):
    for mat in mats:
        try:
            mat.surface_render_method = "BLENDED"   # Blender 4.2+
        except Exception:
            pass
        try:
            mat.blend_method = "BLEND"              # EEVEE clássico
        except Exception:
            pass
        try:
            mat.show_transparent_back = False       # melhora ordenação de profundidade
        except Exception:
            pass


def animar_alpha(mats, pontos):
    """pontos = [(frame, alpha), ...] mantendo a textura original do modelo."""
    for mat in mats:
        node = principled(mat)
        if node is None:
            continue
        sock = node.inputs["Alpha"]
        for frame, valor in pontos:
            sock.default_value = valor
            sock.keyframe_insert("default_value", frame=frame)


def montar_camera_e_luzes(corpo_mn, corpo_mx):
    comp = tamanho(corpo_mn, corpo_mx)[0]
    alt = tamanho(corpo_mn, corpo_mx)[2]
    alvo = bpy.data.objects.new("CentroCamera", None)
    alvo.location = (0, 0, alt * 0.45)
    bpy.context.scene.collection.objects.link(alvo)

    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = 40
    cam = bpy.data.objects.new("Camera", cam_data)
    cam.location = (comp * CAMERA_DISTANCE_X, 0, comp * CAMERA_HEIGHT_X)
    cam.parent = alvo
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    track = cam.constraints.new("TRACK_TO")
    track.target = alvo
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"

    # Giro 360° perfeitamente uniforme
    prefs = bpy.context.preferences.edit
    anterior = prefs.keyframe_new_interpolation_type
    prefs.keyframe_new_interpolation_type = "LINEAR"
    alvo.rotation_euler = (0, 0, 0)
    alvo.keyframe_insert("rotation_euler", frame=1)
    alvo.rotation_euler = (0, 0, math.radians(360))
    alvo.keyframe_insert("rotation_euler", frame=TOTAL_FRAMES)
    prefs.keyframe_new_interpolation_type = anterior

    for nome, loc, energia in (("LuzPrincipal", (comp, -comp, comp * 1.2), 3500),
                               ("LuzFill", (-comp, comp, comp * 0.7), 1500)):
        luz_data = bpy.data.lights.new(nome, "AREA")
        luz_data.energy = energia
        luz_data.size = comp
        luz = bpy.data.objects.new(nome, luz_data)
        luz.location = loc
        bpy.context.scene.collection.objects.link(luz)
        t = luz.constraints.new("TRACK_TO")
        t.target = alvo
        t.track_axis = "TRACK_NEGATIVE_Z"
        t.up_axis = "UP_Y"


def montar_chao():
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -0.005))
    chao = bpy.context.active_object
    chao.name = "Chao"
    mat = bpy.data.materials.new("Chao")
    mat.use_nodes = True
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.03, 0.03, 0.035, 1)
    b.inputs["Roughness"].default_value = 0.35
    chao.data.materials.append(mat)


def configurar_render():
    cena = bpy.context.scene
    cena.frame_start = 1
    cena.frame_end = TOTAL_FRAMES
    cena.render.fps = FPS
    cena.render.resolution_x, cena.render.resolution_y = RESOLUTION
    cena.render.resolution_percentage = 100
    try:
        cena.render.engine = "BLENDER_EEVEE_NEXT"   # Blender 4.2+
    except TypeError:
        cena.render.engine = "BLENDER_EEVEE"
    cena.render.image_settings.file_format = "FFMPEG"
    cena.render.ffmpeg.format = "MPEG4"
    cena.render.ffmpeg.codec = "H264"
    cena.render.ffmpeg.constant_rate_factor = "HIGH"
    cena.render.filepath = OUTPUT_PATH

    mundo = cena.world or bpy.data.worlds.new("Mundo")
    cena.world = mundo
    mundo.use_nodes = True
    fundo = mundo.node_tree.nodes.get("Background")
    if fundo:
        fundo.inputs["Color"].default_value = (0.02, 0.02, 0.025, 1)
        fundo.inputs["Strength"].default_value = 1.0


# ------------------------------------------------------------------
# EXECUÇÃO PRINCIPAL
# ------------------------------------------------------------------
def main():
    limpar_cena()
    corpo_objs = importar(BODY_FILE)
    susp_objs = importar(SUSPENSION_FILE)
    trem_objs = importar(DRIVETRAIN_FILE)

    if not corpo_objs:
        print("[ERRO] Carroceria não encontrada. Verifique MODELS_DIR e BODY_FILE.")
        return

    _, c_mn, c_mx = preparar_corpo(corpo_objs)
    print(f"[Corpo] tamanho={[round(v, 2) for v in tamanho(c_mn, c_mx)]} m")

    mats_corpo = materiais(corpo_objs)
    ativar_transparencia(mats_corpo)
    animar_alpha(mats_corpo, [
        (1, 1.0), (BODY_SOLID_UNTIL, 1.0), (BODY_FADE[1], BODY_FINAL_ALPHA),
        (BODY_BACK[0], BODY_FINAL_ALPHA), (BODY_BACK[1], 1.0), (TOTAL_FRAMES, 1.0),
    ])

    if susp_objs:
        encaixar_peca("Suspensao", susp_objs, SUSPENSION_ROT_DEG, c_mn, c_mx)
        m = materiais(susp_objs)
        ativar_transparencia(m)
        animar_alpha(m, [(1, 0.0), (SUSP_IN[0], 0.0), (SUSP_IN[1], 1.0),
                         (SUSP_OUT[0], 1.0), (SUSP_OUT[1], 0.0), (TOTAL_FRAMES, 0.0)])

    if trem_objs:
        encaixar_peca("MotorTrem", trem_objs, DRIVETRAIN_ROT_DEG, c_mn, c_mx)
        m = materiais(trem_objs)
        ativar_transparencia(m)
        animar_alpha(m, [(1, 0.0), (DRIVE_IN[0], 0.0), (DRIVE_IN[1], 1.0),
                         (DRIVE_OUT[0], 1.0), (DRIVE_OUT[1], 0.0), (TOTAL_FRAMES, 0.0)])

    montar_chao()
    montar_camera_e_luzes(c_mn, c_mx)
    configurar_render()
    bpy.context.scene.frame_set(1)
    print("Cena pronta com sucesso!")
    print("1. Aperte ESPAÇO para ver o preview em tempo real.")
    print("2. Menu Render > Render Animation para gerar o vídeo em C:\\Users\\tiujo\\Downloads\\arteon_raio_x.mp4")


if __name__ == "__main__":
    main()


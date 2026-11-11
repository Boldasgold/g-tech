"""
Animação 3D "raio-x" do Volkswagen Arteon Shooting Brake:
carroceria -> fica transparente -> aparece suspensão -> aparece motor.
Câmera gira 360 graus em volta do carro.

CONFIGURAÇÃO AUTOMÁTICA G-TECH:
- O arquivo GLB do Volkswagen Arteon Shooting Brake (20,2 MB) foi localizado em:
  C:\\Users\\tiujo\\Downloads\\volkswagen_arteon_shooting_brake.glb
- Como o modelo é uma malha externa monobloco, o script anima a órbita de 360° e a transparência
  progressiva da carroceria (raio-x). Se você tiver peças separadas de suspensão e motor,
  basta preencher SUSPENSION_FILE e ENGINE_FILE.
"""

import bpy
import math
import os

# ------------------------------------------------------------------
# CONFIG
# ------------------------------------------------------------------
BODY_FILE = r"C:\Users\tiujo\Downloads\volkswagen_arteon_shooting_brake.glb"
SUSPENSION_FILE = ""  # Opcional se houver modelo separado
ENGINE_FILE = ""      # Opcional se houver modelo separado

BODY_COLOR = (0.55, 0.57, 0.60, 1.0)        # prata reflex
SUSPENSION_COLOR = (1.0, 0.65, 0.0, 1.0)    # amarelo/laranja
ENGINE_COLOR = (0.12, 0.12, 0.13, 1.0)      # cinza escuro

FPS = 24
TOTAL_FRAMES = 240            # 10 segundos
BODY_FADE_START = 30          # carroceria começa a ficar transparente
BODY_FADE_END = 80            # carroceria termina de ficar transparente
BODY_FINAL_ALPHA = 0.12       # transparência final (0 = invisível, 1 = sólido)
SUSPENSION_APPEAR = (60, 100) # frames em que a suspensão aparece
ENGINE_APPEAR = (90, 130)     # frames em que o motor aparece

CAMERA_DISTANCE = 9.0
CAMERA_HEIGHT = 2.5
RESOLUTION = (1920, 1080)
OUTPUT_PATH = r"C:\Users\tiujo\Downloads\arteon_animacao.mp4"


# ------------------------------------------------------------------
# FUNÇÕES AUXILIARES
# ------------------------------------------------------------------
def limpar_cena():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for bloco in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for item in list(bloco):
            if item.users == 0:
                bloco.remove(item)


def importar(caminho):
    """Importa um arquivo 3D e devolve a lista de objetos novos."""
    if not caminho or not os.path.exists(caminho):
        return []
    antes = set(bpy.data.objects)
    ext = os.path.splitext(caminho)[1].lower()
    if ext == ".obj":
        if hasattr(bpy.ops.wm, "obj_import"):
            bpy.ops.wm.obj_import(filepath=caminho)
        else:
            bpy.ops.import_scene.obj(filepath=caminho)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=caminho)
    elif ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=caminho)
    else:
        print(f"Formato não suportado: {ext}")
        return []
    return [o for o in bpy.data.objects if o not in antes]


def criar_grupo(nome, objetos):
    """Cria um empty e coloca os objetos como filhos (para animar escala em conjunto)."""
    grupo = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(grupo)
    for obj in objetos:
        if obj.parent is None:
            obj.parent = grupo
    return grupo


def criar_material(nome, cor, metalico=0.6, rugosidade=0.3):
    mat = bpy.data.materials.new(nome)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = cor
    bsdf.inputs["Metallic"].default_value = metalico
    bsdf.inputs["Roughness"].default_value = rugosidade
    # Transparência funcionando no EEVEE (3.x e 4.x)
    if hasattr(mat, "blend_method"):
        mat.blend_method = "BLEND"
    if hasattr(mat, "surface_render_method"):
        mat.surface_render_method = "BLENDED"
    if hasattr(mat, "shadow_method"):
        mat.shadow_method = "NONE"
    return mat


def aplicar_material(objetos, mat):
    for obj in objetos:
        if obj.type == "MESH":
            obj.data.materials.clear()
            obj.data.materials.append(mat)


def animar_alpha(mat, inicio, fim, de=1.0, para=0.1):
    alpha = mat.node_tree.nodes["Principled BSDF"].inputs["Alpha"]
    alpha.default_value = de
    alpha.keyframe_insert("default_value", frame=inicio)
    alpha.default_value = para
    alpha.keyframe_insert("default_value", frame=fim)


def animar_aparecer(grupo, inicio, fim):
    """Escala de ~0 até 1 com suavização."""
    grupo.scale = (0.001, 0.001, 0.001)
    grupo.keyframe_insert("scale", frame=inicio)
    grupo.scale = (1, 1, 1)
    grupo.keyframe_insert("scale", frame=fim)
    if grupo.animation_data and grupo.animation_data.action:
        for fc in grupo.animation_data.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "BEZIER"


def montar_camera_e_luzes():
    # Empty central: a câmera gira junto com ele
    centro = bpy.data.objects.new("CentroCamera", None)
    centro.location = (0, 0, 0.7)
    bpy.context.scene.collection.objects.link(centro)

    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = 40
    cam = bpy.data.objects.new("Camera", cam_data)
    cam.location = (CAMERA_DISTANCE, 0, CAMERA_HEIGHT)
    cam.parent = centro
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam

    restricao = cam.constraints.new("TRACK_TO")
    restricao.target = centro
    restricao.track_axis = "TRACK_NEGATIVE_Z"
    restricao.up_axis = "UP_Y"

    centro.rotation_euler = (0, 0, 0)
    centro.keyframe_insert("rotation_euler", frame=1)
    centro.rotation_euler = (0, 0, math.radians(360))
    centro.keyframe_insert("rotation_euler", frame=TOTAL_FRAMES)
    for fc in centro.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"

    # Luzes
    for nome, loc, energia in (("LuzPrincipal", (6, -6, 8), 1200), ("LuzFill", (-6, 6, 4), 500)):
        luz_data = bpy.data.lights.new(nome, "AREA")
        luz_data.energy = energia
        luz_data.size = 6
        luz = bpy.data.objects.new(nome, luz_data)
        luz.location = loc
        bpy.context.scene.collection.objects.link(luz)
        track = luz.constraints.new("TRACK_TO")
        track.target = centro
        track.track_axis = "TRACK_NEGATIVE_Z"
        track.up_axis = "UP_Y"


def montar_chao():
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
    chao = bpy.context.active_object
    chao.name = "Chao"
    mat = bpy.data.materials.new("Chao")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.03, 0.03, 0.035, 1)
    bsdf.inputs["Roughness"].default_value = 0.4
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
        cena.render.engine = "BLENDER_EEVEE"        # Blender 3.x / 4.0 / 4.1
    cena.render.image_settings.file_format = "FFMPEG"
    cena.render.ffmpeg.format = "MPEG4"
    cena.render.ffmpeg.codec = "H264"
    cena.render.ffmpeg.constant_rate_factor = "HIGH"
    cena.render.filepath = OUTPUT_PATH

    # Fundo escuro
    mundo = cena.world or bpy.data.worlds.new("Mundo")
    cena.world = mundo
    mundo.use_nodes = True
    fundo = mundo.node_tree.nodes.get("Background")
    if fundo:
        fundo.inputs["Color"].default_value = (0.02, 0.02, 0.025, 1)
        fundo.inputs["Strength"].default_value = 1.0


# ------------------------------------------------------------------
# EXECUÇÃO
# ------------------------------------------------------------------
def main():
    limpar_cena()

    carroceria = importar(BODY_FILE)
    suspensao = importar(SUSPENSION_FILE)
    motor = importar(ENGINE_FILE)

    if not (carroceria or suspensao or motor):
        print("Nenhum modelo encontrado. Ajuste BODY_FILE, SUSPENSION_FILE e ENGINE_FILE na seção CONFIG.")
        return

    # Carroceria: material que fica transparente
    if carroceria:
        mat_corpo = criar_material("Carroceria", BODY_COLOR, metalico=0.8, rugosidade=0.25)
        aplicar_material(carroceria, mat_corpo)
        animar_alpha(mat_corpo, BODY_FADE_START, BODY_FADE_END, de=1.0, para=BODY_FINAL_ALPHA)

    # Suspensão: aparece crescendo
    if suspensao:
        mat_susp = criar_material("Suspensao", SUSPENSION_COLOR, metalico=0.3, rugosidade=0.35)
        aplicar_material(suspensao, mat_susp)
        grupo_susp = criar_grupo("GrupoSuspensao", suspensao)
        animar_aparecer(grupo_susp, *SUSPENSION_APPEAR)

    # Motor: aparece crescendo
    if motor:
        mat_motor = criar_material("Motor", ENGINE_COLOR, metalico=0.9, rugosidade=0.4)
        aplicar_material(motor, mat_motor)
        grupo_motor = criar_grupo("GrupoMotor", motor)
        animar_aparecer(grupo_motor, *ENGINE_APPEAR)

    montar_chao()
    montar_camera_e_luzes()
    configurar_render()
    bpy.context.scene.frame_set(1)
    print("Cena pronta. Aperte Espaço para ver a animação ou use Render > Render Animation.")


if __name__ == "__main__":
    main()


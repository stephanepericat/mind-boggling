<script setup lang="ts">
import type { RolledDie } from '../../../shared/dice/types'
import {
  CanvasTexture,
  DirectionalLight,
  Euler,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Quaternion,
  Scene,
  SRGBColorSpace,
  WebGLRenderer
} from 'three'
import type { BufferGeometry } from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const props = defineProps<{
  dice: readonly RolledDie<number>[]
  rollId: string
  bodyColor?: string
  pipColor?: string
}>()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
let renderer: WebGLRenderer | null = null
let camera: OrthographicCamera | null = null
let scene: Scene | null = null
let geometry: BufferGeometry | null = null
let materials: MeshStandardMaterial[] = []
let meshes: Mesh[] = []
let textures: CanvasTexture[] = []
let frame = 0
let resizeObserver: ResizeObserver | null = null

const pipPositions: Record<number, Array<[number, number]>> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]]
}

function faceTexture(value: number, bodyColor: string, pipColor: string): CanvasTexture {
  const surface = document.createElement('canvas')
  surface.width = 256
  surface.height = 256
  const context = surface.getContext('2d')!
  context.fillStyle = bodyColor
  context.fillRect(0, 0, 256, 256)
  context.fillStyle = pipColor
  for (const [column, row] of pipPositions[value] ?? []) {
    context.beginPath()
    context.arc(128 + column * 66, 128 + row * 66, 18, 0, Math.PI * 2)
    context.fill()
  }
  const texture = new CanvasTexture(surface)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function rebuildMaterials() {
  textures.forEach(texture => texture.dispose())
  materials.forEach(material => material.dispose())
  textures = [3, 4, 2, 5, 1, 6].map(face => faceTexture(face, props.bodyColor ?? '#fffdf7', props.pipColor ?? '#172033'))
  materials = textures.map(map => new MeshStandardMaterial({ map, roughness: 0.68, metalness: 0.01 }))
  meshes.forEach((mesh) => {
    mesh.material = materials
  })
}

function targetQuaternion(face: number): Quaternion {
  const rotation = new Euler()
  if (face === 2) rotation.x = Math.PI / 2
  if (face === 3) rotation.y = -Math.PI / 2
  if (face === 4) rotation.y = Math.PI / 2
  if (face === 5) rotation.x = -Math.PI / 2
  if (face === 6) rotation.y = Math.PI
  return new Quaternion().setFromEuler(rotation)
}

function hash(value: string): number {
  let result = 2166136261
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619)
  return result >>> 0
}

function resize() {
  if (!renderer || !camera || !canvas.value) return
  const width = Math.max(canvas.value.clientWidth, 1)
  const height = Math.max(canvas.value.clientHeight, 1)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height, false)
  const visibleWidth = Math.max(props.dice.length * 1.45, 6)
  camera.left = -visibleWidth / 2
  camera.right = visibleWidth / 2
  camera.top = visibleWidth / (width / height) / 2
  camera.bottom = -camera.top
  camera.updateProjectionMatrix()
}

function arrangeMeshes() {
  const spacing = 1.45
  const start = -(props.dice.length - 1) * spacing / 2
  meshes.forEach((mesh, index) => {
    mesh.visible = index < props.dice.length
    mesh.position.set(start + index * spacing, 0, 0)
  })
  resize()
}

function animateRoll() {
  if (!renderer || !camera || !scene) return
  cancelAnimationFrame(frame)
  arrangeMeshes()
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const plans = props.dice.map((die, index) => {
    const seed = hash(`${props.rollId}:${die.id}`)
    return {
      delay: index * 34,
      startX: meshes[index]!.position.x + ((seed & 1) === 0 ? -1 : 1) * (0.45 + (seed % 30) / 100),
      startY: 0.22 + ((seed >>> 5) % 20) / 100,
      phaseX: ((seed >>> 9) % 100) / 100 * Math.PI,
      phaseY: ((seed >>> 16) % 100) / 100 * Math.PI,
      phaseZ: ((seed >>> 22) % 100) / 100 * Math.PI,
      turnsX: 3 + seed % 3,
      turnsY: 4 + (seed >>> 4) % 3,
      turnsZ: 2 + (seed >>> 8) % 2
    }
  })
  const targets = props.dice.map(die => targetQuaternion(die.face))
  const startedAt = performance.now()
  const spin = new Quaternion()
  const spinEuler = new Euler()
  const duration = 1_050

  const draw = (time: number) => {
    let complete = true
    props.dice.forEach((_, index) => {
      const plan = plans[index]!
      const elapsed = reducedMotion ? 1 : Math.min(Math.max((time - startedAt - plan.delay) / duration, 0), 1)
      const eased = 1 - (1 - elapsed) ** 3
      const remaining = 1 - eased
      const mesh = meshes[index]!
      const targetX = -(props.dice.length - 1) * 1.45 / 2 + index * 1.45
      spinEuler.set(
        (plan.turnsX * Math.PI * 2 + plan.phaseX) * remaining,
        (plan.turnsY * Math.PI * 2 + plan.phaseY) * remaining,
        (plan.turnsZ * Math.PI * 2 + plan.phaseZ) * remaining
      )
      spin.setFromEuler(spinEuler)
      mesh.quaternion.copy(targets[index]!).multiply(spin)
      mesh.position.x = plan.startX + (targetX - plan.startX) * eased
      const flight = Math.sin(Math.PI * elapsed) * 0.3
      const settleProgress = Math.max(0, (elapsed - 0.72) / 0.28)
      const bounce = Math.abs(Math.sin(settleProgress * Math.PI * 3)) * (1 - settleProgress) * 0.11
      mesh.position.y = reducedMotion ? 0 : plan.startY * remaining + flight + bounce
      mesh.position.z = reducedMotion ? 0 : Math.sin(Math.PI * elapsed) * 0.28
      if (elapsed < 1) complete = false
    })
    renderer!.render(scene!, camera!)
    if (!complete) frame = requestAnimationFrame(draw)
  }
  frame = requestAnimationFrame(draw)
}

onMounted(() => {
  if (!canvas.value) return
  try {
    renderer = new WebGLRenderer({ canvas: canvas.value, alpha: true, antialias: true })
  } catch {
    return
  }
  scene = new Scene()
  camera = new OrthographicCamera(-4, 4, 2, -2, 0.1, 100)
  camera.position.set(0, 0, 10)
  geometry = new RoundedBoxGeometry(1, 1, 1, 6, 0.13)
  rebuildMaterials()
  meshes = Array.from({ length: 6 }, () => {
    const mesh = new Mesh(geometry!, materials)
    scene!.add(mesh)
    return mesh
  })
  scene.add(new HemisphereLight(0xffffff, 0x334155, 2.6))
  const light = new DirectionalLight(0xffffff, 3.2)
  light.position.set(-3, 5, 8)
  scene.add(light)
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas.value)
  animateRoll()
})

watch(() => `${props.rollId}:${props.dice.map(die => `${die.id}-${die.face}`).join(':')}`, animateRoll)
watch(() => `${props.bodyColor ?? '#fffdf7'}:${props.pipColor ?? '#172033'}`, () => {
  if (!renderer) return
  rebuildMaterials()
  animateRoll()
})

onScopeDispose(() => {
  cancelAnimationFrame(frame)
  resizeObserver?.disconnect()
  geometry?.dispose()
  materials.forEach(material => material.dispose())
  textures.forEach(texture => texture.dispose())
  renderer?.dispose()
})
</script>

<template>
  <canvas
    ref="canvas"
    class="h-44 w-full sm:h-48"
    aria-hidden="true"
  />
</template>

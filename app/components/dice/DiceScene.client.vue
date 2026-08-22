<script setup lang="ts">
import type { RolledDie } from '../../../shared/dice/types'
import * as THREE from 'three'

const props = defineProps<{ dice: RolledDie<number>[], rollId: string }>()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
let renderer: THREE.WebGLRenderer | null = null
let camera: THREE.OrthographicCamera | null = null
let scene: THREE.Scene | null = null
let geometry: THREE.BoxGeometry | null = null
let materials: THREE.MeshStandardMaterial[] = []
let meshes: THREE.Mesh[] = []
let textures: THREE.CanvasTexture[] = []
let frame = 0
let resizeObserver: ResizeObserver | null = null

function faceTexture(value: number): THREE.CanvasTexture {
  const surface = document.createElement('canvas')
  surface.width = 128
  surface.height = 128
  const context = surface.getContext('2d')!
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, 128, 128)
  context.fillStyle = value === 1 ? '#7c3aed' : '#111827'
  context.font = '900 72px ui-monospace, monospace'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(String(value), 64, 68)
  const texture = new THREE.CanvasTexture(surface)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function targetQuaternion(face: number): THREE.Quaternion {
  const rotation = new THREE.Euler()
  if (face === 2) rotation.x = Math.PI / 2
  if (face === 3) rotation.y = -Math.PI / 2
  if (face === 4) rotation.y = Math.PI / 2
  if (face === 5) rotation.x = -Math.PI / 2
  if (face === 6) rotation.y = Math.PI
  return new THREE.Quaternion().setFromEuler(rotation)
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
  const starts = props.dice.map((die) => {
    const seed = hash(`${props.rollId}:${die.id}`)
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(
      (seed % 7 + 2) * Math.PI,
      ((seed >>> 4) % 9 + 2) * Math.PI,
      ((seed >>> 8) % 5) * Math.PI
    ))
  })
  const targets = props.dice.map(die => targetQuaternion(die.face))
  const startedAt = performance.now()

  const draw = (time: number) => {
    const elapsed = reducedMotion ? 1 : Math.min((time - startedAt) / 850, 1)
    const eased = 1 - (1 - elapsed) ** 3
    props.dice.forEach((_, index) => {
      const mesh = meshes[index]!
      mesh.quaternion.slerpQuaternions(starts[index]!, targets[index]!, eased)
      mesh.position.y = reducedMotion ? 0 : Math.sin(Math.PI * elapsed) * (0.7 + (index % 2) * 0.12)
    })
    renderer!.render(scene!, camera!)
    if (elapsed < 1) frame = requestAnimationFrame(draw)
  }
  frame = requestAnimationFrame(draw)
}

onMounted(() => {
  if (!canvas.value) return
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas.value, alpha: true, antialias: true })
  } catch {
    return
  }
  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(-4, 4, 2, -2, 0.1, 100)
  camera.position.set(0, 0, 10)
  geometry = new THREE.BoxGeometry(1, 1, 1, 3, 3, 3)
  textures = [3, 4, 2, 5, 1, 6].map(faceTexture)
  materials = textures.map(map => new THREE.MeshStandardMaterial({ map, roughness: 0.55, metalness: 0.03 }))
  meshes = Array.from({ length: 6 }, () => {
    const mesh = new THREE.Mesh(geometry!, materials)
    scene!.add(mesh)
    return mesh
  })
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2.4))
  const light = new THREE.DirectionalLight(0xffffff, 3)
  light.position.set(-3, 5, 8)
  scene.add(light)
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas.value)
  animateRoll()
})

watch(() => props.rollId, animateRoll)
watch(() => props.dice.length, arrangeMeshes)

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
    class="h-36 w-full"
    aria-hidden="true"
  />
</template>

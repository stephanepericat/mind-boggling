<script setup lang="ts">
import type { UnoCard, UnoColor, UnoDirection } from '#shared/games/uno'
import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  RingGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  WebGLRenderer
} from 'three'
import type { BufferGeometry, Material } from 'three'

const props = defineProps<{
  topCard?: UnoCard
  activeColor?: UnoColor
  direction: UnoDirection
  drawPileCount: number
  seatCount: number
  activeSeatIndex: number
  actionKey: string
}>()

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const failed = shallowRef(false)
let renderer: WebGLRenderer | null = null
let scene: Scene | null = null
let camera: PerspectiveCamera | null = null
let tableGroup: Group | null = null
let cardGroup: Group | null = null
let ring: Mesh | null = null
let marker: Mesh | null = null
let topCardMesh: Mesh | null = null
let topCardTexture: CanvasTexture | null = null
let resizeObserver: ResizeObserver | null = null
let frame = 0
const geometries: BufferGeometry[] = []
const materials: Material[] = []
const dynamicGeometries: BufferGeometry[] = []
const dynamicMaterials: Material[] = []

const colorHex: Record<UnoColor, number> = {
  red: 0xe53935,
  yellow: 0xffc928,
  green: 0x18a957,
  blue: 0x1677e8
}

function cardSymbol(card: UnoCard): string {
  if (card.kind === 'number') return String(card.number)
  if (card.kind === 'skip') return '⊘'
  if (card.kind === 'reverse') return '↻'
  if (card.kind === 'draw-two') return '+2'
  if (card.kind === 'wild-draw-four') return '+4'
  return 'W'
}

function makeCardTexture(card: UnoCard): CanvasTexture {
  const surface = document.createElement('canvas')
  surface.width = 384
  surface.height = 560
  const context = surface.getContext('2d')!
  const face = card.color ? `#${colorHex[card.color].toString(16).padStart(6, '0')}` : '#11151D'
  context.fillStyle = '#FFF7E6'
  context.fillRect(0, 0, surface.width, surface.height)
  context.fillStyle = face
  context.beginPath()
  context.roundRect(12, 12, 360, 536, 38)
  context.fill()
  if (!card.color) {
    const gradient = context.createConicGradient(-0.5, 192, 280)
    gradient.addColorStop(0, '#E53935')
    gradient.addColorStop(0.25, '#FFC928')
    gradient.addColorStop(0.5, '#18A957')
    gradient.addColorStop(0.75, '#1677E8')
    gradient.addColorStop(1, '#E53935')
    context.fillStyle = gradient
  } else {
    context.fillStyle = '#FFF7E6'
  }
  context.save()
  context.translate(192, 280)
  context.rotate(-0.4)
  context.beginPath()
  context.ellipse(0, 0, 132, 216, 0, 0, Math.PI * 2)
  context.fill()
  context.restore()
  context.fillStyle = '#11151D'
  context.font = '900 104px Funnel Sans, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(cardSymbol(card), 192, 280)
  const texture = new CanvasTexture(surface)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function resize() {
  if (!renderer || !camera || !canvas.value) return
  const width = Math.max(canvas.value.clientWidth, 1)
  const height = Math.max(canvas.value.clientHeight, 1)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  render()
}

function render() {
  if (renderer && scene && camera) renderer.render(scene, camera)
}

function disposeDynamicCards() {
  dynamicGeometries.splice(0).forEach(geometry => geometry.dispose())
  dynamicMaterials.splice(0).forEach(material => material.dispose())
  topCardTexture?.dispose()
  topCardTexture = null
}

function rebuildCards() {
  if (!scene || !cardGroup) return
  while (cardGroup.children.length) cardGroup.remove(cardGroup.children[0]!)
  disposeDynamicCards()
  topCardMesh = null

  const cardGeometry = new BoxGeometry(1.22, 0.09, 1.78, 3, 1, 3)
  dynamicGeometries.push(cardGeometry)
  const backMaterial = new MeshPhysicalMaterial({ color: 0x8c1719, roughness: 0.58, metalness: 0.03 })
  dynamicMaterials.push(backMaterial)
  const stackHeight = Math.min(5, Math.max(1, Math.ceil(props.drawPileCount / 18)))
  for (let index = 0; index < stackHeight; index += 1) {
    const card = new Mesh(cardGeometry, backMaterial)
    card.position.set(-1.15, 0.11 + index * 0.055, 0.08)
    card.rotation.y = -0.08 + index * 0.012
    cardGroup.add(card)
  }

  if (props.topCard) {
    topCardTexture = makeCardTexture(props.topCard)
    const faceGeometry = new PlaneGeometry(1.22, 1.78)
    const faceMaterial = new MeshStandardMaterial({ map: topCardTexture, roughness: 0.64, metalness: 0, side: DoubleSide })
    dynamicGeometries.push(faceGeometry)
    dynamicMaterials.push(faceMaterial)
    topCardMesh = new Mesh(faceGeometry, faceMaterial)
    topCardMesh.rotation.x = -Math.PI / 2
    topCardMesh.rotation.z = 0.1
    topCardMesh.position.set(1.12, 0.17, 0)
    cardGroup.add(topCardMesh)
  }

  const opponentGeometry = new BoxGeometry(0.68, 0.05, 0.98)
  dynamicGeometries.push(opponentGeometry)
  const seatCount = Math.max(props.seatCount, 2)
  for (let index = 0; index < seatCount; index += 1) {
    const angle = Math.PI * 0.15 + (Math.PI * 0.7 * index) / Math.max(seatCount - 1, 1)
    const radius = 4.3
    const card = new Mesh(opponentGeometry, backMaterial)
    card.position.set(Math.cos(angle) * radius, 0.12, -Math.sin(angle) * radius + 0.4)
    card.rotation.y = -angle + Math.PI / 2
    cardGroup.add(card)
  }
  render()
}

function updateCompass() {
  const active = props.activeColor ? colorHex[props.activeColor] : 0xfff7e6
  if (ring && ring.material instanceof MeshStandardMaterial) ring.material.color = new Color(active)
  if (marker && marker.material instanceof MeshStandardMaterial) marker.material.color = new Color(active)
  const seatCount = Math.max(props.seatCount, 1)
  const normalizedIndex = props.activeSeatIndex < 0 ? 0 : props.activeSeatIndex
  const angle = Math.PI * 0.15 + (Math.PI * 0.7 * normalizedIndex) / Math.max(seatCount - 1, 1)
  marker?.position.set(Math.cos(angle) * 2.2, 0.11, -Math.sin(angle) * 2.2 + 0.12)
  if (ring) ring.rotation.z = props.direction === 1 ? -0.16 : 0.16
  render()
}

function animateAction() {
  cancelAnimationFrame(frame)
  if (!topCardMesh) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const startedAt = performance.now()
  const duration = reduced ? 1 : 620
  const mesh = topCardMesh
  mesh.scale.setScalar(reduced ? 1 : 0.72)
  mesh.position.y = reduced ? 0.17 : 1.25
  const draw = (time: number) => {
    const progress = Math.min((time - startedAt) / duration, 1)
    const eased = 1 - (1 - progress) ** 3
    mesh.scale.setScalar(0.72 + 0.28 * eased)
    mesh.position.y = 0.17 + (1 - eased) * 1.08 + Math.sin(progress * Math.PI) * 0.16
    mesh.rotation.z = 0.1 + (1 - eased) * (props.direction === 1 ? -0.65 : 0.65)
    render()
    if (progress < 1) frame = requestAnimationFrame(draw)
  }
  frame = requestAnimationFrame(draw)
}

onMounted(() => {
  if (!canvas.value) return
  try {
    renderer = new WebGLRenderer({ canvas: canvas.value, alpha: true, antialias: true })
    renderer.outputColorSpace = SRGBColorSpace
  } catch {
    failed.value = true
    return
  }
  scene = new Scene()
  camera = new PerspectiveCamera(36, 1, 0.1, 100)
  camera.position.set(0, 7.6, 8.5)
  camera.lookAt(0, 0, -0.4)
  tableGroup = new Group()
  cardGroup = new Group()
  scene.add(tableGroup, cardGroup)

  const tableGeometry = new CircleGeometry(5.6, 72)
  const tableMaterial = new MeshPhysicalMaterial({ color: 0x11151d, roughness: 0.88, metalness: 0.02 })
  geometries.push(tableGeometry)
  materials.push(tableMaterial)
  const table = new Mesh(tableGeometry, tableMaterial)
  table.rotation.x = -Math.PI / 2
  table.position.y = -0.03
  tableGroup.add(table)

  const ringGeometry = new RingGeometry(1.82, 2.02, 72, 1, 0.28, Math.PI * 1.72)
  const ringMaterial = new MeshStandardMaterial({ color: 0xfff7e6, transparent: true, opacity: 0.82, side: DoubleSide })
  geometries.push(ringGeometry)
  materials.push(ringMaterial)
  ring = new Mesh(ringGeometry, ringMaterial)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.075
  tableGroup.add(ring)

  const markerGeometry = new SphereGeometry(0.13, 18, 12)
  const markerMaterial = new MeshStandardMaterial({ color: 0xfff7e6, emissive: 0x333333 })
  geometries.push(markerGeometry)
  materials.push(markerMaterial)
  marker = new Mesh(markerGeometry, markerMaterial)
  tableGroup.add(marker)

  scene.add(new AmbientLight(0xffffff, 2.3))
  const light = new DirectionalLight(0xffffff, 3.2)
  light.position.set(-3, 8, 5)
  scene.add(light)

  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas.value)
  resize()
  rebuildCards()
  updateCompass()
  animateAction()
})

watch(() => `${props.topCard?.id ?? 'none'}:${props.drawPileCount}:${props.seatCount}`, () => {
  if (!renderer) return
  rebuildCards()
  updateCompass()
})
watch(() => `${props.activeColor ?? 'wild'}:${props.direction}:${props.activeSeatIndex}`, updateCompass)
watch(() => props.actionKey, animateAction)

onScopeDispose(() => {
  cancelAnimationFrame(frame)
  resizeObserver?.disconnect()
  disposeDynamicCards()
  geometries.forEach(geometry => geometry.dispose())
  materials.forEach(material => material.dispose())
  renderer?.dispose()
})
</script>

<template>
  <div class="scene-shell">
    <canvas
      ref="canvas"
      class="scene-canvas"
      aria-hidden="true"
    />
    <p
      v-if="failed"
      class="sr-only"
    >
      The animated table is unavailable. All game controls remain available.
    </p>
  </div>
</template>

<style scoped>
.scene-shell { position: absolute; inset: 0; pointer-events: none; }
.scene-canvas { width: 100%; height: 100%; }
</style>

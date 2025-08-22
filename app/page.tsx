"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

interface GameState {
  speed: number
  gear: number
  rpm: number
  isAccelerating: boolean
  isBraking: boolean
  isBoosting: boolean
  cameraMode: "FPP" | "TPP"
}

export default function RacingGame() {
  const mountRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [carModel, setCarModel] = useState<THREE.Group | null>(null)
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [gameState, setGameState] = useState<GameState>({
    speed: 0,
    gear: 1,
    rpm: 800,
    isAccelerating: false,
    isBraking: false,
    isBoosting: false,
    cameraMode: "TPP",
  })

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !file.name.toLowerCase().endsWith(".glb")) {
      alert("Please select a valid .glb file")
      return
    }

    const loader = new GLTFLoader()
    const url = URL.createObjectURL(file)

    loader.load(
      url,
      (gltf) => {
        console.log("[v0] GLB model loaded successfully")
        const model = gltf.scene

        model.scale.set(1.3, 1.3, 1.3)
        model.position.set(0, 0, 0)
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })

        setCarModel(model)
        setIsModelLoaded(true)
        setShowUploadModal(false)
        URL.revokeObjectURL(url)
      },
      (progress) => {
        console.log("[v0] Loading progress:", (progress.loaded / progress.total) * 100 + "%")
      },
      (error) => {
        console.error("[v0] Error loading GLB model:", error)
        alert("Error loading the GLB file. Please try another file.")
        URL.revokeObjectURL(url)
      },
    )
  }, [])

  const generateRandomTrack = useCallback(() => {
    const trackPoints = []
    const numPoints = 32 // More points for smoother circular track
    const baseRadius = 180 // Base radius for circular track

    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2
      // Much smaller radius variation for more circular track
      const radiusVariation = baseRadius + Math.sin(angle * 2) * 15 + Math.cos(angle * 4) * 8
      trackPoints.push({
        x: Math.cos(angle) * radiusVariation,
        z: Math.sin(angle) * radiusVariation,
      })
    }

    return trackPoints
  }, [])

  useEffect(() => {
    if (!mountRef.current) return

    console.log("[v0] Initializing 3D racing game")

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ antialias: true })

    try {
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      renderer.setClearColor(0x87ceeb)
      mountRef.current.appendChild(renderer.domElement)
    } catch (error) {
      console.error("[v0] Error setting up renderer:", error)
      return
    }

    const ambientLight = new THREE.AmbientLight(0x404040, 0.4)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2)
    directionalLight.position.set(-50, 70, 50) // 45 degrees northwest from car front
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.left = -200
    directionalLight.shadow.camera.right = 200
    directionalLight.shadow.camera.top = 200
    directionalLight.shadow.camera.bottom = -200
    scene.add(directionalLight)

    const skyGeometry = new THREE.SphereGeometry(500, 32, 32)
    const skyMaterial = new THREE.MeshBasicMaterial({
      color: 0x87ceeb,
      side: THREE.BackSide,
    })
    const sky = new THREE.Mesh(skyGeometry, skyMaterial)
    scene.add(sky)

    const grassGeometry = new THREE.PlaneGeometry(800, 800)
    const grassMaterial = new THREE.MeshLambertMaterial({
      color: 0x90ee90, // Light green color for grass
      side: THREE.DoubleSide,
    })
    const grassPlane = new THREE.Mesh(grassGeometry, grassMaterial)
    grassPlane.rotation.x = -Math.PI / 2 // Rotate to be horizontal
    grassPlane.position.y = -0.1 // Slightly below track level
    grassPlane.receiveShadow = true
    scene.add(grassPlane)

    const trackPoints = generateRandomTrack()
    const trackWidth = 60 // Track width

    const trackShape = new THREE.Shape()
    const outerPoints = []
    const innerPoints = []

    for (let i = 0; i < trackPoints.length; i++) {
      const point = trackPoints[i]
      const nextPoint = trackPoints[(i + 1) % trackPoints.length]
      const prevPoint = trackPoints[(i - 1 + trackPoints.length) % trackPoints.length]

      const direction = new THREE.Vector2(nextPoint.x - prevPoint.x, nextPoint.z - prevPoint.z).normalize()
      const perpendicular = new THREE.Vector2(-direction.y, direction.x)

      const outerPoint = {
        x: point.x + perpendicular.x * (trackWidth / 2),
        z: point.z + perpendicular.y * (trackWidth / 2),
      }
      const innerPoint = {
        x: point.x - perpendicular.x * (trackWidth / 2),
        z: point.z - perpendicular.y * (trackWidth / 2),
      }

      outerPoints.push(outerPoint)
      innerPoints.push(innerPoint)
    }

    // Properly aligned boundary walls that follow track borders
    for (let i = 0; i < outerPoints.length; i++) {
      const currentOuter = outerPoints[i]
      const nextOuter = outerPoints[(i + 1) % outerPoints.length]
      const currentInner = innerPoints[i]
      const nextInner = innerPoints[(i + 1) % innerPoints.length]

      // Track surface
      const segmentGeometry = new THREE.BufferGeometry()
      const vertices = new Float32Array([
        currentOuter.x,
        0,
        currentOuter.z,
        nextOuter.x,
        0,
        nextOuter.z,
        currentInner.x,
        0,
        currentInner.z,
        nextInner.x,
        0,
        nextInner.z,
        currentInner.x,
        0,
        currentInner.z,
        nextOuter.x,
        0,
        nextOuter.z,
      ])

      segmentGeometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3))
      segmentGeometry.computeVertexNormals()

      const segmentMaterial = new THREE.MeshLambertMaterial({
        color: 0x444444,
        side: THREE.DoubleSide,
      })
      const segment = new THREE.Mesh(segmentGeometry, segmentMaterial)
      segment.receiveShadow = true
      scene.add(segment)

      const outerSegmentLength = Math.sqrt(
        Math.pow(nextOuter.x - currentOuter.x, 2) + Math.pow(nextOuter.z - currentOuter.z, 2),
      )
      const outerWallGeometry = new THREE.BoxGeometry(outerSegmentLength, 4, 2)
      const boundaryMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc })
      const outerWall = new THREE.Mesh(outerWallGeometry, boundaryMaterial)

      // Position wall at midpoint between current and next outer points
      outerWall.position.set((currentOuter.x + nextOuter.x) / 2, 2, (currentOuter.z + nextOuter.z) / 2)

      // Align wall with track border direction
      const outerAngle = Math.atan2(nextOuter.z - currentOuter.z, nextOuter.x - currentOuter.x)
      outerWall.rotation.y = outerAngle
      outerWall.castShadow = true
      outerWall.receiveShadow = true
      scene.add(outerWall)

      const innerSegmentLength = Math.sqrt(
        Math.pow(nextInner.x - currentInner.x, 2) + Math.pow(nextInner.z - currentInner.z, 2),
      )
      const innerWallGeometry = new THREE.BoxGeometry(innerSegmentLength, 4, 2)
      const innerWall = new THREE.Mesh(innerWallGeometry, boundaryMaterial)

      // Position wall at midpoint between current and next inner points
      innerWall.position.set((currentInner.x + nextInner.x) / 2, 2, (currentInner.z + nextInner.z) / 2)

      // Align wall with track border direction
      const innerAngle = Math.atan2(nextInner.z - currentInner.z, nextInner.x - currentInner.x)
      innerWall.rotation.y = innerAngle
      innerWall.castShadow = true
      innerWall.receiveShadow = true
      scene.add(innerWall)

      const centerX = (currentOuter.x + currentInner.x) / 2
      const centerZ = (currentOuter.z + currentInner.z) / 2
      const nextCenterX = (nextOuter.x + nextInner.x) / 2
      const nextCenterZ = (nextOuter.z + nextInner.z) / 2

      if (i % 4 === 0) {
        // Dashed center line
        const lineGeometry = new THREE.BufferGeometry()
        const lineVertices = new Float32Array([centerX, 0.01, centerZ, nextCenterX, 0.01, nextCenterZ])
        lineGeometry.setAttribute("position", new THREE.BufferAttribute(lineVertices, 3))

        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 })
        const centerLine = new THREE.Line(lineGeometry, lineMaterial)
        scene.add(centerLine)
      }
    }

    const aiCars: THREE.Mesh[] = []
    const aiCarPositions = [
      { angle: 0.5, radius: 100 },
      { angle: 1.0, radius: 105 },
      { angle: 1.5, radius: 95 },
      { angle: 2.0, radius: 110 },
    ]

    aiCarPositions.forEach((pos, index) => {
      const aiCarGeometry = new THREE.BoxGeometry(2, 1, 4)
      const aiCarMaterial = new THREE.MeshLambertMaterial({
        color: [0x0000ff, 0x00ff00, 0xffff00, 0xff00ff][index],
      })
      const aiCar = new THREE.Mesh(aiCarGeometry, aiCarMaterial)
      aiCar.position.set(Math.cos(pos.angle) * pos.radius, 0.5, Math.sin(pos.angle) * pos.radius)
      aiCar.rotation.y = pos.angle + Math.PI / 2
      aiCar.castShadow = true
      scene.add(aiCar)
      aiCars.push(aiCar)
    })

    for (let i = 0; i < 30; i++) {
      const fanGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2)
      const fanMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 })
      const fan = new THREE.Mesh(fanGeometry, fanMaterial)

      const angle = (i / 30) * Math.PI * 2
      const radius = 180 + Math.random() * 40
      fan.position.set(Math.cos(angle) * radius, 1, Math.sin(angle) * radius)
      scene.add(fan)
    }

    const carGeometry = new THREE.BoxGeometry(2, 1, 4)
    const carMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 })

    const playerCar = new THREE.Mesh(carGeometry, carMaterial)
    playerCar.position.set(trackPoints[0].x, 0.5, trackPoints[0].z)
    playerCar.castShadow = true
    scene.add(playerCar)

    let currentCarRef = playerCar

    const tppCamera = new THREE.Vector3(0, 8, -15)
    const fppCamera = new THREE.Vector3(0, 1.5, 2)

    const velocity = new THREE.Vector3(0, 0, 0)
    const lateralVelocity = new THREE.Vector3(0, 0, 0)
    let acceleration = 0
    let steering = 0
    let speed = 0
    let gear = 1
    let rpm = 800
    let isHandbraking = false
    let currentCameraMode = "TPP"
    let driftFactor = 0
    let handbrakeIntensity = 0

    const keys: { [key: string]: boolean } = {}

    const handleKeyDown = (event: KeyboardEvent) => {
      keys[event.code.toLowerCase()] = true
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      keys[event.code.toLowerCase()] = false

      if (event.code.toLowerCase() === "keyu") {
        gear = gear >= 6 ? 1 : gear + 1
        rpm = 3000
      }
    }

    const handleResize = () => {
      if (gameRef.current) {
        const { renderer, camera } = gameRef.current
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("keyup", handleKeyUp)
    window.addEventListener("resize", handleResize)

    const clock = new THREE.Clock()
    let animationId: number

    const animate = () => {
      try {
        const deltaTime = clock.getDelta()

        if (carModel && isModelLoaded && currentCarRef !== carModel) {
          replaceCarModel()
        }

        acceleration = 0
        steering = 0
        isHandbraking = false

        if (keys["keyw"] || keys["arrowup"]) acceleration = 1
        if (keys["keys"] || keys["arrowdown"]) acceleration = -0.5
        if (keys["keya"] || keys["arrowleft"]) steering = 1 // Right turn (swapped)
        if (keys["keyd"] || keys["arrowright"]) steering = -1 // Left turn (swapped)
        if (keys["space"]) isHandbraking = true
        if (keys["shiftleft"] || keys["shiftright"]) acceleration *= 1.5

        if (keys["keyc"]) {
          currentCameraMode = currentCameraMode === "TPP" ? "FPP" : "TPP"
        }

        if (isHandbraking) {
          handbrakeIntensity = Math.min(handbrakeIntensity + deltaTime * 3, 1) // Takes time to fully apply
        } else {
          handbrakeIntensity = Math.max(handbrakeIntensity - deltaTime * 4, 0) // Releases gradually
        }

        const gearRatios = [0, 0.3, 0.5, 0.7, 0.85, 0.95, 1.0]
        const maxSpeedByGear = [0, 60, 100, 150, 200, 280, 350]
        const currentMaxSpeed = maxSpeedByGear[gear]
        const engineForce = acceleration * (30 + gear * 10)

        const tireGrip = 0.85 - handbrakeIntensity * 0.55 // Gradual grip reduction
        const lateralGrip = 0.7 - handbrakeIntensity * 0.6 // Gradual lateral grip reduction

        if (acceleration !== 0) {
          const forwardDirection = new THREE.Vector3(0, 0, 1)
          forwardDirection.applyQuaternion(currentCarRef.quaternion)

          const forceVector = forwardDirection.multiplyScalar(engineForce * deltaTime)
          velocity.add(forceVector)
        }

        velocity.multiplyScalar(0.98)

        if (velocity.length() > currentMaxSpeed) {
          velocity.normalize().multiplyScalar(currentMaxSpeed)
        }

        if (Math.abs(velocity.length()) > 0.1 && steering !== 0) {
          const steerAmount = steering * deltaTime * Math.min(Math.abs(velocity.length()) / 30, 1)

          const speedFactor = Math.min(velocity.length() / 50, 1)
          // Enhanced drift factor when handbrake and steering are combined
          driftFactor = Math.abs(steering) * speedFactor * (1 + handbrakeIntensity * 2)

          currentCarRef.rotation.y += steerAmount * (1 + handbrakeIntensity * 0.8)

          // More pronounced drifting with handbrake
          if (driftFactor > 0.2 || handbrakeIntensity > 0.3) {
            const lateralDirection = new THREE.Vector3(1, 0, 0)
            lateralDirection.applyQuaternion(currentCarRef.quaternion)

            const lateralForce = lateralDirection.multiplyScalar(
              steering * driftFactor * velocity.length() * deltaTime * (0.5 + handbrakeIntensity * 0.7),
            )
            lateralVelocity.add(lateralForce)
          }
        }

        lateralVelocity.multiplyScalar(lateralGrip)

        const totalMovement = velocity.clone().add(lateralVelocity)
        currentCarRef.position.add(totalMovement.multiplyScalar(deltaTime))

        if (handbrakeIntensity > 0) {
          const brakingForce = 0.85 + handbrakeIntensity * 0.1 // More braking with higher intensity
          velocity.multiplyScalar(brakingForce)
          lateralVelocity.multiplyScalar(0.5 + handbrakeIntensity * 0.3)
        }

        speed = velocity.length() * 2.5
        rpm = Math.min(800 + (speed / currentMaxSpeed) * 6000, 7000)

        if (!keys["keyu"] && speed > currentMaxSpeed * 0.9 && gear < 6) {
          gear++
          rpm = 2500
        } else if (!keys["keyu"] && speed < currentMaxSpeed * 0.4 && gear > 1) {
          gear--
          rpm = 4500
        }

        aiCars.forEach((car, index) => {
          const currentAngle = Math.atan2(car.position.z, car.position.x)
          const newAngle = currentAngle + (0.4 + index * 0.1) * deltaTime
          const radius = 100 + (index % 2 === 0 ? -8 : 8)

          car.position.x = Math.cos(newAngle) * radius
          car.position.z = Math.sin(newAngle) * radius
          car.rotation.y = newAngle + Math.PI / 2
        })

        if (currentCameraMode === "TPP") {
          const cameraOffset = tppCamera.clone()
          cameraOffset.applyQuaternion(currentCarRef.quaternion)
          camera.position.copy(currentCarRef.position).add(cameraOffset)
          camera.lookAt(currentCarRef.position)
        } else {
          const cameraOffset = fppCamera.clone()
          cameraOffset.applyQuaternion(currentCarRef.quaternion)
          camera.position.copy(currentCarRef.position).add(cameraOffset)
          const lookTarget = currentCarRef.position.clone()
          lookTarget.add(new THREE.Vector3(0, 0, 10).applyQuaternion(currentCarRef.quaternion))
          camera.lookAt(lookTarget)
        }

        setGameState((prev) => ({
          ...prev,
          speed: Math.round(speed),
          gear,
          rpm: Math.round(rpm),
          isAccelerating: acceleration > 0,
          isBraking: acceleration < 0 || handbrakeIntensity > 0, // Updated to use handbrake intensity
          isBoosting: (keys["shiftleft"] || keys["shiftright"]) && acceleration > 0,
          cameraMode: currentCameraMode as "FPP" | "TPP",
        }))

        renderer.render(scene, camera)
        animationId = requestAnimationFrame(animate)
      } catch (error) {
        console.error("[v0] Error in animation loop:", error)
      }
    }

    const replaceCarModel = () => {
      if (carModel && isModelLoaded) {
        try {
          const currentPosition = currentCarRef.position.clone()
          const currentRotation = currentCarRef.rotation.clone()

          scene.remove(currentCarRef)

          carModel.position.copy(currentPosition)
          carModel.rotation.copy(currentRotation)
          scene.add(carModel)
          currentCarRef = carModel

          console.log("[v0] Successfully replaced car with GLB model")
        } catch (error) {
          console.error("[v0] Error replacing car model:", error)
        }
      }
    }

    const cleanup = () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("resize", handleResize)

      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose())
          } else {
            object.material.dispose()
          }
        }
      })

      if (mountRef.current && renderer.domElement && mountRef.current.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }

    gameRef.current = { scene, renderer, cleanup, replaceCarModel }

    animate()

    return cleanup
  }, [carModel, isModelLoaded, generateRandomTrack])

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
      <div ref={mountRef} className="w-full h-full" />

      <button
        onClick={() => setShowUploadModal(true)}
        className="absolute top-6 left-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-full shadow-lg backdrop-blur-sm border border-white/20 transition-all duration-300 hover:scale-105 font-semibold"
      >
        🚗 Upload Car
      </button>

      {showUploadModal && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-2xl shadow-2xl border border-white/20 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Upload Car Model</h2>
              <p className="text-slate-300">Select a .GLB file to customize your car</p>
            </div>

            <input ref={fileInputRef} type="file" accept=".glb" onChange={handleFileUpload} className="hidden" />

            <div className="space-y-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-3 rounded-xl transition-all duration-300 hover:scale-105 font-semibold"
              >
                Choose GLB File
              </button>

              <button
                onClick={() => setShowUploadModal(false)}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-xl transition-all duration-300 font-semibold"
              >
                Cancel
              </button>
            </div>

            {isModelLoaded && (
              <div className="text-green-400 text-center mt-4 flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Custom model loaded successfully
              </div>
            )}
          </div>
        </div>
      )}

      <div className="absolute top-6 right-6 w-48 h-48">
        <div className="relative w-full h-full bg-gradient-to-br from-amber-900 to-amber-800 rounded-full shadow-2xl border-4 border-amber-600">
          <div className="absolute inset-4 bg-gradient-to-br from-black to-slate-800 rounded-full border-2 border-amber-500">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-6 bg-amber-400 origin-bottom"
                style={{
                  left: "50%",
                  bottom: "50%",
                  transform: `translateX(-50%) rotate(${i * 45 - 135}deg)`,
                  transformOrigin: "50% 100%",
                }}
              />
            ))}

            <div
              className="absolute w-1 h-16 bg-red-500 origin-bottom rounded-full shadow-lg"
              style={{
                left: "50%",
                bottom: "50%",
                transform: `translateX(-50%) rotate(${Math.min((gameState.speed / 350) * 270 - 135, 135)}deg)`,
                transformOrigin: "50% 100%",
              }}
            />

            <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-amber-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-lg" />

            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black px-3 py-1 rounded border border-amber-500">
              <div className="text-amber-400 font-mono text-lg font-bold">{gameState.speed}</div>
              <div className="text-amber-300 font-mono text-xs text-center">KM/H</div>
            </div>

            <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-black px-2 py-1 rounded border border-amber-500">
              <div className="text-amber-400 font-mono text-sm">G{gameState.gear}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 right-6 space-y-2">
        <div className="bg-black/80 backdrop-blur-sm text-white px-4 py-2 rounded-full border border-white/20">
          <span className="text-sm font-mono">Camera: {gameState.cameraMode}</span>
        </div>
        <div className="bg-black/80 backdrop-blur-sm text-white px-4 py-2 rounded-full border border-white/20">
          <span className="text-sm font-mono">RPM: {gameState.rpm}</span>
        </div>
      </div>

      <div className="absolute bottom-6 left-6 bg-black/80 backdrop-blur-sm text-white p-6 rounded-2xl border border-white/20 shadow-2xl">
        <div className="font-bold mb-4 text-lg">🎮 Controls</div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span>Drive:</span>
            <span className="font-mono">WASD / Arrows</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Handbrake:</span>
            <span className="font-mono">SPACE</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Boost:</span>
            <span className="font-mono">SHIFT</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Camera:</span>
            <span className="font-mono">C</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Gear:</span>
            <span className="font-mono">U</span>
          </div>
        </div>
      </div>

      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 flex gap-3">
        {gameState.isAccelerating && (
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full shadow-lg animate-pulse">
            ⚡ ACCELERATING
          </div>
        )}
        {gameState.isBraking && (
          <div className="bg-gradient-to-r from-red-500 to-rose-500 text-white px-4 py-2 rounded-full shadow-lg animate-pulse">
            🛑 BRAKING
          </div>
        )}
        {gameState.isBoosting && (
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black px-4 py-2 rounded-full shadow-lg animate-pulse font-bold">
            🚀 BOOST
          </div>
        )}
      </div>
    </div>
  )
}

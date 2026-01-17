'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { GestureType, HandTrackerState, Point, GestureBox } from '@/types';

const VISION_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm";

// Tracking smoothness & stability settings
const PINCH_THRESHOLD = 0.05; // Normalized distance for pinch detection
const LOST_HAND_TIMEOUT_MS = 150; // Grace period before reporting hand as lost
const MIN_DETECTION_CONFIDENCE = 0.7; // Minimum confidence to accept detection
const MIN_TRACKING_CONFIDENCE = 0.6; // Minimum confidence for tracking continuity

// Default gesture box - center region of camera view
// This creates a smaller "active zone" so users don't need to reach across the whole view
const DEFAULT_GESTURE_BOX: GestureBox = {
  x: 0.15,      // Start 15% from left (mirrored: 15% from right in camera view)
  y: 0.15,      // Start 15% from top
  width: 0.7,   // 70% of camera width
  height: 0.7,  // 70% of camera height
};

// One Euro Filter parameters for smooth cursor movement
const ONE_EURO_MIN_CUTOFF = 1.0; // Minimum cutoff frequency
const ONE_EURO_BETA = 0.007; // Speed coefficient
const ONE_EURO_D_CUTOFF = 1.0; // Derivative cutoff frequency

// One Euro Filter implementation for jitter reduction
class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev: number | null = null;
  private dxPrev: number = 0;
  private tPrev: number | null = null;

  constructor(minCutoff = ONE_EURO_MIN_CUTOFF, beta = ONE_EURO_BETA, dCutoff = ONE_EURO_D_CUTOFF) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  filter(x: number, t: number): number {
    if (this.tPrev === null || this.xPrev === null) {
      this.xPrev = x;
      this.tPrev = t;
      return x;
    }

    const dt = t - this.tPrev;
    if (dt <= 0) return this.xPrev;

    // Derivative estimation
    const dx = (x - this.xPrev) / dt;
    const edx = this.alpha(this.dCutoff, dt) * dx + (1 - this.alpha(this.dCutoff, dt)) * this.dxPrev;
    this.dxPrev = edx;

    // Adaptive cutoff based on speed
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);

    // Filtered value
    const result = this.alpha(cutoff, dt) * x + (1 - this.alpha(cutoff, dt)) * this.xPrev;
    this.xPrev = result;
    this.tPrev = t;

    return result;
  }

  reset() {
    this.xPrev = null;
    this.tPrev = null;
    this.dxPrev = 0;
  }
}

export const useHandTracking = (gestureBox: GestureBox = DEFAULT_GESTURE_BOX) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [trackerState, setTrackerState] = useState<HandTrackerState>({
    cursor: { x: 0, y: 0 },
    rawHandPosition: { x: 0.5, y: 0.5 }, // Center by default
    gesture: GestureType.NONE,
    isPinching: false,
    isLoading: true,
    cameraError: null,
  });

  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const lastDetectionTimeRef = useRef<number>(0);
  const lastValidStateRef = useRef<HandTrackerState | null>(null);
  const lastTimestampRef = useRef<number>(0);
  const gestureBoxRef = useRef<GestureBox>(gestureBox);
  
  // Update gesture box ref when prop changes
  useEffect(() => {
    gestureBoxRef.current = gestureBox;
  }, [gestureBox]);
  
  // One Euro Filters for X and Y coordinates
  const xFilterRef = useRef(new OneEuroFilter());
  const yFilterRef = useRef(new OneEuroFilter());

  const startWebcam = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, min: 24 }, // Ensure consistent frame rate
          facingMode: "user"
        }
      });
      videoRef.current.srcObject = stream;
      videoRef.current.addEventListener("loadeddata", predictWebcam);
    } catch (err) {
      console.error("Webcam error:", err);
      setTrackerState(prev => ({ ...prev, isLoading: false, cameraError: "Camera permission denied or not found." }));
    }
  }, []);

  const predictWebcam = useCallback(() => {
    if (!handLandmarkerRef.current || !videoRef.current) return;

    if (videoRef.current.videoWidth === 0) {
      requestRef.current = requestAnimationFrame(predictWebcam);
      return;
    }

    const currentTimeMs = performance.now();
    
    // Ensure we're not processing the same frame twice (prevents duplicate detections)
    if (currentTimeMs - lastTimestampRef.current < 16) { // ~60fps max
      requestRef.current = requestAnimationFrame(predictWebcam);
      return;
    }
    lastTimestampRef.current = currentTimeMs;

    const results = handLandmarkerRef.current.detectForVideo(videoRef.current, currentTimeMs);

    if (results.landmarks && results.landmarks.length > 0) {
      lastDetectionTimeRef.current = currentTimeMs;
      const landmarks = results.landmarks[0];

      // Key landmarks
      const wrist = landmarks[0];
      const thumbTip = landmarks[4];
      const indexPIP = landmarks[6];
      const indexTip = landmarks[8];
      const middlePIP = landmarks[10];
      const middleTip = landmarks[12];
      const ringPIP = landmarks[14];
      const ringTip = landmarks[16];
      const pinkyPIP = landmarks[18];
      const pinkyTip = landmarks[20];
      const middleMCP = landmarks[9]; // For hand scale normalization

      // Raw normalized hand position (0-1) - used for gesture box visualization
      // Store the raw MediaPipe coordinates (0 = left of camera sensor, 1 = right)
      // The UI will handle mirroring for display since video uses -scale-x-100
      const rawNormalizedX = indexTip.x; // Raw position for visualization (UI mirrors it)
      const rawNormalizedY = indexTip.y;

      // For cursor mapping, we need to invert X since camera is mirrored for natural interaction
      const cursorNormalizedX = 1 - indexTip.x;

      // Map hand position within gesture box to full screen
      // If hand is within the gesture box, map that region to the full canvas
      const box = gestureBoxRef.current;
      
      // Clamp and map the position within the gesture box to 0-1 range
      const mappedX = Math.max(0, Math.min(1, (cursorNormalizedX - box.x) / box.width));
      const mappedY = Math.max(0, Math.min(1, (rawNormalizedY - box.y) / box.height));
      
      // Convert to screen coordinates
      const rawX = mappedX * window.innerWidth;
      const rawY = mappedY * window.innerHeight;
      const timeInSeconds = currentTimeMs / 1000;
      
      const smoothX = xFilterRef.current.filter(rawX, timeInSeconds);
      const smoothY = yFilterRef.current.filter(rawY, timeInSeconds);

      // Hand scale normalization: use wrist-to-middle-MCP distance as reference unit
      // This makes pinch detection work regardless of hand distance from camera
      const handScale = Math.sqrt(
        Math.pow(middleMCP.x - wrist.x, 2) + 
        Math.pow(middleMCP.y - wrist.y, 2)
      );

      // Normalized pinch distance (relative to hand scale)
      const pinchDistance = Math.sqrt(
        Math.pow(indexTip.x - thumbTip.x, 2) + 
        Math.pow(indexTip.y - thumbTip.y, 2)
      );
      const normalizedPinchDistance = handScale > 0 ? pinchDistance / handScale : pinchDistance;
      const isPinching = normalizedPinchDistance < PINCH_THRESHOLD * 3; // Adjusted for normalized scale

      // Improved finger extension detection
      // Use a combination of tip-to-wrist distance vs pip-to-wrist distance
      // This works regardless of camera orientation
      const isFingerUp = (tip: typeof indexTip, pip: typeof indexPIP, mcp: typeof landmarks[5]): boolean => {
        const tipToWrist = Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2));
        const mcpToWrist = Math.sqrt(Math.pow(mcp.x - wrist.x, 2) + Math.pow(mcp.y - wrist.y, 2));
        
        // Finger is extended if tip is significantly further from wrist than MCP
        // Using MCP instead of PIP for more reliable detection
        return tipToWrist > mcpToWrist * 1.3;
      };

      // Check thumb extension (different logic - thumb extends sideways)
      const isThumbUp = (): boolean => {
        const thumbIP = landmarks[3];
        const thumbMCP = landmarks[2];
        const thumbToWrist = Math.sqrt(Math.pow(thumbTip.x - wrist.x, 2) + Math.pow(thumbTip.y - wrist.y, 2));
        const thumbMCPToWrist = Math.sqrt(Math.pow(thumbMCP.x - wrist.x, 2) + Math.pow(thumbMCP.y - wrist.y, 2));
        return thumbToWrist > thumbMCPToWrist * 1.2;
      };

      const thumbExtended = isThumbUp();
      const indexExtended = isFingerUp(indexTip, indexPIP, landmarks[5]);
      const middleExtended = isFingerUp(middleTip, middlePIP, landmarks[9]);
      const ringExtended = isFingerUp(ringTip, ringPIP, landmarks[13]);
      const pinkyExtended = isFingerUp(pinkyTip, pinkyPIP, landmarks[17]);

      // Gesture classification with priority order
      let gesture = GestureType.NONE;

      // Count extended fingers for better classification
      const extendedCount = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;

      // 1. CLOSED_FIST: All 4 main fingers folded (ignore thumb - it's unreliable)
      if (extendedCount === 0) {
        gesture = GestureType.CLOSED_FIST;
      }
      // 2. OPEN_PALM: All 4 main fingers extended
      else if (extendedCount === 4) {
        gesture = GestureType.OPEN_PALM;
      }
      // 3. VICTORY: Exactly index + middle extended (V-sign)
      else if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
        gesture = GestureType.VICTORY;
      }
      // 4. POINTER: Only index extended (for drawing)
      else if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        // Check for pinch within pointer gesture
        if (isPinching) {
          gesture = GestureType.PINCH;
        } else {
          gesture = GestureType.POINTER;
        }
      }
      // 5. PINCH: Thumb + Index tips close together (can happen with various finger states)
      else if (isPinching) {
        gesture = GestureType.PINCH;
      }

      const newState: HandTrackerState = {
        cursor: { x: smoothX, y: smoothY },
        rawHandPosition: { x: rawNormalizedX, y: rawNormalizedY },
        gesture,
        isPinching,
        isLoading: false,
        cameraError: null,
      };
      
      lastValidStateRef.current = newState;
      setTrackerState(newState);
    } else {
      // Grace period: keep last valid state for a short time to reduce flicker
      const timeSinceLastDetection = currentTimeMs - lastDetectionTimeRef.current;
      
      if (timeSinceLastDetection < LOST_HAND_TIMEOUT_MS && lastValidStateRef.current) {
        // Keep the last valid cursor position, but mark as not pinching
        setTrackerState({
          ...lastValidStateRef.current,
          gesture: GestureType.NONE,
          isPinching: false,
        });
      } else {
        setTrackerState(prev => ({
          ...prev,
          gesture: GestureType.NONE,
          isPinching: false,
          isLoading: false
        }));
      }
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  }, []);

  const setupMediaPipe = useCallback(async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(VISION_CDN);
      handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: MIN_DETECTION_CONFIDENCE, // Higher = fewer false positives
        minHandPresenceConfidence: MIN_TRACKING_CONFIDENCE,   // Confidence that hand is present
        minTrackingConfidence: MIN_TRACKING_CONFIDENCE,       // Confidence to continue tracking
      });

      startWebcam();
    } catch (error) {
      console.error("Error initializing MediaPipe:", error);
      setTrackerState(prev => ({ ...prev, isLoading: false, cameraError: "Failed to load AI model." }));
    }
  }, [startWebcam]);

  useEffect(() => {
    setupMediaPipe();
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      // Clean up video stream
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [setupMediaPipe]);

  return { videoRef, gestureBox: gestureBoxRef.current, ...trackerState };
};

// Export default gesture box for use in components
export { DEFAULT_GESTURE_BOX };

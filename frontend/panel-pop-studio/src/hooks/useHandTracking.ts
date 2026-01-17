'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { GestureType, HandTrackerState, Point } from '@/types';

const VISION_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm";

const SMOOTHING_FACTOR = 0.3;
const PINCH_THRESHOLD = 0.05;

export const useHandTracking = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [trackerState, setTrackerState] = useState<HandTrackerState>({
    cursor: { x: 0, y: 0 },
    gesture: GestureType.NONE,
    isPinching: false,
    isLoading: true,
    cameraError: null,
  });

  const lastCursorRef = useRef<Point>({ x: 0, y: 0 });
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);

  const startWebcam = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 1280,
          height: 720,
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

    const startTimeMs = performance.now();
    const results = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];

      const indexTip = landmarks[8];
      const thumbTip = landmarks[4];
      const middleTip = landmarks[12];
      const ringTip = landmarks[16];
      const pinkyTip = landmarks[20];
      const wrist = landmarks[0];

      const x = (1 - indexTip.x) * window.innerWidth;
      const y = indexTip.y * window.innerHeight;

      const smoothX = lastCursorRef.current.x + (x - lastCursorRef.current.x) * SMOOTHING_FACTOR;
      const smoothY = lastCursorRef.current.y + (y - lastCursorRef.current.y) * SMOOTHING_FACTOR;
      lastCursorRef.current = { x: smoothX, y: smoothY };

      const distance = Math.sqrt(
        Math.pow(indexTip.x - thumbTip.x, 2) + Math.pow(indexTip.y - thumbTip.y, 2)
      );
      const isPinching = distance < PINCH_THRESHOLD;

      let gesture = GestureType.NONE;

      const isFingerExtended = (tip: typeof indexTip, pip: number) => {
        return Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2)) >
          Math.sqrt(Math.pow(landmarks[pip].x - wrist.x, 2) + Math.pow(landmarks[pip].y - wrist.y, 2));
      };

      const indexExtended = isFingerExtended(indexTip, 6);
      const middleExtended = isFingerExtended(middleTip, 10);
      const ringExtended = isFingerExtended(ringTip, 14);
      const pinkyExtended = isFingerExtended(pinkyTip, 18);

      if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        gesture = GestureType.CLOSED_FIST;
      } else if (indexExtended && middleExtended && ringExtended && pinkyExtended) {
        gesture = GestureType.OPEN_PALM;
      } else if (isPinching) {
        gesture = GestureType.PINCH;
      }

      setTrackerState({
        cursor: { x: smoothX, y: smoothY },
        gesture,
        isPinching,
        isLoading: false,
        cameraError: null,
      });
    } else {
      setTrackerState(prev => ({
        ...prev,
        gesture: GestureType.NONE,
        isPinching: false,
        isLoading: false
      }));
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
    };
  }, [setupMediaPipe]);

  return { videoRef, ...trackerState };
};

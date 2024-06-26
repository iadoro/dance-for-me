// Copyright 2023 The MediaPipe Authors.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// ----------------------------------- WEBCAM PROCESSING -----------------------------------------

import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "https://cdn.skypack.dev/@mediapipe/tasks-vision@0.10.0";

const demosSection = document.getElementById("demos");

let poseLandmarker = undefined;
let runningMode = "IMAGE";
let enableWebcamButton;
let webcamRunning = false;
const videoHeight = "360px";
const videoWidth = "480px";

// Before we can use PoseLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
const createPoseLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
      delegate: "GPU",
    },
    runningMode: runningMode,
    numPoses: 2,
  });
  demosSection.classList.remove("invisible");
};
createPoseLandmarker();

/********************************************************************
  // Demo 2: Continuously grab image from webcam stream and detect it.
  ********************************************************************/

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const drawingUtils = new DrawingUtils(canvasCtx);

// Check if webcam access is supported.
const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById("webcamButton");
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

// Enable the live webcam view and start detection.
function enableCam(event) {
  if (!poseLandmarker) {
    console.log("Wait! poseLandmaker not loaded yet.");
    return;
  }

  if (webcamRunning === true) {
    webcamRunning = false;
    enableWebcamButton.innerText = "ENABLE PREDICTIONS";
  } else {
    webcamRunning = true;
    enableWebcamButton.innerText = "DISABLE PREDICTIONS";
  }

  // getUsermedia parameters.
  const constraints = {
    video: true,
  };

  // Activate the webcam stream.
  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
}

let lastVideoTime = -1;
async function predictWebcam() {
  canvasElement.style.height = videoHeight;
  video.style.height = videoHeight;
  canvasElement.style.width = videoWidth;
  video.style.width = videoWidth;
  // Now let's start detecting the stream.
  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await poseLandmarker.setOptions({ runningMode: "VIDEO", num_poses: 2 });
  }
  let startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    poseLandmarker.detectForVideo(video, startTimeMs, (result) => {
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      let angle = 0;
      for (const landmark of result.landmarks) {
        // drawingUtils.drawLandmarks(landmark, {
        //   radius: (data) => DrawingUtils.lerp(data.from.z, -0.15, 0.1, 5, 1),
        // });
        drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
        let landmark12 = landmark[12];
        let landmark14 = landmark[14];
        console.log(landmark12.x, landmark12.y, landmark12.z);
        console.log(landmark14.x, landmark14.y, landmark14.z);
        angle += angleWithXAxis(
          landmark14.x - landmark12.x,
          landmark14.y - landmark12.y
        );

        console.log(angle);
      }
      let playback_rate = (angle / result.landmarks.length - 90) / 90;
      audioPlayer.playbackRate = parseFloat(Math.max(playback_rate, 0.2));
      canvasCtx.restore();
    });
  }

  // Call this function again to keep predicting when the browser is ready.
  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}

function angleWithXZPlane(x, y, z) {
  // Calculate the magnitude of the projection onto the XZ-plane
  const magnitudeXZ = Math.sqrt(x * x + z * z);

  // Calculate the cosine of the angle with the XZ-plane
  const cosAngle = magnitudeXZ === 0 ? 0 : z / magnitudeXZ;

  // Calculate the angle in radians
  const angleRadians = Math.acos(cosAngle);

  // Convert radians to degrees
  const angleDegrees = angleRadians * (180 / Math.PI);

  return angleDegrees;
}

function angleWithXAxis(x, y) {
  // Calculate the angle in radians using Math.atan2
  const angleRadians = Math.atan2(y, x);

  // Convert radians to degrees
  const angleDegrees = angleRadians * (180 / Math.PI);

  // Ensure the angle is positive (between 0 and 360 degrees)
  const positiveAngle = angleDegrees >= 0 ? angleDegrees : 360 + angleDegrees;

  return positiveAngle;
}

// ----------------------------------- AUDIO PLAYER -----------------------------------------

let audioPlayer = document.getElementById("audioPlayer");
let audioFileInput = document.getElementById("audioFileInput");
let playbackRateInput = document.getElementById("playbackRate");

// Function to handle file upload
function handleFileUpload(event) {
  const file = event.target.files[0];
  const fileURL = URL.createObjectURL(file);
  audioPlayer.src = fileURL;
}

// Function to play audio
function playAudio() {
  audioPlayer.play();
}

// Function to pause audio
function pauseAudio() {
  audioPlayer.pause();
}

// Update playback rate based on input value
playbackRateInput.addEventListener("change", function () {
  audioPlayer.playbackRate = parseFloat(this.value);
});

// Event listener for file input change
audioFileInput.addEventListener("change", handleFileUpload);

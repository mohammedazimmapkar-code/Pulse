let isTracking = false;
let repCount = 0;
let currentState = "BOTTOM"; 
let timeStartedLifting = 0;
let firstRepConcentricTime = 0;

// UI Elements
const startBtn = document.getElementById('startBtn');
const repCountDisplay = document.getElementById('repCount');
const statusText = document.getElementById('statusText');
const fatigueAlert = document.getElementById('fatigueAlert');

startBtn.addEventListener('click', () => {
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().then(permissionState => {
            if (permissionState === 'granted') {
                startTracking();
            }
        }).catch(console.error);
    } else {
        startTracking();
    }
});

function startTracking() {
    isTracking = true;
    startBtn.style.display = 'none';
    statusText.innerText = "Arm down to begin...";
    
    window.addEventListener('devicemotion', (event) => {
        if (!isTracking) return;

        // Use absolute Y gravity to handle right-side up or upside-down phone
        let accY = Math.abs(event.accelerationIncludingGravity.y);

        // THRESHOLDS FOR BICEP CURL
        // Arm straight down = Y is near 9.8
        // Arm curled horizontal = Y is near 0
        let bottomThreshold = 7.5; 
        let topThreshold = 3.5;    

        if (currentState === "BOTTOM" && accY < bottomThreshold) {
            // User just started curling the weight UP
            currentState = "LIFTING";
            timeStartedLifting = Date.now();
            statusText.innerText = "Lifting...";
            statusText.style.color = "#FFEB3B"; // Yellow
        } 
        else if (currentState === "LIFTING" && accY < topThreshold) {
            // User successfully reached the TOP of the curl
            currentState = "TOP";
            let concentricTime = Date.now() - timeStartedLifting;
            registerRep(concentricTime);
            statusText.innerText = "Lower the weight";
            statusText.style.color = "#2196F3"; // Blue
        }
        else if (currentState === "TOP" && accY > bottomThreshold) {
            // User lowered the weight fully back DOWN
            currentState = "BOTTOM";
            statusText.innerText = "Ready for next rep";
            statusText.style.color = "#4CAF50"; // Green
        }
    });
}

function registerRep(concentricTime) {
    repCount++;
    repCountDisplay.innerText = repCount;

    // Save the baseline speed of the very first rep
    if (repCount === 1) {
        firstRepConcentricTime = concentricTime;
    } else {
        // FATIGUE CHECK: If this upward pull took 40% longer than your first rep
        if (concentricTime > (firstRepConcentricTime * 1.4)) {
            triggerFailure();
        }
    }
}

function triggerFailure() {
    isTracking = false; 
    statusText.style.display = 'none';
    fatigueAlert.style.display = 'block';
    
    // Vibrate the phone aggressively
    if (navigator.vibrate) {
        navigator.vibrate([500, 200, 500, 200, 1000]); 
    }
}

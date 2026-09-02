let isTracking = false;
let repCount = 0;
let currentState = "BOTTOM"; 
let timeStartedLifting = 0;
let fastestRepTime = 9999; 

// UI Elements
const startBtn = document.getElementById('startBtn');
const repCountDisplay = document.getElementById('repCount');
const repTimeDisplay = document.getElementById('repTimeDisplay');
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

        let accY = Math.abs(event.accelerationIncludingGravity.y);

        // STRICT THRESHOLDS: Forces full range of motion
        let bottomThreshold = 7.5; 
        let topThreshold = 1.5;    

        if (currentState === "BOTTOM" && accY < bottomThreshold) {
            // LIFTER STARTED PULLING
            currentState = "LIFTING";
            timeStartedLifting = Date.now();
            statusText.innerText = "Lifting...";
            statusText.style.color = "#FFEB3B"; 
        } 
        else if (currentState === "LIFTING" && accY < topThreshold) {
            // LIFTER SUCCESSFULLY REACHED THE TOP
            currentState = "TOP";
            let concentricTime = Date.now() - timeStartedLifting;
            
            // Glitch protection: No human curls in less than 200ms
            if (concentricTime > 200) {
                registerRep(concentricTime);
            }
            
            statusText.innerText = "Lower the weight";
            statusText.style.color = "#2196F3"; 
        }
        else if (currentState === "LIFTING" && accY > bottomThreshold) {
            // FAILED REP DETECTOR: 
            // They left the bottom, but gravity returned to 9.8 without ever hitting the 1.5 top threshold.
            // This means they did a half-rep and dropped it.
            let attemptTime = Date.now() - timeStartedLifting;
            
            // Wait 500ms to ensure it wasn't just a micro-wobble at the bottom
            if (attemptTime > 500) {
                triggerFailure("FAILED REP: Incomplete Range of Motion");
            } else {
                currentState = "BOTTOM"; // Silent reset for tiny jitters
            }
        }
        else if (currentState === "TOP" && accY > bottomThreshold) {
            // LIFTER LOWERED THE WEIGHT
            currentState = "BOTTOM";
            statusText.innerText = "Ready for next rep";
            statusText.style.color = "#4CAF50"; 
        }
    });
}

function registerRep(concentricTime) {
    repCount++;
    repCountDisplay.innerText = repCount;
    repTimeDisplay.innerText = (concentricTime / 1000).toFixed(2) + "s";

    // Track the absolute fastest (most powerful) rep of the set
    if (concentricTime < fastestRepTime) {
        fastestRepTime = concentricTime;
    }

    // FATIGUE CHECK (Velocity Loss): 
    // If current rep takes 50% longer than your peak performance rep
    if (repCount > 2 && concentricTime > (fastestRepTime * 1.5)) {
        triggerFailure("FATIGUE: Velocity Loss Detected");
    }
}

function triggerFailure(reason) {
    isTracking = false; 
    statusText.style.display = 'none';
    fatigueAlert.innerText = reason; // Display the exact reason they failed
    fatigueAlert.style.display = 'block';
    
    // Aggressive haptic vibration
    if (navigator.vibrate) {
        navigator.vibrate([500, 200, 500, 200, 1000]); 
    }
}

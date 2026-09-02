let isTracking = false;
let repCount = 0;
let isLifting = false;
let lastRepTime = 0;
let firstRepDuration = 0;

// UI Elements
const startBtn = document.getElementById('startBtn');
const repCountDisplay = document.getElementById('repCount');
const statusText = document.getElementById('statusText');
const fatigueAlert = document.getElementById('fatigueAlert');

startBtn.addEventListener('click', () => {
    // Request permission for iOS devices (Android usually allows it directly)
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
    
    // Listen to the phone's accelerometer
    window.addEventListener('devicemotion', (event) => {
        if (!isTracking) return;

        // Y-axis acceleration (includes gravity)
        let accY = Math.abs(event.accelerationIncludingGravity.y);

        // Threshold logic: 9.8 is resting gravity. A fast upward curl spikes this number.
        // You may need to tweak '13' and '10' based on how hard you lift the phone.
        if (accY > 15) { 
            if (!isLifting) {
                isLifting = true;
                processRep();
            }
        } else if (accY < 11) {
            isLifting = false; // Reset when arm goes back down
        }
    });
}

function processRep() {
    let currentTime = Date.now();
    repCount++;
    repCountDisplay.innerText = repCount;

    if (repCount === 1) {
        lastRepTime = currentTime;
    } else {
        let currentRepDuration = currentTime - lastRepTime;
        
        // Save the baseline speed of the very first complete rep
        if (repCount === 2) {
            firstRepDuration = currentRepDuration;
        }

        // FATIGUE CHECK: If this rep took 40% longer than your first rep
        if (repCount > 2 && currentRepDuration > (firstRepDuration * 1.4)) {
            triggerFailure();
        }
        
        lastRepTime = currentTime;
    }
}

function triggerFailure() {
    isTracking = false; // Stop tracking
    statusText.style.display = 'none';
    fatigueAlert.style.display = 'block';
    
    // Vibrate the phone (Long, Short, Long pattern)
    if (navigator.vibrate) {
        navigator.vibrate([500, 200, 500]); 
    }
}

#include <Arduino.h>
#include <IRremote.hpp>

// Use a single completely safe pin (e.g. Pin 32). 
// You can connect multiple TSOP OUT pins together in parallel to this single ESP32 pin!
const uint16_t kRecvPin = 32; 

void setup() {
  Serial.begin(115200);
  // Start the receiver and enable the built-in LED to blink when receiving IR
  IrReceiver.begin(kRecvPin, ENABLE_LED_FEEDBACK); 
  Serial.println("System Ready: Listening for IR transponders on Pin 32 (Native Library)");
}

unsigned long lastHeartbeat = 0;

void loop() {
  if (millis() - lastHeartbeat > 5000) {
    Serial.println("HEARTBEAT: ESP32 is alive and listening...");
    lastHeartbeat = millis();
  }

  if (IrReceiver.decode()) {
    // Print every signal we get
    Serial.print("IR RECEIVED -> Protocol: ");
    Serial.print(IrReceiver.decodedIRData.protocol);
    Serial.print(" | Command: ");
    Serial.println(IrReceiver.decodedIRData.command);

    // If it's a valid NEC signal, print it in the format ir_tracker.py expects
    if (IrReceiver.decodedIRData.protocol == NEC) {
        Serial.print("ID: ");
        Serial.println(IrReceiver.decodedIRData.command);
    }
    
    // Resume listening
    IrReceiver.resume(); 
  }
}

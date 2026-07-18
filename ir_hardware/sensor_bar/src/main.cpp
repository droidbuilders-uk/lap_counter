#include <Arduino.h>
#include <IRrecv.h>
#include <IRutils.h>

// Define the GPIO pins connected to your TSOP38238 receivers.
// You can daisy chain multiple receivers across the track!
const uint16_t kRecvPins[] = {15, 2, 4, 16, 17, 5, 18, 19}; 
const int numPins = sizeof(kRecvPins) / sizeof(kRecvPins[0]);

IRrecv* irReceivers[numPins];
decode_results results;

void setup() {
  // Initialize Serial to match the backend's default baud rate (9600)
  Serial.begin(9600);
  
  // Start all IR receivers
  for (int i = 0; i < numPins; i++) {
    irReceivers[i] = new IRrecv(kRecvPins[i]);
    irReceivers[i]->enableIRIn(); 
  }
}

void loop() {
  // Rapidly poll all receivers
  for (int i = 0; i < numPins; i++) {
    if (irReceivers[i]->decode(&results)) {
      // We expect the ATtiny to send NEC protocol packets.
      // Filter out garbage noise (0xFFFFFFFF is a repeat code)
      if (results.decode_type == NEC && results.value != 0xFFFFFFFF) {
        
        // Print it securely so ir_tracker.py can parse it
        Serial.print("ID: ");
        Serial.println(results.command); // We will send the transponder ID as the NEC 'command' byte
      }
      // Resume listening
      irReceivers[i]->resume(); 
    }
  }
}
